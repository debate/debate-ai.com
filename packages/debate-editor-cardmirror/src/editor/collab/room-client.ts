/**
 * Rooms transport: REST client + SSE stream for the relay's
 * collaboration-session endpoints (`/relay/rooms/*`).
 *
 * Transport only — blobs in and out of this module are opaque bytes
 * (the session layer encrypts/decrypts). Runs in the renderer on both
 * web and desktop: plain `fetch` with a streamed reader (no undici, no
 * EventSource — EventSource cannot send an Authorization header).
 *
 * `RoomStream` is the rooms sibling of the desktop mailbox subscriber
 * (`apps/desktop/src/relay-stream.ts`): same frame grammar, same
 * backoff-with-jitter reconnect discipline, same restart() hook for
 * wake-from-sleep. Differences: the hello frame carries `{lastSeq}`
 * (the caller's catch-up cursor), data frames are typed
 * (`u` update / `p` presence / `end` session-over), and HTTP 410 means
 * the session ended (stop, permanently) while 409 means the room is
 * full (stop; the caller surfaces it).
 */

import { base64ToBytes } from './collab-crypto.js';
import { appVersion } from '../install-info.js';
import { RELAY_CLIENT_ROUTING_HEADER, RELAY_CLIENT_VERSION_HEADER } from '../relay-protocol.js';

export type RoomsFetch = typeof fetch;

/** Browser `window.fetch` throws "Illegal invocation" when called
 *  unbound (assigned to a variable and invoked with `this` ≠ window);
 *  Node's fetch does not care. Wrapping keeps both happy. */
const boundFetch: RoomsFetch = (input, init) => fetch(input, init);

/** Typed transport failure; `status` is 0 for network-level errors. */
export class RoomsError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'RoomsError';
  }
}

export interface RoomUpdate {
  seq: number;
  blob: Uint8Array;
}

export interface FetchUpdatesResult {
  snapshot: { blob: Uint8Array; coversThroughSeq: number } | null;
  /** True when the server withheld the snapshot because the caller's
   *  `haveSnap` tag matched (conditional snapshot). */
  snapshotUnchanged: boolean;
  updates: RoomUpdate[];
  lastSeq: number;
  more: boolean;
  /** The room's current compaction epoch — coversThroughSeq of the
   *  stored snapshot, 0 when none. Present on every page (pre-epoch
   *  servers report 0), so a steady-state catch-up learns about a
   *  compaction without ever downloading the snapshot. */
  snapCovers: number;
}

export interface RoomsClientOptions {
  /** Relay base URL including the `/relay` prefix, re-read per request. */
  baseUrl: () => string;
  /** Bearer token, re-read per request (entitlement swap seam). */
  token: () => string;
  /** This machine's routing code, sent as X-CardMirror-Routing when the
   *  bearer is an entitlement (machine binding). ''/absent = omit the
   *  header (shared-token or self-hosted relay — nothing to bind). */
  routingCode?: () => string;
  fetchImpl?: RoomsFetch;
}

export class RoomsClient {
  /** Public: RoomStream construction reuses the same suppliers. */
  constructor(readonly opts: RoomsClientOptions) {}

