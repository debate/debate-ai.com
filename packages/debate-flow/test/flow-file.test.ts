import { describe, expect, it } from "vitest";
import {
    FLOW_FILE_VERSION,
    MAX_ROUND_CELLS,
    checkRound,
    fileBytes,
    holdsCellMeta,
    holdsScouting,
    paddedCells,
    parseFlowFile,
    parseLegacyExport,
    serializeFlow,
} from "../src/lib/persistence/flowFile";
import { emptyScouting, makeFlowRound, type FlowRound, type FlowSheet } from "../src/lib/model/flow";

const sheet = (over: Partial<FlowSheet> = {}): FlowSheet => ({
    id: "s1",
    title: "1.",
    group: "aff",
    order: 0,
    kind: "flow",
    data: [["extend warming", null]],
    meta: {},
    ...over,
});

const round = (over: Partial<FlowRound> = {}): FlowRound =>
    ({
        id: "r1",
        createdAt: 100,
        updatedAt: 200,
        event: "policy",
        firstSide: "aff",
        scouting: emptyScouting(),
        sheets: [sheet()],
        ...over,
    }) as FlowRound;

const file = (r: unknown, version: number = FLOW_FILE_VERSION) =>
    JSON.stringify({ version, round: r });

describe("serializeFlow", () => {
    it("wraps the round in a version envelope", () => {
        const parsed = JSON.parse(serializeFlow(round()));
        expect(parsed.version).toBe(FLOW_FILE_VERSION);
        expect(parsed.round.id).toBe("r1");
    });

    it("writes pretty-printed JSON ending in a newline, so the file stays diffable", () => {
        const text = serializeFlow(round());
        expect(text.endsWith("\n")).toBe(true);
        expect(text).toContain("\n  ");
    });

    it("round-trips a round through parseFlowFile", () => {
        const r = makeFlowRound({ event: "pf", firstSide: "neg" });
        r.sheets[1].data = [["a", "b"], [null, "c"]];
        r.sheets[1].meta = { "0,0": { bold: true, card: true } };
        expect(parseFlowFile(serializeFlow(r))).toEqual(r);
    });

    it("refuses to write a round the parser could not read back", () => {
        expect(() => serializeFlow(round({ id: 7 as never }))).toThrow(/is not a string/);
    });
});

