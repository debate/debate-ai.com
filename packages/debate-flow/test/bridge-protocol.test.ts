/**
 * @fileoverview The cardmirror-bridge's inbound validation, and the command
 * registry the keyboard layer fires against.
 *
 * The bridge's rule is that every failure is a named error rather than a
 * throw, so a send arriving while the dashboard is open answers rather than
 * hanging until the host's deadline. That distinction — a 400 for a malformed
 * request against a 200 carrying a named error — is what the reply shape
 * encodes, and it is what these pin.
 */

import { describe, expect, it } from "vitest";
import {
    BAD_REQUEST,
    bridgeError,
    parseFlowRequest,
    parseRevealRequest,
} from "../src/lib/bridge/protocol";
import { CARDMIRROR_COMMANDS, COMMANDS, type CommandId } from "../src/lib/commands/registry";

const item = (over: Record<string, unknown> = {}) => ({
    kind: "card",
    text: "Warming is real",
    source: "token-1",
    key: "key-1",
    ...over,
});

describe("the reply shapes", () => {
    it("answers a malformed request at the HTTP level", () => {
        expect(BAD_REQUEST).toEqual({ status: 400, body: { ok: false, error: "bad-request" } });
    });

    it("answers a failure ebb can explain with a named error, not a fault", () => {
        expect(bridgeError("no-active-sheet")).toEqual({
            status: 200,
            body: { ok: false, error: "no-active-sheet" },
        });
    });

    it("keeps a named error distinguishable from a malformed request", () => {
        expect(bridgeError("no-round").status).not.toBe(BAD_REQUEST.status);
    });
});

describe("parseFlowRequest", () => {
    it("reads a well-formed send", () => {
        expect(parseFlowRequest({ items: [item()], mode: "cell", docTitle: "Warming", space: 2 })).toEqual({
            mode: "cell",
            docTitle: "Warming",
            space: 2,
            items: [{ kind: "card", text: "Warming is real", token: "token-1", key: "key-1" }],
        });
    });

    it("refuses a body that is not an object", () => {
        expect(parseFlowRequest(null)).toBeNull();
        expect(parseFlowRequest("items")).toBeNull();
        expect(parseFlowRequest([item()])).toBeNull();
    });

    it("refuses a body carrying no item list", () => {
        expect(parseFlowRequest({})).toBeNull();
        expect(parseFlowRequest({ items: "one" })).toBeNull();
    });

    it("refuses a send with nothing to write", () => {
        expect(parseFlowRequest({ items: [] })).toBeNull();
        expect(parseFlowRequest({ items: [item({ text: "" })] })).toBeNull();
        expect(parseFlowRequest({ items: [{ kind: "card" }] })).toBeNull();
    });

    it("drops an empty item rather than failing the whole send", () => {
        const out = parseFlowRequest({ items: [item(), item({ text: "" }), item({ text: "second" })] });
        expect(out!.items.map((i) => i.text)).toEqual(["Warming is real", "second"]);
    });

    it("defaults an item's kind to an analytic", () => {
        expect(parseFlowRequest({ items: [{ text: "x" }] })!.items[0]!.kind).toBe("analytic");
        expect(parseFlowRequest({ items: [{ text: "x", kind: 7 }] })!.items[0]!.kind).toBe("analytic");
    });

    it("defaults the provenance fields to empty rather than refusing", () => {
        const out = parseFlowRequest({ items: [{ text: "x" }] })!;
        expect(out.items[0]).toMatchObject({ token: "", key: "" });
        expect(out.docTitle).toBe("");
    });

    it("defaults the mode to a column send", () => {
        expect(parseFlowRequest({ items: [item()] })!.mode).toBe("column");
        expect(parseFlowRequest({ items: [item()], mode: "row" })!.mode).toBe("column");
        expect(parseFlowRequest({ items: [item()], mode: "cell" })!.mode).toBe("cell");
    });

    it("rounds a fractional space request to a whole number of cells", () => {
        expect(parseFlowRequest({ items: [item()], space: 2.4 })!.space).toBe(2);
        expect(parseFlowRequest({ items: [item()], space: 2.6 })!.space).toBe(3);
    });

    it("clamps a space request to the range a send may ask for", () => {
        expect(parseFlowRequest({ items: [item()], space: 999 })!.space).toBe(10);
        expect(parseFlowRequest({ items: [item()], space: -5 })!.space).toBe(0);
    });

    it("reads a space that is not a number as none", () => {
        for (const space of ["2", null, NaN, Infinity, undefined]) {
            expect(parseFlowRequest({ items: [item()], space })!.space).toBe(0);
        }
    });

    it("keeps only the fields the request names", () => {
        const out = parseFlowRequest({ items: [item()], extra: "payload" })!;
        expect(Object.keys(out).sort()).toEqual(["docTitle", "items", "mode", "space"]);
        expect(Object.keys(out.items[0]!).sort()).toEqual(["key", "kind", "text", "token"]);
    });
});

