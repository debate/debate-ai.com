/**
 * Recovery from a build that no longer exists.
 *
 * Client chunks are content-hashed (`/_next/static/chunks/<name>-<hash>.js`)
 * and a deploy replaces the whole set. A tab that was open across a deploy is
 * therefore running a module graph whose remaining lazy chunks 404 the moment
 * the router reaches for them — and the bindings they were supposed to supply
 * come back null. What surfaces is not a recognisable "chunk load error" but
 * whatever the next component does with a null import, which is why this is
 * NOT gated on the error message: the real one seen in production was
 *
 *   TypeError: Cannot read properties of null (reading 'useRef')
 *
 * thrown out of a loader component, because the React namespace itself was the
 * null binding. There is no message to match on that a different stale-build
 * failure wouldn't phrase differently.
 *
 * `reset()` cannot fix any of that — it re-renders the same dead graph. Only a
 * document reload can, and it is cheap: the service worker serves documents
 * network-first (see lib/offline-sw/service-worker.ts), so the reload picks up
 * the current HTML and with it the current chunk hashes.
 *
 * The cooldown is what makes "reload on any root-layout error" safe. A build
 * that is broken for everyone would otherwise reload forever; instead a tab
 * gets one attempt, and a failure that comes straight back falls through to
 * the error UI. It expires rather than being cleared on a healthy render, so
 * a tab left open across two separate deploys still recovers from the second
 * without the app having to report its own health from anywhere.
 */

export const STALE_BUILD_RELOAD_KEY = "debate-ai:stale-build-reload";

/** How long a recorded attempt suppresses the next one. A reload loop comes
 *  back within a second or two; the next deploy a long-lived tab sees is
 *  minutes or hours away, so this separates them with room to spare. */
export const STALE_BUILD_RELOAD_COOLDOWN_MS = 30_000;

/** The slice of `sessionStorage` this needs — narrowed so tests can pass a
 *  plain object, including ones that throw the way a privacy mode does. */
export interface ReloadAttemptStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Whether this tab should reload to recover, recording the attempt when it
 * should. A `true` is consumed by the caller reloading — calling again inside
 * the cooldown returns false, which is the loop guard.
 *
 * Storage access throws in some privacy modes. An unavailable store is a
 * reason to be conservative rather than to risk a loop with no way to record
 * the attempt, so both a failed read and a failed write decline.
 */
export function shouldReloadForStaleBuild(
  store: ReloadAttemptStore | undefined,
  now: number = Date.now(),
): boolean {
  if (!store) return false;
  try {
    const previous = Number.parseInt(store.getItem(STALE_BUILD_RELOAD_KEY) ?? "", 10);
    // A non-numeric or future-dated marker (a clock change, or something else
    // writing the key) is treated as "no usable record" rather than trusted:
    // the cooldown is a safety rail, and a stuck one disables recovery.
    const withinCooldown =
      Number.isFinite(previous) && previous <= now && now - previous < STALE_BUILD_RELOAD_COOLDOWN_MS;
    if (withinCooldown) return false;
    store.setItem(STALE_BUILD_RELOAD_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}
