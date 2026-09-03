/**
 * Constants shared by every client that talks to the relay — the main
 * process (card sharing, `pairing-ipc.ts`) and the renderer (co-editing,
 * `collab/room-client.ts`) alike.
 *
 * Deliberately dependency-free: this module is imported into BOTH the
 * Electron main bundle and the renderer bundle, so it must not pull in
 * `getHost()`, the DOM, or anything Electron.
 */

/**
 * Header naming the CardMirror build behind a relay request.
 *
 * Sent on every relay call so the server can tell versions apart. It is
 * advisory only — relays that don't know the header ignore it, which is
 * why the client can start sending it well before any relay reads it.
 * Custom request headers are preflighted by browsers for the web
 * edition, but every relay implementation allows them (`allow_headers`
 * is the wildcard in all three), and the existing `Authorization`
 * header already proves that path works.
 *
 * NOTE for a future minimum-version gate: absence of this header means
 * the client predates it, NOT that the request is anonymous — every
 * build shipped before this header existed will send nothing at all.
 */
export const RELAY_CLIENT_VERSION_HEADER = 'X-CardMirror-Version';

/**
 * Header carrying this machine's routing code (the public sha256 hash of
 * its pairing key) on relay requests authenticated with an ENTITLEMENT.
 *
 * Entitlement JWTs are bearer tokens minted per machine (`/connect`
 * binds them to a routing code in their `rc` claim), but nothing at
 * request time proved the presenter WAS that machine — a copied token
 * file worked from anywhere. When the relay's machine-binding toggle is
 * on, gated requests must carry this header matching the token's claim.
 * Sent only when the effective bearer is an entitlement: shared-token
 * and self-hosted requests have no `rc` to match and omit it.
 */
export const RELAY_CLIENT_ROUTING_HEADER = 'X-CardMirror-Routing';

/**
 * First app version that seeds co-editing rooms with movable-list
 * children (identity-preserving moves; strict exactly-once under
 * concurrent same-card moves — fuzz-proven). The binding's per-room
 * inheritance keeps every room homogeneous, so this constant does two
 * jobs: builds >= it seed NEW rooms movable, and invites to movable
 * rooms carry it as their compatibility floor so older builds decline
 * cleanly instead of joining a room they cannot read.
 */
export const MOVABLE_ROOMS_MIN_VERSION = '1.0.0';

/**
 * Prerelease-aware version compare for CardMirror's version shapes
 * (`X.Y.Z`, `X.Y.Z-alpha.N`, `-beta.N`, `-rc.N`). Returns <0, 0, >0.
 * A release outranks its own prereleases; unknown prerelease labels
 * rank with beta; unparseable strings rank lowest (a garbled version
 * must never unlock version-gated behavior).
 */
export function compareAppVersions(a: string, b: string): number {
  const key = (v: string): number[] => {
    const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v.trim());
    if (!m) return [-1, 0, 0, 0, 0, 0];
    const core = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (!m[4]) return [...core, 1, 0, 0];
    const parts = m[4].split('.');
    const rank = { alpha: 0, beta: 1, rc: 2 }[parts[0]!.toLowerCase() as 'alpha'] ?? 1;
    const num = parts[1] && /^\d+$/.test(parts[1]) ? Number(parts[1]) : 0;
    return [...core, 0, rank, num];
  };
  const ka = key(a);
  const kb = key(b);
  for (let i = 0; i < 6; i++) {
    if (ka[i]! !== kb[i]!) return ka[i]! - kb[i]!;
  }
  return 0;
}
