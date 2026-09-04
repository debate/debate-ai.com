/**
 * Fractional indexes for cells inside one column.
 *
 * A rank is a base-62 fraction. It is immutable, so an insert never renumbers
 * a neighbour, and two peers that insert at one position concurrently keep
 * both cells in a deterministic order. Ranks sort as plain strings, and no
 * rank ends in the zero digit, which is the invariant the subdivision relies
 * on to always find room.
 */

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = DIGITS.length;
/** Seed width in digits. Holds more than a billion rows. */
const SEED_WIDTH = 6;
/** Gap left between two seeded rows, in rank units. */
const SEED_STEP = 32;
/**
 * The longest rank this build will order. Nested inserts at one position add
 * about one digit per five, so a column would need thousands of them to reach
 * this, and `midpoint` recurses once per digit: a rank a peer made long enough
 * exhausts the stack on the victim's next insert there.
 */
const MAX_RANK = 1024;
/** The base-62 alphabet above, as the shape a whole rank has to be. */
const RANK_DIGITS = /^[0-9A-Za-z]+$/;

function encodeFixedWidth(value: number): string {
    let out = "";
    let left = value;
    for (let i = 0; i < SEED_WIDTH; i++) {
        out = DIGITS[left % BASE] + out;
        left = Math.floor(left / BASE);
    }
    if (left > 0) throw new Error(`rank overflow at ${value}`);
    return out;
}

/**
 * The rank a row gets when a replica is seeded from a file. Both peers run
 * this, so a round opened on two machines merges correctly on first contact
 * with no communication.
 *
 * The trailing `+ 1` keeps every seed odd. 62 is even, so an odd value is
 * never a multiple of it, which is how the no-trailing-zero invariant holds
 * for every row.
 */
export function seedRank(index: number): string {
    return encodeFixedWidth((index + 1) * SEED_STEP + 1);
}

function midpoint(a: string, b: string | null): string {
    if (b !== null && a >= b) throw new Error(`rankBetween: ${a} is not below ${b}`);
    if (a.endsWith("0") || (b !== null && b.endsWith("0"))) {
        throw new Error("rankBetween: a rank never ends in the zero digit");
    }
    if (b !== null) {
        let n = 0;
        while ((a[n] ?? "0") === b[n]) n++;
        if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
    }
    const digitA = a ? DIGITS.indexOf(a[0]) : 0;
    const digitB = b !== null ? DIGITS.indexOf(b[0]) : BASE;
    if (digitB - digitA > 1) return DIGITS[Math.round(0.5 * (digitA + digitB))];
    // The two leading digits are adjacent, so the answer needs another digit.
    if (b !== null && b.length > 1) return b.slice(0, 1);
    return DIGITS[digitA] + midpoint(a.slice(1), null);
}

/** A rank strictly between two live neighbours. `null` means no neighbour. */
export function rankBetween(before: string | null, after: string | null): string {
    return midpoint(before ?? "", after);
}

/**
 * A rank this build can order.
 *
 * A cell's rank arrives inside a peer's document, and `midpoint` asserts the
 * invariants above by throwing rather than by repairing: a rank ending in the
 * zero digit refuses every later insert in that column, mid-keystroke, and the
 * replica would carry it across a restart. So a peer's cell is checked where it
 * enters, and one this build cannot order never becomes part of the round.
 */
export function isRank(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.length <= MAX_RANK &&
        !value.endsWith("0") &&
        RANK_DIGITS.test(value)
    );
}