describe("checkRound", () => {
    it("accepts a well-formed round", () => {
        expect(checkRound(round(), "round")).toEqual(round());
    });

    it("names the path to the first bad value", () => {
        expect(() => checkRound(round({ createdAt: "soon" as never }), "round")).toThrow(
            "Invalid flow file: round.createdAt is not a number",
        );
    });

    it("refuses a non-object round", () => {
        expect(() => checkRound(null, "round")).toThrow(/round is not an object/);
        expect(() => checkRound([], "round")).toThrow(/round is not an object/);
    });

    it("refuses an infinite timestamp", () => {
        expect(() => checkRound(round({ updatedAt: Infinity as never }), "round")).toThrow(
            /updatedAt is not a number/,
        );
    });

    it("refuses an event this build does not define", () => {
        expect(() => checkRound(round({ event: "wsdc" as never }), "round")).toThrow(
            /is not a known debate event/,
        );
    });

    it("does not let a prototype key pass as an event", () => {
        expect(() => checkRound(round({ event: "constructor" as never }), "round")).toThrow(
            /is not a known debate event/,
        );
    });

    it("allows an absent event, as a file predating named events has", () => {
        expect(() => checkRound(round({ event: undefined }), "round")).not.toThrow();
        expect(() => checkRound(round({ event: null as never }), "round")).not.toThrow();
    });

    it("refuses a first side that is neither aff nor neg", () => {
        expect(() => checkRound(round({ firstSide: "both" as never }), "round")).toThrow(
            /firstSide is not "aff" or "neg"/,
        );
    });

    it("refuses a sheet whose group is not a side", () => {
        const r = round({ sheets: [sheet({ group: "middle" as never })] });
        expect(() => checkRound(r, "round")).toThrow(/sheets\[0\].group is not "aff" or "neg"/);
    });

    it("refuses a sheet kind this build does not know", () => {
        const r = round({ sheets: [sheet({ kind: "outline" as never })] });
        expect(() => checkRound(r, "round")).toThrow(/kind is not "flow" or "cx"/);
    });

    it("refuses a cell that is neither text nor null", () => {
        const r = round({ sheets: [sheet({ data: [["ok", 3 as never]] })] });
        expect(() => checkRound(r, "round")).toThrow(/data\[0\]\[1\] is not text or null/);
    });

    it("refuses a data row that is not a row", () => {
        const r = round({ sheets: [sheet({ data: ["nope" as never] })] });
        expect(() => checkRound(r, "round")).toThrow(/data\[0\] is not a row/);
    });

    it("refuses a meta key that is not a cell coordinate", () => {
        const r = round({ sheets: [sheet({ meta: { top: {} } as never })] });
        expect(() => checkRound(r, "round")).toThrow(/is not a "row,col" cell/);
    });

    it("accepts a decoration on a padded cell past the stored rows", () => {
        const r = round({ sheets: [sheet({ meta: { "99,4": { bold: true } } })] });
        expect(() => checkRound(r, "round")).not.toThrow();
    });

    it("accepts a sheet that predates cell metadata entirely", () => {
        const r = round({ sheets: [sheet({ meta: undefined as never })] });
        expect(() => checkRound(r, "round")).not.toThrow();
    });

    it("refuses scouting that is missing a side", () => {
        const r = round({ scouting: { aff: emptyScouting().aff } as never });
        expect(() => checkRound(r, "round")).toThrow(/scouting.neg is not an object/);
    });

    it("refuses a debater name that is not text", () => {
        const scouting = emptyScouting();
        (scouting.aff.first as { first: unknown }).first = 12;
        expect(() => checkRound(round({ scouting }), "round")).toThrow(
            /scouting.aff.first.first is not a string/,
        );
    });

    it("refuses a decision vote that names no side", () => {
        const scouting = { ...emptyScouting(), decision: { vote: "tie" } } as never;
        expect(() => checkRound(round({ scouting }), "round")).toThrow(
            /decision.vote is not "aff" or "neg"/,
        );
    });

    it("refuses a round holding more cells than every consumer can materialize", () => {
        const wide = Array.from({ length: 2 }, () => new Array(MAX_ROUND_CELLS).fill(null));
        const r = round({ sheets: [sheet({ data: wide })] });
        expect(() => checkRound(r, "round")).toThrow(/hold more than 2000000 cells/);
    });

    it("refuses a sheets field that is not an array", () => {
        expect(() => checkRound(round({ sheets: {} as never }), "round")).toThrow(
            /sheets is not an array/,
        );
    });
});

describe("parseFlowFile", () => {
    it("preserves the round's own identity and history", () => {
        const parsed = parseFlowFile(file(round()));
        expect(parsed.id).toBe("r1");
        expect(parsed.createdAt).toBe(100);
        expect(parsed.updatedAt).toBe(200);
    });

    it("normalizes a round the file predates fields of", () => {
        const legacy = { id: "r1", createdAt: 1, updatedAt: 1, scouting: emptyScouting(), sheets: [] };
        const parsed = parseFlowFile(file(legacy));
        expect(parsed.event).toBe("policy");
        expect(parsed.firstSide).toBe("aff");
        expect(parsed.sheets.some((s) => s.kind === "cx")).toBe(true);
    });

    it("rejects text that is not JSON", () => {
        expect(() => parseFlowFile("{not json")).toThrow(/not valid JSON/);
    });

    it("rejects a file written by a newer build, which it cannot know what it would drop", () => {
        expect(() => parseFlowFile(file(round(), FLOW_FILE_VERSION + 1))).toThrow(
            /written by a newer version/,
        );
    });

    it("rejects the retired legacy node format outright", () => {
        expect(() => parseFlowFile(file(round(), 2))).toThrow(/retired format/);
        expect(() => parseFlowFile(file(round(), 1))).toThrow(/retired format/);
    });

    it("rejects a file with no version at all", () => {
        expect(() => parseFlowFile(JSON.stringify({ round: round() }))).toThrow(
            /file version is not a number/,
        );
    });

    it("rejects a multi-flow backup, which is not a single flow", () => {
        const text = JSON.stringify({
            version: FLOW_FILE_VERSION,
            kind: "backup",
            rounds: [round()],
        });
        expect(() => parseFlowFile(text)).toThrow(/multi-flow backup/);
    });

    it("rejects a JSON scalar, which is not an envelope", () => {
        expect(() => parseFlowFile("42")).toThrow(/the file is not an object/);
    });
});

