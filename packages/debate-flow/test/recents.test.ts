import { describe, expect, it } from "vitest";
import {
    RECENTS_KEPT,
    RECENTS_SHOWN,
    parseRecents,
    promoteRecent,
    serializeRecents,
    type RecentFlow,
} from "../src/lib/persistence/recents";

const recent = (path: string, openedAt = 1): RecentFlow => ({ path, openedAt });

describe("promoteRecent", () => {
    it("puts the path at the front", () => {
        const list = [recent("/b"), recent("/c")];
        expect(promoteRecent(list, "/a", 9).map((r) => r.path)).toEqual(["/a", "/b", "/c"]);
    });

    it("replaces an earlier entry for the same file rather than duplicating it", () => {
        const list = [recent("/b"), recent("/a", 1), recent("/c")];
        const out = promoteRecent(list, "/a", 9);
        expect(out.map((r) => r.path)).toEqual(["/a", "/b", "/c"]);
        expect(out[0].openedAt).toBe(9);
    });

    it("keeps the list deep enough for a tournament and no deeper", () => {
        let list: RecentFlow[] = [];
        for (let i = 0; i < RECENTS_KEPT + 10; i++) list = promoteRecent(list, `/f${i}`, i);
        expect(list).toHaveLength(RECENTS_KEPT);
        expect(list[0].path).toBe(`/f${RECENTS_KEPT + 9}`);
    });

    it("does not touch the list it was given", () => {
        const list = [recent("/b")];
        promoteRecent(list, "/a", 2);
        expect(list.map((r) => r.path)).toEqual(["/b"]);
    });

    it("shows fewer than it keeps, so a number key addresses each shown flow", () => {
        expect(RECENTS_SHOWN).toBeLessThan(RECENTS_KEPT);
    });
});

describe("serializeRecents and parseRecents", () => {
    it("round-trips a list", () => {
        const list = [recent("/a", 5), recent("/b", 3)];
        expect(parseRecents(serializeRecents(list))).toEqual(list);
    });

    it("writes readable, hand-editable text", () => {
        const text = serializeRecents([recent("/a")]);
        expect(text.endsWith("\n")).toBe(true);
        expect(text).toContain("\n  ");
    });

    it("reads an empty list for a missing file", () => {
        expect(parseRecents(null)).toEqual([]);
        expect(parseRecents("")).toEqual([]);
    });

    it("reads an empty list rather than blocking the start screen on bad JSON", () => {
        expect(parseRecents("{not json")).toEqual([]);
    });

    it("reads an empty list for an envelope that holds no flows", () => {
        expect(parseRecents("[]")).toEqual([]);
        expect(parseRecents("null")).toEqual([]);
        expect(parseRecents('{"version":1}')).toEqual([]);
        expect(parseRecents('{"flows":"/a"}')).toEqual([]);
    });

    it("drops an entry with no usable path", () => {
        const text = JSON.stringify({ flows: [{ openedAt: 1 }, { path: 7 }, { path: "" }] });
        expect(parseRecents(text)).toEqual([]);
    });

    it("drops an entry that is not an object", () => {
        const text = JSON.stringify({ flows: ["/a", null, { path: "/b" }] });
        expect(parseRecents(text)).toEqual([recent("/b", 0)]);
    });

    it("keeps only the first entry for a path a synced file listed twice", () => {
        const text = JSON.stringify({ flows: [{ path: "/a", openedAt: 5 }, { path: "/a", openedAt: 1 }] });
        expect(parseRecents(text)).toEqual([recent("/a", 5)]);
    });

    it("defaults a missing or unusable timestamp to zero", () => {
        const text = JSON.stringify({ flows: [{ path: "/a" }, { path: "/b", openedAt: "soon" }] });
        expect(parseRecents(text)).toEqual([recent("/a", 0), recent("/b", 0)]);
    });

    it("stops at the depth the file keeps, however long the file is", () => {
        const flows = Array.from({ length: 100 }, (_, i) => ({ path: `/f${i}`, openedAt: i }));
        expect(parseRecents(JSON.stringify({ flows }))).toHaveLength(RECENTS_KEPT);
    });
});
