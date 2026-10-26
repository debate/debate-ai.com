/** @fileoverview The `?debate=<id>` deep link into Debate History. */
import { describe, expect, it } from "vitest";
import { buildDebateHistoryHref, parseDebateHistoryParam } from "../src/ui/history-link";

describe("debate history deep link", () => {
  it("round-trips an id through build and parse", () => {
    const href = buildDebateHistoryHref(42);
    expect(href).toBe("/practice/versus-ai?debate=42");
    expect(parseDebateHistoryParam(href.slice(href.indexOf("?")))).toBe("42");
  });

  it("returns null when the param is absent or empty", () => {
    expect(parseDebateHistoryParam("")).toBeNull();
    expect(parseDebateHistoryParam("?other=1")).toBeNull();
    expect(parseDebateHistoryParam("?debate=")).toBeNull();
  });

  it("rejects ids that are not plain tokens", () => {
    expect(parseDebateHistoryParam("?debate=<script>")).toBeNull();
    expect(parseDebateHistoryParam(`?debate=${"a".repeat(65)}`)).toBeNull();
  });

  it("encodes unsafe characters when building", () => {
    expect(buildDebateHistoryHref("a b")).toBe("/practice/versus-ai?debate=a%20b");
  });
});