  private get fetchImpl(): RoomsFetch {
    return this.opts.fetchImpl ?? boundFetch;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const routing = this.opts.routingCode?.() ?? '';
    return {
      Authorization: `Bearer ${this.opts.token()}`,
      [RELAY_CLIENT_VERSION_HEADER]: appVersion,
      ...(routing ? { [RELAY_CLIENT_ROUTING_HEADER]: routing } : {}),
      ...extra,
    };
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.opts.baseUrl()}${path}`, init);
    } catch (err) {
      throw new RoomsError(0, (err as Error).message ?? 'network error');
    }
    if (!res.ok) {
      throw new RoomsError(res.status, `rooms request failed: ${res.status}`);
    }
    return res;
  }

  /** Parse a JSON body, but fail LOUDLY and clearly when the relay hands back
   *  something that isn't JSON. A captive portal, filtering proxy, antivirus
   *  web-shield, or a misconfigured relay URL that resolves to a web app all
   *  answer with a 200 HTML page; without this the caller would surface the
   *  cryptic `Unexpected token '<', "<!DOCTYPE"... is not valid JSON`. We read
   *  the body as text FIRST (a Response body reads once), then parse, so the
   *  error message can quote the URL and the page. */
  private async readJson<T>(res: Response, path: string): Promise<T> {
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      const url = `${this.opts.baseUrl()}${path}`;
      const trimmed = text.trimStart();
      const looksHtml = /^<(?:!doctype|html|\?xml)/i.test(trimmed);
      const ctype = res.headers.get('content-type') ?? 'unknown type';
      throw new RoomsError(
        res.status,
        looksHtml
          ? `the relay returned a web page instead of session data ` +
              `(HTTP ${res.status}, ${ctype}) from ${url} — a proxy, content ` +
              `filter, or wrong relay URL is likely intercepting the connection.`
          : `the relay returned an unreadable (non-JSON) response ` +
              `(HTTP ${res.status}, ${ctype}) from ${url}.`,
      );
    }
  }

  async createRoom(): Promise<{ roomId: string; guestPass: string | null }> {
    const res = await this.request('/rooms', { method: 'POST', headers: this.headers() });
    const body = await this.readJson<{ roomId?: string; guestPass?: string }>(res, '/rooms');
    if (!body.roomId) throw new RoomsError(0, 'malformed createRoom response');
    // guestPass rides along only when the relay's guest_pass flip is on
    // (web-collab Phase 1); absence is the dormant default, not an error.
    return { roomId: body.roomId, guestPass: body.guestPass ?? null };
  }

  /** Re-mint a guest pass for a live room (host resume path). Null when
   *  the feature is off server-side (404) or the relay predates it. */
  async fetchGuestPass(roomId: string): Promise<string | null> {
    try {
      const res = await this.request(`/rooms/${roomId}/guest-pass`, {
        method: 'GET',
        headers: this.headers(),
      });
      const body = await this.readJson<{ guestPass?: string }>(res, 'guest-pass');
      return body.guestPass ?? null;
    } catch {
      return null;
    }
  }

  async postUpdate(roomId: string, blob: Uint8Array): Promise<number> {
    const path = `/rooms/${roomId}/updates`;
    const res = await this.request(path, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/octet-stream' }),
      body: blob as unknown as BodyInit,
    });
    const body = await this.readJson<{ seq?: number }>(res, path);
    if (typeof body.seq !== 'number') throw new RoomsError(0, 'malformed postUpdate response');
    return body.seq;
  }

  /** One page; loop while `more` (the session layer drives paging so it
   *  can apply between pages on huge backlogs). `opts.haveSnap` is the
   *  conditional-snapshot tag: "I already hold the snapshot covering
   *  through this seq — don't resend it if unchanged." */
  async fetchUpdates(
    roomId: string,
    after: number,
    opts: { haveSnap?: number } = {},
  ): Promise<FetchUpdatesResult> {
    const cond = opts.haveSnap !== undefined ? `&haveSnap=${opts.haveSnap}` : '';
    const path = `/rooms/${roomId}/updates?after=${after}${cond}`;
    const res = await this.request(path, {
      headers: this.headers(),
    });
    const body = await this.readJson<{
      snapshot?: { blob: string; coversThroughSeq: number };
      snapshotUnchanged?: boolean;
      snapCovers?: number;
      updates?: Array<{ seq: number; blob: string }>;
      lastSeq?: number;
      more?: boolean;
    }>(res, path);
    const snapshot = body.snapshot
      ? { blob: base64ToBytes(body.snapshot.blob), coversThroughSeq: body.snapshot.coversThroughSeq }
      : null;
    return {
      snapshot,
      snapshotUnchanged: body.snapshotUnchanged === true,
      updates: (body.updates ?? []).map((u) => ({ seq: u.seq, blob: base64ToBytes(u.blob) })),
      lastSeq: body.lastSeq ?? after,
      more: body.more === true,
      // Pre-epoch servers omit the field; fall back to what the embedded
      // snapshot itself reveals so callers get a best-effort tag.
      snapCovers: body.snapCovers ?? snapshot?.coversThroughSeq ?? 0,
    };
  }

  async postSnapshot(roomId: string, blobB64: string, coversThroughSeq: number): Promise<void> {
    await this.request(`/rooms/${roomId}/snapshot`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ blob: blobB64, coversThroughSeq }),
    });
  }

  /** `from` = the sender's own stream sid (see RoomStreamOptions.sid):
   *  the server skips echoing this frame back to that stream. Old
   *  servers ignore the param; the client-side own-peer filter still
   *  drops the echo, so behavior is identical either way. */
  async postPresence(roomId: string, blob: Uint8Array, from?: string): Promise<void> {
    const q = from ? `?from=${encodeURIComponent(from)}` : '';
    await this.request(`/rooms/${roomId}/presence${q}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/octet-stream' }),
      body: blob as unknown as BodyInit,
    });
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.request(`/rooms/${roomId}`, { method: 'DELETE', headers: this.headers() });
  }
}

