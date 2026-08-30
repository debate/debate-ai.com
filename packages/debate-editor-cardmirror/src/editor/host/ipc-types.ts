/**
 * Wire-shape data types shared between web-only backends and the (removed)
 * Electron IPC bridge, kept independent of any host implementation so
 * they survive without a build-time dependency on desktop code.
 *
 * These were originally declared in `electron-host.ts`, which this
 * web-only build (debate-editor-cardmirror, embedded in debate-ai.com)
 * dropped — pulled out here because `bulk-compress-ui.ts` and
 * `pairing/web-mailbox.ts` need the shapes for their own (web) backends.
 */

export interface PairingConfigIpc {
  /** Whether the receive channel should run. */
  enabled: boolean;
  /** Optional name stamped (inside the ciphertext) on outgoing cards. */
  displayName: string;
  /** App version, for the cross-version guard. */
  schemaVersion: string;
  /** Compatibility floor stamped on cards this build sends — the minimum
   *  receiver version that can read them. Blank = any version may receive. */
  minReceiverVersion?: string;
  /** Poll cadence in seconds (fallback polling against legacy relays;
   *  floored to 5 min as the catch-up cadence while push-streaming). */
  pollSeconds: number;
  /** Self-hosted relay base URL ('' = the official relay). */
  relayUrl?: string;
  /** Bearer for a self-hosted relay ('' = the baked official token). */
  relayToken?: string;
}

export interface PairingSendItemIpc {
  label: string;
  type: string;
  sliceJson: unknown;
}

export interface PairingSendIpc {
  recipientCodes: string[];
  item: PairingSendItemIpc;
  via?: string;
  /** Per-message compatibility floor override (session invites carry the
   *  first invite-aware version; cards keep the config-level floor). */
  minReceiverVersion?: string;
}

export interface PairingInboxItemIpc {
  id: string;
  label: string;
  type: string;
  sliceJson: unknown;
  senderName: string;
  senderCode: string;
  via?: string;
  receivedAt: number;
  read: boolean;
}

export interface BulkCompressSummary {
  total: number;
  compressed: number;
  skipped: number;
  failed: number;
  bytesBefore: number;
  bytesAfter: number;
}

/** Throttled progress during a bulk-compress run (`done` of `total`). */
export interface BulkCompressProgress extends BulkCompressSummary {
  done: number;
}
