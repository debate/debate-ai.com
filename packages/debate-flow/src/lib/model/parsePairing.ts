import type { Debater } from "./types";

export interface DebaterPatch {
    first?: Debater;
    second?: Debater;
}

export interface PairingPatch {
    round?: string;
    affSchool?: string;
    negSchool?: string;
    aff?: DebaterPatch;
    neg?: DebaterPatch;
    judge?: string;
}

const PRONOUN = /^[a-z]+(\/[a-z]+)+$/i;
const TEAM_CODE = /\s+([A-Z][A-Za-z]{0,3})$/;

/** Split "School Name XY" into the school and its trailing entry code. */
function splitTeam(text: string): { school: string; code: string } {
    const m = text.match(TEAM_CODE);
    if (!m) return { school: text.trim(), code: "" };
    return { school: text.slice(0, m.index).trim(), code: m[1] };
}

/**
 * Fold an entry code into debater name(s). For LD (one debater) this makes
 * teamCode() reproduce the pairing code exactly (first initial + last initial).
 * For Policy the code's chars become the two debaters' last-name initials;
 * teamCode() alphabetizes them, so a non-alphabetical code may reorder.
 */
function foldCode(code: string, name: string, isPolicy: boolean): DebaterPatch {
    if (isPolicy) {
        return {
            first: { first: name, last: code.slice(0, 1) },
            second: { first: "", last: code.slice(1) },
        };
    }
    return { first: { first: name || code.slice(0, 1), last: code.slice(1) } };
}

/** Reorder a "Last, First" judge line into "First Last". */
function flipName(line: string): string {
    const m = line.match(/^(.+?),\s+(.+)$/);
    return m ? `${m[2].trim()} ${m[1].trim()}` : line.trim();
}

export function parsePairing(text: string): PairingPatch {
    const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    if (lines.length === 0) return {};

    const patch: PairingPatch = {};

    let isPolicy = false;
    for (const line of lines) {
        const m = line.match(/^(.+?)\s+of\s+(.+)$/);
        if (m) {
            patch.round = m[1].trim();
            isPolicy = /policy/i.test(m[2]);
            break;
        }
    }

    const hasBlock = lines.some((l) => l === "Competitors" || l === "Judging");
    if (hasBlock) {
        parseBlock(lines, isPolicy, patch);
    } else if (lines.some((l) => /^(.+?),\s+(.+)$/.test(l))) {
        parseSchematic(lines, patch);
    }
    return patch;
}

function assignTeam(
    patch: PairingPatch,
    side: "aff" | "neg",
    team: string,
    isPolicy: boolean,
): void {
    const { school, code } = splitTeam(team);
    if (side === "aff") {
        patch.affSchool = school;
        patch.aff = foldCode(code, "", isPolicy);
    } else {
        patch.negSchool = school;
        patch.neg = foldCode(code, "", isPolicy);
    }
}

function nameOnto(patch: PairingPatch, side: "aff" | "neg", name: string, isPolicy: boolean): void {
    const school = side === "aff" ? patch.affSchool : patch.negSchool;
    if (school === undefined) return;
    const current = side === "aff" ? patch.aff : patch.neg;
    const code = codeOf(current, isPolicy);
    const folded = foldCode(code, name, isPolicy);
    if (side === "aff") patch.aff = folded;
    else patch.neg = folded;
}

/** Recover the entry code from an already-folded DebaterPatch. */
function codeOf(d: DebaterPatch | undefined, isPolicy: boolean): string {
    if (!d) return "";
    if (isPolicy) return `${d.first?.last ?? ""}${d.second?.last ?? ""}`;
    return `${d.first?.first ?? ""}${d.first?.last ?? ""}`;
}

function parseBlock(lines: string[], isPolicy: boolean, patch: PairingPatch): void {
    let section: "none" | "competitors" | "judging" = "none";
    let flipSide: "aff" | "neg" = "aff";
    let flip = false;
    let lastSide: "aff" | "neg" | null = null;
    const judges: string[] = [];

    for (const line of lines) {
        if (line === "Competitors") {
            section = "competitors";
            continue;
        }
        if (line === "Judging") {
            section = "judging";
            continue;
        }
        if (line === "Access Your Ballot") {
            section = "none";
            continue;
        }

        if (section === "competitors") {
            if (/^FLIP FOR SIDES/i.test(line)) {
                flip = true;
                continue;
            }
            const labelled = line.match(/^(AFF|NEG)\s+(.+)$/);
            if (labelled) {
                const side = labelled[1] === "AFF" ? "aff" : "neg";
                assignTeam(patch, side, labelled[2], isPolicy);
                lastSide = side;
                continue;
            }
            if (line.includes(" : ")) {
                if (lastSide) nameOnto(patch, lastSide, line.split(" : ")[0].trim(), isPolicy);
                continue;
            }
            if (flip && TEAM_CODE.test(line)) {
                const side = flipSide;
                assignTeam(patch, side, line, isPolicy);
                lastSide = side;
                flipSide = "neg";
                continue;
            }
            continue;
        }

        if (section === "judging") {
            if (PRONOUN.test(line)) continue;
            judges.push(line);
        }
    }

    if (judges.length > 0) patch.judge = judges.join(", ");
}

function parseSchematic(lines: string[], patch: PairingPatch): void {
    const rows = lines.filter((l) => !/^\d+$/.test(l));
    const isJudge = (l: string): boolean => /^(.+?),\s+(.+)$/.test(l);
    const judges = rows.filter(isJudge);
    if (judges.length === 0) return;
    // A panel lists every "Last, First" line; the remaining lines are the two teams.
    patch.judge = judges.map(flipName).join(", ");
    const teams = rows.filter((l) => !isJudge(l));
    if (teams[0]) assignTeam(patch, "aff", teams[0], false);
    if (teams[1]) assignTeam(patch, "neg", teams[1], false);
}
