import { describe, expect, it } from "vitest";
import {
  bookmarkNameForId,
  HEADING_BOOKMARK_PREFIX,
  HEADING_TYPE_NAMES,
  idFromBookmarkName,
  newHeadingId,
  stampMissingHeadingIds,
} from "../src/schema/ids";
import { schema } from "../src/schema/index";

describe("newHeadingId", () => {
  it("produces a well-formed UUID", () => {
    const id = newHeadingId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("produces unique ids across calls", () => {
    const a = newHeadingId();
    const b = newHeadingId();
    expect(a).not.toBe(b);
  });
});

describe("bookmarkNameForId / idFromBookmarkName", () => {
  it("round-trips an id through the bookmark name", () => {
    const id = "abc-123";
    const name = bookmarkNameForId(id);
    expect(name).toBe(`${HEADING_BOOKMARK_PREFIX}abc-123`);
    expect(idFromBookmarkName(name)).toBe(id);
  });

  it("returns null for a name lacking the prefix", () => {
    expect(idFromBookmarkName("not-a-bookmark")).toBeNull();
    expect(idFromBookmarkName("")).toBeNull();
  });
});

describe("HEADING_TYPE_NAMES", () => {
  it("contains exactly the heading-carrying node types", () => {
    expect([...HEADING_TYPE_NAMES].sort()).toEqual(
      ["analytic", "block", "hat", "pocket", "tag"].sort(),
    );
  });
});

describe("stampMissingHeadingIds", () => {
  it("returns the same node instance when nothing needs stamping", () => {
    const doc = schema.node("doc", null, [
      schema.node("pocket", { id: "existing-id" }, schema.text("Pocket")),
    ]);
    const result = stampMissingHeadingIds(doc);
    expect(result).toBe(doc);
  });

  it("stamps a fresh id onto a heading node missing one", () => {
    const pocket = schema.nodes["pocket"]!.createAndFill(
      { id: null },
      schema.text("Hello"),
    )!;
    const doc = schema.node("doc", null, [pocket]);
    expect(doc.firstChild!.attrs["id"]).toBeNull();

    const result = stampMissingHeadingIds(doc);
    expect(result).not.toBe(doc);
    const newId = result.firstChild!.attrs["id"];
    expect(typeof newId).toBe("string");
    expect(newId).not.toBe("");
    // Text content is preserved.
    expect(result.firstChild!.textContent).toBe("Hello");
  });

  it("stamps ids at arbitrary depth (inside a card's tag)", () => {
    const tag = schema.nodes["tag"]!.createAndFill(
      { id: null },
      schema.text("Tag text"),
    )!;
    const card = schema.nodes["card"]!.createAndFill(null, tag)!;
    const doc = schema.node("doc", null, [card]);

    const result = stampMissingHeadingIds(doc);
    const stampedTag = result.firstChild!.firstChild!;
    expect(stampedTag.type.name).toBe("tag");
    expect(stampedTag.attrs["id"]).toBeTruthy();
  });

  it("leaves non-heading nodes and text nodes untouched", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, schema.text("plain text")),
    ]);
    const result = stampMissingHeadingIds(doc);
    expect(result).toBe(doc);
  });

  it("does not stamp over an already-present id", () => {
    const hat = schema.nodes["hat"]!.createAndFill(
      { id: "keep-me" },
      schema.text("Hat"),
    )!;
    const doc = schema.node("doc", null, [hat]);
    const result = stampMissingHeadingIds(doc);
    expect(result).toBe(doc);
    expect(result.firstChild!.attrs["id"]).toBe("keep-me");
  });

  it("stamps multiple missing ids independently in a mixed doc", () => {
    const pocket1 = schema.nodes["pocket"]!.createAndFill(
      { id: null },
      schema.text("P1"),
    )!;
    const pocket2 = schema.nodes["pocket"]!.createAndFill(
      { id: null },
      schema.text("P2"),
    )!;
    const doc = schema.node("doc", null, [pocket1, pocket2]);
    const result = stampMissingHeadingIds(doc);
    const id1 = result.child(0).attrs["id"];
    const id2 = result.child(1).attrs["id"];
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });
});
