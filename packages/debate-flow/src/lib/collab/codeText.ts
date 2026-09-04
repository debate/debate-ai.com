/**
 * How a pairing code reads on screen and in a field.
 *
 * Presentation only. What a code means is derived in the shell and nowhere
 * else, and the shell is what accepts or refuses one; this decides where the
 * dash goes and whether a button is worth enabling yet.
 */

/** Crockford base32: no I, L, O or U, so nothing has to be spelled out aloud. */
const CODE_CHARS = /^[0-9A-HJKMNP-TV-Z]{8}$/;
const CODE_LEN = 8;

/** Whatever a debater typed, with the spacing and the case taken back off. */
export function bareCode(raw: string): string {
    return raw.replace(/[-\s]/g, "").toUpperCase();
}

/** Two groups of four, which is how a code is read out loud. */
export function groupCode(code: string): string {
    const flat = bareCode(code);
    return flat.length === CODE_LEN ? `${flat.slice(0, 4)}-${flat.slice(4)}` : flat;
}

/**
 * Whether this could be a code at all. A cheap check for a disabled button,
 * never an authorization: the shell derives the endpoint and is what refuses a
 * code that is merely well formed.
 */
export function looksLikeCode(raw: string): boolean {
    return CODE_CHARS.test(bareCode(raw));
}