describe("parseRevealRequest", () => {
    it("reads a well-formed reveal", () => {
        expect(parseRevealRequest({ keys: ["a", "b"], docTitle: "Warming" })).toEqual({
            keys: ["a", "b"],
            docTitle: "Warming",
        });
    });

    it("refuses a body that is not an object, or names no keys", () => {
        expect(parseRevealRequest(null)).toBeNull();
        expect(parseRevealRequest({})).toBeNull();
        expect(parseRevealRequest({ keys: "a" })).toBeNull();
    });

    it("refuses a reveal with no usable key", () => {
        expect(parseRevealRequest({ keys: [] })).toBeNull();
        expect(parseRevealRequest({ keys: ["", null, 7] })).toBeNull();
    });

    it("drops the unusable keys of a list that still has one", () => {
        expect(parseRevealRequest({ keys: ["a", "", 7, null, "b"] })!.keys).toEqual(["a", "b"]);
    });

    it("defaults the document title to empty", () => {
        expect(parseRevealRequest({ keys: ["a"] })!.docTitle).toBe("");
        expect(parseRevealRequest({ keys: ["a"], docTitle: 7 })!.docTitle).toBe("");
    });
});

describe("the command registry", () => {
    const ids = Object.keys(COMMANDS) as CommandId[];

    it("keys every command by its own id", () => {
        for (const id of ids) expect(COMMANDS[id].id).toBe(id);
    });

    it("gives every command a label the palette can show", () => {
        for (const id of ids) {
            expect(typeof COMMANDS[id].label).toBe("string");
            expect(COMMANDS[id].label.length).toBeGreaterThan(0);
        }
    });

    it("gives each command a distinct label, so the palette is unambiguous", () => {
        const labels = ids.map((id) => COMMANDS[id].label);
        expect(new Set(labels).size).toBe(labels.length);
    });

    it("keeps every keyword string non-empty where it has one", () => {
        for (const id of ids) {
            const keywords = COMMANDS[id].keywords;
            if (keywords !== undefined) expect(keywords.length).toBeGreaterThan(0);
        }
    });

    it("names a sheet jump for each digit a keymap can bind", () => {
        for (let i = 1; i <= 9; i++) expect(COMMANDS[`sheet.jump${i}` as CommandId]).toBeDefined();
    });

    it("names the CardMirror commands, and only commands the registry holds", () => {
        expect(CARDMIRROR_COMMANDS.length).toBeGreaterThan(0);
        for (const id of CARDMIRROR_COMMANDS) expect(COMMANDS[id]).toBeDefined();
    });

    it("holds every command the collaboration surface fires", () => {
        for (const id of [
            "collab.share",
            "collab.shareView",
            "collab.join",
            "collab.invite",
            "collab.end",
        ] as CommandId[]) {
            expect(COMMANDS[id]).toBeDefined();
        }
    });
});