// --- SSE stream ---

export interface RoomStreamCallbacks {
  /** Connected; `lastSeq` is the server's cursor at connect time. The
   *  caller runs its catch-up fetch from its OWN cursor — hello's value
   *  is informational (a quick "am I behind?" check). */
  onHello: (lastSeq: number) => void;
  onUpdate: (update: RoomUpdate) => void;
  onPresence: (blob: Uint8Array) => void;
  /** Session ended (server tombstone or live `end` frame). Terminal. */
  onEnded: () => void;
  /** Room at participant capacity (409). Terminal. */
  onFull: () => void;
  /** A previously-connected stream dropped; reconnection with backoff
   *  is already underway. Lets the session mark itself offline instead
   *  of discovering the outage on the next failed send. */
  onDown?: () => void;
}

export interface RoomStreamOptions {
  baseUrl: () => string;
  token: () => string;
  /** See RoomsClientOptions.routingCode. */
  routingCode?: () => string;
  roomId: string;
  /** Opaque per-session nonce identifying THIS client's stream to the
   *  server, so presence posts carrying the same value as `from` are
   *  not echoed back (the client filters its own frames anyway — this
   *  just stops the bytes). Optional; old servers ignore it. */
  sid?: string;
  callbacks: RoomStreamCallbacks;
  fetchImpl?: RoomsFetch;
  /** Backoff bounds, injectable for tests. */
  minBackoffMs?: number;
  maxBackoffMs?: number;
}

export class RoomStream {
  private controller: AbortController | null = null;
  private stopped = true;
  private backoffMs: number;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private helloed = false;
  private everHelloed = false;

  constructor(private readonly opts: RoomStreamOptions) {
    this.backoffMs = opts.minBackoffMs ?? 1000;
  }

  get running(): boolean {
    return !this.stopped;
  }

  /** True while the current connection has received its hello (i.e.
   *  live push delivery is actually flowing). */
  get connected(): boolean {
    return !this.stopped && this.helloed;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.backoffMs = this.opts.minBackoffMs ?? 1000;
    void this.connectLoop();
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.controller?.abort();
    this.controller = null;
  }

  /** Abort and reconnect promptly — wake-from-sleep, network change,
   *  where the current socket may be silently dead. NOT for "the relay
   *  is reachable, hurry up": that is `nudge()` — aborting an in-flight
   *  attempt from a send-success loop kills every handshake before its
   *  hello, and the stream never connects while the user types. */
  restart(): void {
    if (this.stopped) return;
    this.backoffMs = this.opts.minBackoffMs ?? 1000;
    if (this.retryTimer !== null) {
      // Sitting out a backoff wait — wake-from-sleep must not serve the
      // remainder of a pre-sleep delay before reconnecting (audit find,
      // 2026-07-10). Connect now.
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
      void this.connectLoop();
      return;
    }
    this.controller?.abort();
  }

