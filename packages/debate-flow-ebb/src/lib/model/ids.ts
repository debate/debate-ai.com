/**
 * uid(prefix?) → unique identifier string.
 *
 * Format: `${prefix}_${base36-timestamp}_${base36-random}`
 * If no prefix is provided, "id" is used as the default prefix.
 *
 * Examples:
 *   uid()         → "id_lk3x9_4f2"
 *   uid('node')   → "node_lk3x9_4f3"
 */
export function uid(prefix: string = "id"): string {
    const time = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 7);
    return `${prefix}_${time}_${rand}`;
}
