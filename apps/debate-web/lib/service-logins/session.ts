/**
 * @fileoverview A signed-in session to an outside service (Tabroom,
 * openCaselist) kept alive from a stored username and password.
 *
 * Every request reuses the stored session token. The service is logged into
 * again only when that token is known to have expired or the service rejects
 * it (401/403), and never in a loop:
 *
 * - **Single flight.** Concurrent requests that all need a login share one
 *   in-flight login per isolate.
 * - **Cross-isolate reuse.** Before logging in after a rejection, the store is
 *   read again: another isolate may already have saved a fresh token.
 * - **Retry once.** A rejected request is retried once with the new token.
 * - **No re-login for a fresh token.** A token minted less than
 *   `minReloginIntervalMs` ago that is rejected is not replaced: the service
 *   is refusing that endpoint, not the session.
 * - **Cooldown.** After a failed login no login is attempted for
 *   `cooldownMs`, doubling with each consecutive failure up to
 *   `maxCooldownMs`; the failure is stored so the admin panel shows it.
 *
 * Storage, the login call and the clock are injected, so this file has no
 * Worker or D1 dependency.
 *
 * @module lib/service-logins/session
 */

/** What the store holds for one service, with secrets already decrypted. */
export interface StoredServiceLogin {
  username: string | null;
  password: string | null;
  token: string | null;
  /** When the token expires (ms), when the service said so. */
  tokenExpiresAt: number | null;
  lastLoginAt: number | null;
  lastFailureAt: number | null;
  failureCount: number;
  lastError: string | null;
}

export interface ServiceLoginStore {
  load(): Promise<StoredServiceLogin | null>;
  /** Saves a fresh token and clears the failure count. */
  saveToken(token: string, expiresAt: number | null, at: number): Promise<void>;
  saveFailure(error: string, at: number, failureCount: number): Promise<void>;
}

export interface LoginResult {
  token: string;
  expiresAt: number | null;
}

export type LoginFn = (username: string, password: string) => Promise<LoginResult>;

export interface ServiceSessionOptions {
  /** Shown in errors: "Tabroom", "openCaselist". */
  label: string;
  store: ServiceLoginStore;
  login: LoginFn;
  /** Sets the session on an outgoing request's headers. */
  applyToken: (headers: Headers, token: string) => void;
  /** A static token (the env secret) used when no stored session is available. */
  fallbackToken?: () => string | null | undefined;
  now?: () => number;
  /** First wait after a failed login. Default 5 minutes. */
  cooldownMs?: number;
  /** Longest wait after repeated failures. Default 1 hour. */
  maxCooldownMs?: number;
  /** A token this young that is rejected is not replaced. Default 2 minutes. */
  minReloginIntervalMs?: number;
  /** How long a token read from the store is trusted before reading it again. Default 5 minutes. */
  cacheMs?: number;
  /** Treat a token as expired this long before its stated expiry. Default 1 minute. */
  expirySkewMs?: number;
  fetchImpl?: typeof fetch;
}

/** Thrown by {@link ServiceSession.signIn} when the service refuses the login. */
export class ServiceLoginError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ServiceLoginError";
  }
}

const MINUTE = 60_000;

export function isAuthRejection(status: number): boolean {
  return status === 401 || status === 403;
}

/** How long after `failureCount` consecutive failed logins the next one may run. */
export function loginCooldownMs(failureCount: number, cooldownMs = 5 * MINUTE, maxCooldownMs = 60 * MINUTE): number {
  if (failureCount <= 0) return 0;
  return Math.min(cooldownMs * 2 ** Math.min(failureCount - 1, 20), maxCooldownMs);
}

interface Cached {
  record: StoredServiceLogin | null;
  readAt: number;
}

export class ServiceSession {
  private readonly now: () => number;
  private readonly cooldownMs: number;
  private readonly maxCooldownMs: number;
  private readonly minReloginIntervalMs: number;
  private readonly cacheMs: number;
  private readonly expirySkewMs: number;
  private cached: Cached | null = null;
  private inflight: Promise<string | null> | null = null;

  constructor(private readonly options: ServiceSessionOptions) {
    this.now = options.now ?? Date.now;
    this.cooldownMs = options.cooldownMs ?? 5 * MINUTE;
    this.maxCooldownMs = options.maxCooldownMs ?? 60 * MINUTE;
    this.minReloginIntervalMs = options.minReloginIntervalMs ?? 2 * MINUTE;
    this.cacheMs = options.cacheMs ?? 5 * MINUTE;
    this.expirySkewMs = options.expirySkewMs ?? MINUTE;
  }

  /** Forgets the cached record, so the next call reads the store (after an admin saves new credentials). */
  reset(): void {
    this.cached = null;
  }

  private async read(force = false): Promise<StoredServiceLogin | null> {
    const now = this.now();
    if (!force && this.cached && now - this.cached.readAt < this.cacheMs) return this.cached.record;
    const record = await this.options.store.load();
    this.cached = { record, readAt: now };
    return record;
  }

