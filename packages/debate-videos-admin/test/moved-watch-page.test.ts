import { describe, expect, it } from "vitest";
import { movedWatchPagePath } from "../src/lib/moved-watch-page";

const OLD = "/videos/21-22/cpd/ndt/finals/dartmouth-sv-michigan-pr";
const NEW = "/videos/21-22/cpd/ndt/semis/dartmouth-sv-michigan-pr";

describe("movedWatchPagePath", () => {
  it("goes to the new address when the edit moved the video", () => {
    expect(movedWatchPagePath(OLD, OLD, NEW)).toBe(NEW);
  });

  it("keeps the open speech and view", () => {
    expect(movedWatchPagePath(`${OLD}/2ar/alternatives`, OLD, NEW)).toBe(`${NEW}/2ar/alternatives`);
  });

  it("ignores a trailing slash", () => {
    expect(movedWatchPagePath(`${OLD}/`, OLD, NEW)).toBe(NEW);
  });

  it("stays put when the address did not change", () => {
    expect(movedWatchPagePath(OLD, OLD, OLD)).toBeNull();
    expect(movedWatchPagePath(`${OLD}/2ar`, OLD, OLD)).toBeNull();
  });

  it("stays put when the new address is unknown", () => {
    expect(movedWatchPagePath(OLD, OLD, null)).toBeNull();
  });

  it("goes to the new address from any other page path", () => {
    expect(movedWatchPagePath("/videos/watch/some-old-slug", OLD, NEW)).toBe(NEW);
    expect(movedWatchPagePath("/videos/watch/some-old-slug", null, NEW)).toBe(NEW);
  });

  it("stays put when already on the new address without the old one", () => {
    expect(movedWatchPagePath(`${NEW}/1nc`, null, NEW)).toBeNull();
  });

  it("does not treat a longer sibling path as the same video", () => {
    expect(movedWatchPagePath(`${OLD}-2`, OLD, NEW)).toBe(NEW);
  });
});
