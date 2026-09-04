import type { Debater } from "./types";

const initial = (s: string): string => (s.trim()[0] ?? "").toUpperCase();
const hasLast = (d: Debater): boolean => d.last.trim().length > 0;

/**
 * Team code mirroring the Excel Info-sheet formula:
 *   school + " " + initials
 * Two debaters with last names → both last-name initials, alphabetized.
 * One debater → that debater's first + last initial.
 * No names → just the school. Blank school → "".
 */
export function teamCode(school: string, first: Debater, second: Debater): string {
    const s = school.trim();
    if (!s) return "";

    const present = [first, second].filter(hasLast);
    if (present.length === 2) {
        const inits = present.map((d) => initial(d.last)).sort((a, b) => a.localeCompare(b));
        return `${s} ${inits[0]}${inits[1]}`;
    }
    // Single debater (or fall back to whichever has any name).
    const solo = present[0] ?? [first, second].find((d) => d.first.trim() || d.last.trim());
    if (solo) {
        const code = `${initial(solo.first)}${initial(solo.last)}`;
        return code ? `${s} ${code}` : s;
    }
    return s;
}