  private hasLogin(record: StoredServiceLogin | null): record is StoredServiceLogin & { username: string; password: string } {
    return Boolean(record?.username && record.password);
  }

  private expired(record: StoredServiceLogin): boolean {
    return record.tokenExpiresAt != null && this.now() >= record.tokenExpiresAt - this.expirySkewMs;
  }

  private usable(record: StoredServiceLogin | null): string | null {
    return record?.token && !this.expired(record) ? record.token : null;
  }

  /** Whether a username and password are saved; `false` when the store can't be read. */
  async hasSavedLogin(): Promise<boolean> {
    try {
      return this.hasLogin(await this.read());
    } catch {
      return false;
    }
  }

  /** Milliseconds until a login may be tried again; 0 when it may now. */
  retryAfterMs(record: StoredServiceLogin | null): number {
    if (!record?.lastFailureAt || record.failureCount <= 0) return 0;
    const wait = loginCooldownMs(record.failureCount, this.cooldownMs, this.maxCooldownMs);
    return Math.max(0, record.lastFailureAt + wait - this.now());
  }

  private fallback(except?: string | null): string | null {
    const token = this.options.fallbackToken?.()?.trim() || null;
    return token && token !== except ? token : null;
  }

  /**
   * Logs in, sharing one in-flight login across callers. Respects the cooldown
   * unless `force`. Never rejects: a failure resolves `null` and is stored.
   */
  private loginOnce(record: StoredServiceLogin & { username: string; password: string }, force: boolean): Promise<string | null> {
    if (this.inflight) return this.inflight;
    if (!force && this.retryAfterMs(record) > 0) return Promise.resolve(null);
    const run = (async () => {
      const at = this.now();
      let result: LoginResult;
      try {
        result = await this.options.login(record.username, record.password);
        if (!result.token) throw new ServiceLoginError(`${this.options.label} login returned no session token.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failureCount = record.failureCount + 1;
        await this.options.store.saveFailure(message, at, failureCount).catch(() => {});
        this.cached = { record: { ...record, lastFailureAt: at, failureCount, lastError: message }, readAt: this.now() };
        return null;
      }
      await this.options.store.saveToken(result.token, result.expiresAt, at).catch(() => {});
      this.cached = {
        record: { ...record, token: result.token, tokenExpiresAt: result.expiresAt, lastLoginAt: at, lastFailureAt: null, failureCount: 0, lastError: null },
        readAt: this.now(),
      };
      return result.token;
    })();
    this.inflight = run;
    const clear = () => {
      if (this.inflight === run) this.inflight = null;
    };
    run.then(clear, clear);
    return run;
  }

  /** The token to send: the stored one, a fresh login when it has expired, else the fallback. */
  async token(): Promise<string | null> {
    let record: StoredServiceLogin | null;
    try {
      record = await this.read();
    } catch {
      return this.fallback();
    }
    const stored = this.usable(record);
    if (stored) return stored;
    if (this.hasLogin(record)) {
      const minted = await this.loginOnce(record, false);
      if (minted) return minted;
    }
    return this.fallback();
  }

  /**
   * A replacement for a token the service just rejected, or `null` when there
   * is none worth retrying with.
   */
  async refresh(rejected: string | null): Promise<string | null> {
    if (this.inflight) return this.inflight.then((token) => (token && token !== rejected ? token : this.fallback(rejected)));
    let record: StoredServiceLogin | null;
    try {
      record = await this.read(true);
    } catch {
      return this.fallback(rejected);
    }
    const stored = this.usable(record);
    if (stored && stored !== rejected) return stored;
    if (this.hasLogin(record)) {
      const fresh = record.token === rejected && record.lastLoginAt != null && this.now() - record.lastLoginAt < this.minReloginIntervalMs;
      if (!fresh) {
        const minted = await this.loginOnce(record, false);
        if (minted && minted !== rejected) return minted;
      }
    }
    return this.fallback(rejected);
  }

  /** Logs in now, ignoring the cooldown (the admin panel's Save and Sign in again). */
  async signIn(): Promise<LoginResult> {
    const record = await this.read(true);
    if (!this.hasLogin(record)) throw new ServiceLoginError(`No ${this.options.label} login is saved.`);
    if (this.inflight) await this.inflight;
    const token = await this.loginOnce(record, true);
    if (!token) throw new ServiceLoginError(this.cached?.record?.lastError || `${this.options.label} login failed.`);
    return { token, expiresAt: this.cached?.record?.tokenExpiresAt ?? null };
  }

  /** `fetch` signed in as the session; a rejected request is retried once with a fresh token. */
  readonly fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const send = (token: string | null) => {
      const headers = new Headers(init?.headers);
      if (token) this.options.applyToken(headers, token);
      return fetchImpl(input, { ...init, headers });
    };
    const token = await this.token();
    const response = await send(token);
    if (!isAuthRejection(response.status)) return response;
    const next = await this.refresh(token);
    if (!next || next === token) return response;
    await response.body?.cancel().catch(() => {});
    return send(next);
  };
}
