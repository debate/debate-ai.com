/**
 * @fileoverview Strips secret fields out of a `/doc` File Sources record
 * before it is allowed to leave this browser.
 *
 * `apps/debate-ai.com/components/qwksearch/lib/file-sources.ts`'s
 * `REASON-file-sources` store has the exact shape `TOOL_RECORD_COLLECTIONS`
 * requires — a JSON array under one `localStorage` key, each record keyed by
 * a stable `id` — but a source's `credentials` can carry a plaintext SSH
 * password or private key, an S3/R2/B2 secret access key, or a Google OAuth
 * refresh token (`fileSource-types.ts`'s `SSHCredentials`, `S3Credentials`,
 * `R2Credentials`, `B2Credentials` and `GoogleDocsCredentials`). The generic
 * `/api/tool-records/[collection]` route stores whatever JSON it's handed
 * verbatim, with no field-level redaction of its own, so syncing this
 * collection like any other would put those secrets into the shared
 * `saved_tool_records` table unencrypted.
 *
 * `redactFileSource` is this collection's `ToolRecordCollection.redact`:
 * applied at every push (the immediate mirror, the auto-sync watcher, and the
 * first-sign-in push of local-only records — see `tool-record-mirror.ts` and
 * `tool-record-auto-sync.ts`), never to what a tool reads back out of its own
 * `localStorage`. A source's connection details (host, bucket, region, the
 * account it's named after, …) sync so the list itself follows you to another
 * device; what would let someone connect to that backend does not, so a
 * signed-in device you didn't configure the source on shows the entry and
 * needs the secret re-entered before it can be used.
 *
 * An **allowlist** per source type, not a blocklist of secret-looking field
 * names: a credential field added to `fileSource-types.ts` later defaults to
 * held-back rather than defaulting to synced.
 *
 * @module state/redact-file-source
 */

/** The `credentials` fields safe to leave this browser, per `FileSourceType`. */
const SAFE_CREDENTIAL_FIELDS: Record<string, readonly string[]> = {
  local: [],
  // host/port/username/basePath describe where and how to connect; password,
  // privateKey and passphrase are what would let someone else do it.
  ssh: ["host", "port", "username", "basePath"],
  // region/bucket/endpoint/basePath name the bucket; accessKeyId and
  // secretAccessKey are the key pair that opens it.
  s3: ["region", "bucket", "endpoint", "basePath"],
  r2: ["accountId", "bucket", "basePath"],
  b2: ["bucket", "endpoint", "basePath"],
  // email/folderIds/isAuthenticated describe the connection; accessToken and
  // refreshToken are what Google's API would accept as this user.
  gdocs: ["email", "folderIds", "isAuthenticated"],
  turso: ["endpoint", "database", "enableGoogleDocsSync"],
};

/**
 * Redacts one File Sources record for sync — a `ToolRecordCollection.redact`.
 *
 * Untyped (`unknown` in, `unknown` out) on purpose: this is `debate-data-sync`
 * code, a leaf package that does not import the app's `fileSource-types.ts`
 * (see `toolRecordCollections.ts`'s own module doc on why the catalog reads a
 * tool's store without importing that tool's package). A record that isn't a
 * plain object, or whose `credentials` isn't one, is returned unchanged —
 * there is nothing shaped like a secret to hold back, and returning the input
 * rather than guessing keeps a malformed record's `id` and other fields
 * intact for {@link isSyncableToolRecord} and the merge.
 *
 * @param record - A local File Sources record, about to be pushed.
 * @returns The same record, with any unsafe `credentials` field dropped.
 */
export function redactFileSource(record: unknown): unknown {
  if (typeof record !== "object" || record === null || Array.isArray(record)) return record;
  const { credentials, ...rest } = record as Record<string, unknown>;
  if (typeof credentials !== "object" || credentials === null || Array.isArray(credentials)) {
    return record;
  }

  const type = (rest as { type?: unknown }).type;
  const safeFields = typeof type === "string" ? SAFE_CREDENTIAL_FIELDS[type] : undefined;
  // An unrecognized (or future) source type holds back every credential
  // field rather than guessing which of them are safe.
  if (!safeFields) return { ...rest, credentials: {} };

  const safeCredentials: Record<string, unknown> = {};
  for (const field of safeFields) {
    if (field in credentials) safeCredentials[field] = (credentials as Record<string, unknown>)[field];
  }
  return { ...rest, credentials: safeCredentials };
}