  /** Gentle hurry-up: if a backoff wait is pending, connect now; if an
   *  attempt is already in flight (or connected), do nothing. */
  nudge(): void {
    if (this.stopped || this.helloed) return;
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
      this.backoffMs = this.opts.minBackoffMs ?? 1000;
      void this.connectLoop();
    }
  }

  private scheduleRetry(): void {
    if (this.stopped) return;
    if (this.helloed) {
      this.helloed = false;
      this.opts.callbacks.onDown?.();
    }
    const max = this.opts.maxBackoffMs ?? 60_000;
    // ±30% jitter so a fleet doesn't reconnect in lockstep.
    const jitter = 0.7 + Math.random() * 0.6;
    const delay = Math.min(this.backoffMs, max) * jitter;
    this.backoffMs = Math.min(this.backoffMs * 2, max);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connectLoop();
    }, delay);
  }

  private dispatchFrame(eventName: string, dataText: string): void {
    if (eventName === 'hello') {
      this.backoffMs = this.opts.minBackoffMs ?? 1000;
      this.helloed = true;
      this.everHelloed = true;
      let lastSeq = 0;
      try {
        const parsed = JSON.parse(dataText || '{}') as { lastSeq?: number };
        if (typeof parsed.lastSeq === 'number') lastSeq = parsed.lastSeq;
      } catch {
        /* malformed hello data — treat as 0 */
      }
      this.opts.callbacks.onHello(lastSeq);
      return;
    }
    if (!dataText) return;
    try {
      const frame = JSON.parse(dataText) as { t?: string; seq?: number; blob?: string };
      if (frame.t === 'u' && typeof frame.seq === 'number' && typeof frame.blob === 'string') {
        this.opts.callbacks.onUpdate({ seq: frame.seq, blob: base64ToBytes(frame.blob) });
      } else if (frame.t === 'p' && typeof frame.blob === 'string') {
        this.opts.callbacks.onPresence(base64ToBytes(frame.blob));
      } else if (frame.t === 'end') {
        this.stopped = true;
        this.opts.callbacks.onEnded();
      }
    } catch {
      console.warn('[room-stream] undecodable frame; ignoring');
    }
  }

  private async connectLoop(): Promise<void> {
    if (this.stopped) return;
    this.controller = new AbortController();
    const fetchImpl = this.opts.fetchImpl ?? boundFetch;
    try {
      const sidQ = this.opts.sid ? `?sid=${encodeURIComponent(this.opts.sid)}` : '';
      const routing = this.opts.routingCode?.() ?? '';
      const res = await fetchImpl(`${this.opts.baseUrl()}/rooms/${this.opts.roomId}/stream${sidQ}`, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${this.opts.token()}`,
          [RELAY_CLIENT_VERSION_HEADER]: appVersion,
          ...(routing ? { [RELAY_CLIENT_ROUTING_HEADER]: routing } : {}),
        },
        signal: this.controller.signal,
      });
      if (res.status === 410 || res.status === 404) {
        // Tombstoned (or GC'd all the way to gone): the session is over.
        this.stopped = true;
        this.opts.callbacks.onEnded();
        return;
      }
      if (res.status === 409) {
        // On a FIRST join, full means full — terminal. On a RECONNECT,
        // the count may include our own not-yet-reaped ghost connection
        // from the drop; the server clears those within a heartbeat
        // cycle, so retry instead of ending an established session.
        if (!this.everHelloed) {
          this.stopped = true;
          this.opts.callbacks.onFull();
          return;
        }
        this.scheduleRetry();
        return;
      }
      if (!res.ok || !res.body) {
        this.scheduleRetry();
        return;
      }

      // SSE grammar: lines to a blank line make one event; `:` comments
      // (heartbeats) are dropped. getReader() rather than for-await —
      // browser ReadableStream is not async-iterable everywhere.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let eventName = '';
      let dataLines: string[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).replace(/\r$/, '');
          buf = buf.slice(nl + 1);
          if (line === '') {
            this.dispatchFrame(eventName, dataLines.join('\n'));
            eventName = '';
            dataLines = [];
            if (this.stopped) return;
          } else if (line.startsWith(':')) {
            continue;
          } else if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart());
          }
        }
      }
      // Server closed (deploy, idle reap) — reconnect.
      this.scheduleRetry();
    } catch (err) {
      if (this.stopped) return;
      if ((err as Error).name !== 'AbortError') {
        console.warn('[room-stream] stream error:', (err as Error).message ?? err);
      }
      this.scheduleRetry();
    }
  }
}
