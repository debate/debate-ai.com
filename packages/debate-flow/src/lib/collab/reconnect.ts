/**
 * Getting a dropped peer back, without saying anything about it.
 *
 * A dropped link costs nothing: both peers hold the full round on their own
 * disk, and the version vector recovers whatever the gap swallowed. So a
 * reconnect is not an event a debater needs to act on, and the corner chip is
 * the only surface it ever gets.
 */

/** A blink costs one short delay. */
const BACKOFF_BASE_MS = 500;
/** A long outage still retries on a human cadence. */
export const BACKOFF_CEILING_MS = 30_000;

/**
 * Exponential with full jitter. The jitter matters when a venue's wifi drops
 * every peer at once: without it they would all retry on the same tick and
 * collide again.
 */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
    const window = Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_CEILING_MS);
    // Half fixed, half jittered, so a delay is never effectively zero.
    return Math.round(window / 2 + random() * (window / 2));
}

export interface RetryDeps {
    /** Resolves when the peer is back. Rejecting is ordinary. */
    dial(): Promise<void>;
    schedule(fn: () => void, ms: number): () => void;
    random?: () => number;
}

/**
 * Dials until it succeeds, then stops. The caller re-arms on the next drop,
 * which is what resets the backoff: a second outage starts short again rather
 * than at the ceiling the first one climbed to.
 *
 * Returns the call that stops it, the same shape `schedule` hands back for a
 * delay that has not fired yet.
 */
export function retryForever(deps: RetryDeps): () => void {
    const random = deps.random ?? Math.random;
    let attempt = 0;
    let cancel: (() => void) | null = null;
    let stopped = false;

    function arm(): void {
        if (stopped) return;
        cancel = deps.schedule(
            () => {
                cancel = null;
                if (stopped) return;
                deps.dial().then(
                    () => {
                        // Back. Nothing to announce and nothing to schedule.
                    },
                    () => {
                        attempt += 1;
                        arm();
                    },
                );
            },
            backoffMs(attempt, random),
        );
    }
    arm();

    return () => {
        stopped = true;
        cancel?.();
        cancel = null;
    };
}
