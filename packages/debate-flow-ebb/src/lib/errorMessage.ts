/**
 * The human-readable text behind a thrown value.
 *
 * Tauri's `invoke` rejects with the plain string a command returned in its
 * `Err`, not an `Error`, so an `err instanceof Error` check silently discards
 * every diagnostic Rust took the trouble to write and leaves the user staring
 * at a generic fallback. Both shapes reach the same catch blocks here, so both
 * have to be handled in one place.
 */
export function errorMessage(err: unknown, fallback: string): string {
    if (typeof err === "string" && err.trim()) return err;
    if (err instanceof Error && err.message.trim()) return err.message;
    return fallback;
}
