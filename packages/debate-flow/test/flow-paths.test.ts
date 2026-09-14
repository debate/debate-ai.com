import { describe, expect, it } from "vitest";
import {
    EBB_EXT,
    basename,
    dedupeFilename,
    dirname,
    displayPath,
    joinPath,
    stem,
    suggestFilename,
    withEbbExt,
} from "../src/lib/persistence/flowPaths";
import { teamCode } from "../src/lib/model/teamCode";
import { emptyScouting } from "../src/lib/model/flow";
import type { Scouting } from "../src/lib/model/types";

describe("basename", () => {
    it("takes the last segment of a posix path", () => {
        expect(basename("/flows/round.ebb")).toBe("round.ebb");
    });

    it("takes the last segment of a windows path", () => {
        expect(basename("C:\\flows\\round.ebb")).toBe("round.ebb");
    });

    it("hands back a bare name unchanged", () => {
        expect(basename("round.ebb")).toBe("round.ebb");
    });

    it("reads a path ending in a separator as an empty name", () => {
        expect(basename("/flows/")).toBe("");
    });
});

describe("dirname", () => {
    it("takes the directory of a path, in either separator", () => {
        expect(dirname("/flows/round.ebb")).toBe("/flows");
        expect(dirname("C:\\flows\\round.ebb")).toBe("C:\\flows");
    });

    it("is empty for a bare name", () => {
        expect(dirname("round.ebb")).toBe("");
    });
});

describe("stem", () => {
    it("drops the extension", () => {
        expect(stem("/flows/round.ebb")).toBe("round");
    });

    it("drops it whatever case the file uses", () => {
        expect(stem("round.EBB")).toBe("round");
    });

    it("leaves a name that does not carry it alone", () => {
        expect(stem("round.txt")).toBe("round.txt");
        expect(stem("round")).toBe("round");
    });

    it("keeps a dot inside the name", () => {
        expect(stem("r1.v2.ebb")).toBe("r1.v2");
    });
});

describe("withEbbExt", () => {
    it("appends the extension", () => {
        expect(withEbbExt("round")).toBe(`round${EBB_EXT}`);
    });

    it("does not double it", () => {
        expect(withEbbExt("round.ebb")).toBe("round.ebb");
        expect(withEbbExt("round.EBB")).toBe("round.EBB");
    });
});

describe("joinPath", () => {
    it("uses the separator the directory already uses", () => {
        expect(joinPath("/flows", "r.ebb")).toBe("/flows/r.ebb");
        expect(joinPath("C:\\flows", "r.ebb")).toBe("C:\\flows\\r.ebb");
    });

    it("prefers the forward slash for a mixed path", () => {
        expect(joinPath("C:\\flows/sub", "r.ebb")).toBe("C:\\flows/sub/r.ebb");
    });

    it("does not double a trailing separator", () => {
        expect(joinPath("/flows/", "r.ebb")).toBe("/flows/r.ebb");
        expect(joinPath("C:\\flows\\", "r.ebb")).toBe("C:\\flows\\r.ebb");
    });

    it("hands back the bare name when there is no directory", () => {
        expect(joinPath("", "r.ebb")).toBe("r.ebb");
    });
});

describe("displayPath", () => {
    it("collapses the home directory to a tilde", () => {
        expect(displayPath("/home/ada/flows/r.ebb", "/home/ada")).toBe("~/flows/r.ebb");
        expect(displayPath("C:\\Users\\ada\\r.ebb", "C:\\Users\\ada")).toBe("~\\r.ebb");
    });

    it("collapses the home directory itself", () => {
        expect(displayPath("/home/ada", "/home/ada")).toBe("~");
        expect(displayPath("/home/ada", "/home/ada/")).toBe("~");
    });

    it("leaves a path outside home alone", () => {
        expect(displayPath("/etc/flows/r.ebb", "/home/ada")).toBe("/etc/flows/r.ebb");
    });

    it("does not collapse a sibling whose name merely starts the same way", () => {
        expect(displayPath("/home/adam/r.ebb", "/home/ada")).toBe("/home/adam/r.ebb");
    });

    it("leaves the path alone when there is no home to collapse", () => {
        expect(displayPath("/flows/r.ebb", "")).toBe("/flows/r.ebb");
    });
});

