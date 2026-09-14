import { describe, expect, it } from "vitest";
import { parsePairing } from "../src/lib/model/parsePairing";

describe("parsePairing", () => {
    it("reads nothing out of empty text", () => {
        expect(parsePairing("")).toEqual({});
        expect(parsePairing("   \n\n  ")).toEqual({});
    });

    it("takes the round name from the 'X of Y' line", () => {
        expect(parsePairing("Round 3 of Varsity Policy").round).toBe("Round 3");
        expect(parsePairing("Octafinals of Open LD").round).toBe("Octafinals");
    });

    it("takes the first such line and stops looking", () => {
        const text = "Round 1 of Policy\nRound 2 of LD";
        expect(parsePairing(text).round).toBe("Round 1");
    });

    it("names no round when no line says which one it is", () => {
        expect(parsePairing("Competitors\nAFF Westside AB").round).toBeUndefined();
    });
});

describe("parsePairing on a tabroom entry block", () => {
    const block = [
        "Round 2 of Varsity LD",
        "Competitors",
        "AFF Westside AB",
        "Ada Lovelace : ada@example.com",
        "NEG Eastside CD",
        "Grace Hopper : grace@example.com",
        "Judging",
        "she/her",
        "Marian Rejewski",
        "Access Your Ballot",
    ].join("\n");

    it("splits each side's school from its entry code", () => {
        const patch = parsePairing(block);
        expect(patch.affSchool).toBe("Westside");
        expect(patch.negSchool).toBe("Eastside");
    });

    it("folds the entry code and the debater's name together", () => {
        const patch = parsePairing(block);
        expect(patch.aff?.first).toEqual({ first: "Ada Lovelace", last: "B" });
        expect(patch.neg?.first).toEqual({ first: "Grace Hopper", last: "D" });
    });

    it("gives a policy round two debaters, one initial each", () => {
        const policy = block.replace("Varsity LD", "Varsity Policy");
        const patch = parsePairing(policy);
        expect(patch.aff?.first).toEqual({ first: "Ada Lovelace", last: "A" });
        expect(patch.aff?.second).toEqual({ first: "", last: "B" });
    });

    it("takes the judge and skips their pronoun line", () => {
        expect(parsePairing(block).judge).toBe("Marian Rejewski");
    });

    it("joins a panel of judges", () => {
        const panel = block.replace("Marian Rejewski", "Marian Rejewski\nAlan Turing");
        expect(parsePairing(panel).judge).toBe("Marian Rejewski, Alan Turing");
    });

    it("stops reading judges at the ballot link", () => {
        const trailing = block + "\nSomething Else";
        expect(parsePairing(trailing).judge).toBe("Marian Rejewski");
    });

    it("names no judge when the block lists none", () => {
        const noJudge = block.replace("she/her\nMarian Rejewski\n", "");
        expect(parsePairing(noJudge).judge).toBeUndefined();
    });

    it("assigns the sides in order when the pairing says to flip for them", () => {
        const flip = [
            "Round 1 of Varsity LD",
            "Competitors",
            "FLIP FOR SIDES",
            "Westside AB",
            "Eastside CD",
            "Judging",
            "Marian Rejewski",
        ].join("\n");
        const patch = parsePairing(flip);
        expect(patch.affSchool).toBe("Westside");
        expect(patch.negSchool).toBe("Eastside");
    });

    it("keeps a multi-word school name whole", () => {
        const text = "Competitors\nAFF Rancho Bernardo HS AB\nJudging\nJ";
        expect(parsePairing(text).affSchool).toBe("Rancho Bernardo HS");
    });

    it("leaves a school with no entry code without one", () => {
        const text = "Competitors\nAFF Westside\nJudging\nJ";
        const patch = parsePairing(text);
        expect(patch.affSchool).toBe("Westside");
        expect(patch.aff?.first).toEqual({ first: "", last: "" });
    });

    it("ignores a name line arriving before any side is named", () => {
        const text = "Competitors\nAda Lovelace : a@b.c\nJudging\nJ";
        expect(parsePairing(text).aff).toBeUndefined();
    });
});

describe("parsePairing on a schematic", () => {
    const schematic = ["1", "Westside AB", "Eastside CD", "Rejewski, Marian"].join("\n");

    it("flips the judge's name into reading order", () => {
        expect(parsePairing(schematic).judge).toBe("Marian Rejewski");
    });

    it("reads the two teams either side of the judge", () => {
        const patch = parsePairing(schematic);
        expect(patch.affSchool).toBe("Westside");
        expect(patch.negSchool).toBe("Eastside");
    });

    it("folds each team's code onto one debater", () => {
        const patch = parsePairing(schematic);
        expect(patch.aff?.first).toEqual({ first: "A", last: "B" });
        expect(patch.neg?.first).toEqual({ first: "C", last: "D" });
    });

    it("drops the room number", () => {
        expect(parsePairing(schematic).affSchool).not.toBe("1");
    });

    it("joins a panel, flipping each name", () => {
        const panel = schematic + "\nTuring, Alan";
        expect(parsePairing(panel).judge).toBe("Marian Rejewski, Alan Turing");
    });

    it("reads nothing when no line looks like a judge", () => {
        expect(parsePairing("Westside AB\nEastside CD")).toEqual({});
    });

    it("survives a schematic listing only one team", () => {
        const patch = parsePairing("Westside AB\nRejewski, Marian");
        expect(patch.affSchool).toBe("Westside");
        expect(patch.negSchool).toBeUndefined();
    });
});