describe("parseLegacyExport", () => {
    it("mints a fresh identity, since an export was a snapshot and not a document", () => {
        const [r] = parseLegacyExport(file(round()));
        expect(r.id).not.toBe("r1");
        expect(r.id.startsWith("round")).toBe(true);
        expect(r.createdAt).toBeGreaterThan(100);
        expect(r.createdAt).toBe(r.updatedAt);
    });

    it("keeps the round's own content", () => {
        const [r] = parseLegacyExport(file(round()));
        expect(r.sheets.find((s) => s.id === "s1")?.data).toEqual([["extend warming", null]]);
    });

    it("reads every round out of a backup", () => {
        const text = JSON.stringify({
            version: FLOW_FILE_VERSION,
            kind: "backup",
            rounds: [round({ id: "a" }), round({ id: "b" })],
        });
        const out = parseLegacyExport(text);
        expect(out).toHaveLength(2);
        expect(new Set(out.map((r) => r.id)).size).toBe(2);
    });

    it("names the offending round when one of a backup is malformed", () => {
        const text = JSON.stringify({
            version: FLOW_FILE_VERSION,
            kind: "backup",
            rounds: [round(), round({ id: 9 as never })],
        });
        expect(() => parseLegacyExport(text)).toThrow(/rounds\[1\].id is not a string/);
    });

    it("refuses a backup whose rounds field is not an array", () => {
        const text = JSON.stringify({ version: FLOW_FILE_VERSION, kind: "backup", rounds: {} });
        expect(() => parseLegacyExport(text)).toThrow(/rounds is not an array/);
    });
});

describe("paddedCells", () => {
    it("counts the rectangle the grid pads a sheet to", () => {
        expect(paddedCells([["a"], ["b", "c"], []])).toBe(6);
    });

    it("is zero for a sheet with no rows", () => {
        expect(paddedCells([])).toBe(0);
    });

    it("is zero for rows with no columns", () => {
        expect(paddedCells([[], []])).toBe(0);
    });

    it("prices a ragged sheet by its widest row, as every consumer materializes it", () => {
        const ragged = [new Array(1000).fill(null), ...Array.from({ length: 999 }, () => [null])];
        expect(paddedCells(ragged)).toBe(1_000_000);
    });
});

describe("fileBytes", () => {
    it("charges a scalar its JSON plus a line of structure", () => {
        expect(fileBytes(null)).toBeGreaterThan("null".length);
        expect(fileBytes("a card")).toBeGreaterThan(fileBytes(null));
    });

    it("charges longer text more", () => {
        expect(fileBytes("a".repeat(100))).toBeGreaterThan(fileBytes("a"));
    });

    it("charges a multi-byte character more than an ASCII one", () => {
        expect(fileBytes("中")).toBeGreaterThan(fileBytes("a"));
        expect(fileBytes("é")).toBeGreaterThan(fileBytes("a"));
        expect(fileBytes("中")).toBeGreaterThan(fileBytes("é"));
    });

    it("charges an object for every line it spans", () => {
        expect(fileBytes({ bold: true, card: true })).toBeGreaterThan(
            fileBytes({ bold: true }),
        );
    });

    it("charges undefined as the null it serializes to", () => {
        expect(fileBytes(undefined)).toBe(fileBytes(null));
    });

    it("never charges an empty grid nothing", () => {
        expect(fileBytes([])).toBeGreaterThan(0);
    });
});

describe("holdsScouting", () => {
    it("accepts what emptyScouting builds", () => {
        expect(holdsScouting(emptyScouting())).toBe(true);
    });

    it("rejects a value a peer wrote that the file cannot hold", () => {
        expect(holdsScouting(null)).toBe(false);
        expect(holdsScouting("aff")).toBe(false);
        expect(holdsScouting({ aff: {} })).toBe(false);
    });

    it("accepts optional tournament fields as text", () => {
        expect(holdsScouting({ ...emptyScouting(), tournament: "Berkeley" })).toBe(true);
        expect(holdsScouting({ ...emptyScouting(), tournament: 3 })).toBe(false);
    });
});

describe("holdsCellMeta", () => {
    it("accepts the decorations a cell carries", () => {
        expect(holdsCellMeta({})).toBe(true);
        expect(holdsCellMeta({ bold: true, highlight: true, card: true, kicked: true })).toBe(true);
    });

    it("rejects a decoration flag that is not a boolean", () => {
        expect(holdsCellMeta({ bold: "yes" })).toBe(false);
    });

    it("rejects a non-object a peer put in a cell's meta", () => {
        expect(holdsCellMeta(null)).toBe(false);
        expect(holdsCellMeta([])).toBe(false);
    });
});