describe("suggestFilename", () => {
    const scouted = (over: Partial<Scouting> = {}): Scouting => ({
        ...emptyScouting(),
        tournament: "Berkeley Invitational",
        round: "Round 3",
        affSchool: "Westside",
        negSchool: "Eastside",
        aff: { first: { first: "Ada", last: "Lovelace" }, second: { first: "", last: "" } },
        neg: { first: { first: "Grace", last: "Hopper" }, second: { first: "", last: "" } },
        ...over,
    });

    it("names a scouted round after the tournament, round and teams", () => {
        const name = suggestFilename({ event: "policy", scouting: scouted(), createdAt: 0 });
        expect(name).toBe("berkeley-invitational-round-3-westside-al-vs-eastside-gh.ebb");
    });

    it("falls back to the event and the local date before any scouting", () => {
        const at = new Date(2026, 2, 14, 22, 30).getTime();
        const name = suggestFilename({ event: "ld", scouting: emptyScouting(), createdAt: at });
        expect(name).toBe("ld-2026-03-14.ebb");
    });

    it("files a late-evening round on today's calendar date, not tomorrow's", () => {
        const at = new Date(2026, 2, 14, 23, 59).getTime();
        expect(suggestFilename({ scouting: emptyScouting(), createdAt: at })).toContain("2026-03-14");
    });

    it("falls back to policy for a round with no event named", () => {
        const name = suggestFilename({ scouting: emptyScouting(), createdAt: 0 });
        expect(name.startsWith("policy-")).toBe(true);
    });

    it("slugs the event too, since a joined round carries the host's word for it", () => {
        const name = suggestFilename({
            event: "Weird Event!!" as never,
            scouting: emptyScouting(),
            createdAt: 0,
        });
        expect(name.startsWith("weird-event-")).toBe(true);
    });

    it("uses whichever team was scouted when only one was", () => {
        const name = suggestFilename({
            scouting: scouted({ negSchool: "", tournament: undefined, round: undefined }),
            createdAt: 0,
        });
        expect(name).toBe("westside-al.ebb");
    });

    it("caps a long name and never leaves it ending in a dash", () => {
        const name = suggestFilename({
            scouting: scouted({ tournament: "x".repeat(200) }),
            createdAt: 0,
        });
        expect(name.length).toBeLessThanOrEqual(72 + EBB_EXT.length);
        expect(name.endsWith("-.ebb")).toBe(false);
    });

    it("always returns a bare filename, never a path", () => {
        const name = suggestFilename({
            scouting: scouted({ tournament: "../../etc" }),
            createdAt: 0,
        });
        expect(name).not.toContain("/");
        expect(name).not.toContain("\\");
    });

    it("always carries the extension", () => {
        expect(suggestFilename({ scouting: emptyScouting(), createdAt: 0 }).endsWith(EBB_EXT)).toBe(
            true,
        );
    });
});

describe("dedupeFilename", () => {
    it("keeps a free name", () => {
        expect(dedupeFilename("round.ebb", new Set())).toBe("round.ebb");
    });

    it("numbers the first free variant", () => {
        expect(dedupeFilename("round.ebb", new Set(["round.ebb"]))).toBe("round-2.ebb");
        expect(dedupeFilename("round.ebb", new Set(["round.ebb", "round-2.ebb"]))).toBe(
            "round-3.ebb",
        );
    });

    it("falls back to a timestamped name when a thousand variants are taken", () => {
        const taken = new Set(["round.ebb"]);
        for (let n = 2; n < 1000; n++) taken.add(`round-${n}.ebb`);
        const out = dedupeFilename("round.ebb", taken);
        expect(out.startsWith("round-")).toBe(true);
        expect(taken.has(out)).toBe(false);
    });
});

describe("teamCode", () => {
    const d = (first: string, last: string) => ({ first, last });

    it("alphabetizes two debaters' last-name initials", () => {
        expect(teamCode("Westside", d("Ada", "Lovelace"), d("Grace", "Hopper"))).toBe("Westside HL");
    });

    it("gives a single debater a first and a last initial", () => {
        expect(teamCode("Westside", d("Ada", "Lovelace"), d("", ""))).toBe("Westside AL");
    });

    it("falls back to a debater with only a first name", () => {
        expect(teamCode("Westside", d("Ada", ""), d("", ""))).toBe("Westside A");
    });

    it("is just the school when nobody is named", () => {
        expect(teamCode("Westside", d("", ""), d("", ""))).toBe("Westside");
    });

    it("is empty without a school, which is what the code hangs off", () => {
        expect(teamCode("", d("Ada", "Lovelace"), d("Grace", "Hopper"))).toBe("");
        expect(teamCode("   ", d("Ada", "L"), d("", ""))).toBe("");
    });

    it("uppercases the initials and trims around the names", () => {
        expect(teamCode(" Westside ", d(" ada ", " lovelace "), d("", ""))).toBe("Westside AL");
    });
});
