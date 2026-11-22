import { describe, expect, it } from "vitest";

import { parseSavedRowData, parseSavedRows } from "../saved-rows";

describe("parseSavedRowData", () => {
  it("parses a row's JSON data", () => {
    expect(parseSavedRowData('{"id":"a","n":1}')).toEqual({ ok: true, value: { id: "a", n: 1 } });
    expect(parseSavedRowData("null")).toEqual({ ok: true, value: null });
  });

  it("reads malformed JSON, an empty string or a non-string as not ok, without throwing", () => {
    expect(parseSavedRowData('{"id":"a"')).toEqual({ ok: false });
    expect(parseSavedRowData("")).toEqual({ ok: false });
    expect(parseSavedRowData(undefined)).toEqual({ ok: false });
    expect(parseSavedRowData(42)).toEqual({ ok: false });
  });
});

describe("parseSavedRows", () => {
  it("keeps every readable row, in order, and skips the ones that can't be parsed", () => {
    const rows = [{ data: '{"id":"a"}' }, { data: "{broken" }, { data: '{"id":"c"}' }];
    expect(parseSavedRows(rows)).toEqual([{ id: "a" }, { id: "c" }]);
  });

  it("returns an empty list for no rows or only broken rows", () => {
    expect(parseSavedRows([])).toEqual([]);
    expect(parseSavedRows([{ data: "nope" }])).toEqual([]);
  });

  it("shapes each item from its parsed value and row, skipping broken rows before shaping", () => {
    const at = new Date("2026-11-22T00:00:00Z");
    const rows = [
      { data: '{"id":"a"}', updatedAt: at },
      { data: "", updatedAt: at },
    ];
    const shaped = parseSavedRows(rows, (value, row) => ({
      ...(value as Record<string, unknown>),
      updatedAt: row.updatedAt.toISOString(),
    }));
    expect(shaped).toEqual([{ id: "a", updatedAt: "2026-11-22T00:00:00.000Z" }]);
  });
});
