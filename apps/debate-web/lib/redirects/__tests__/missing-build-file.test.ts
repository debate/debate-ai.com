import { describe, expect, it } from "vitest";

import { isBuildOutputPath, missingBuildFileResponse } from "../missing-build-file";

describe("isBuildOutputPath", () => {
  it("matches hashed build folders only", () => {
    expect(isBuildOutputPath("/_next/static/chunks/CngqN3aF.js")).toBe(true);
    expect(isBuildOutputPath("/assets/index-abc.css")).toBe(true);
    expect(isBuildOutputPath("/_next/image")).toBe(false);
    expect(isBuildOutputPath("/videos")).toBe(false);
    expect(isBuildOutputPath("/assets")).toBe(false);
  });
});

describe("missingBuildFileResponse", () => {
  it("answers a missing chunk with an uncached plain-text 404", async () => {
    const response = missingBuildFileResponse(new Request("https://d.ebate.app/_next/static/chunks/CngqN3aF.js"));
    expect(response?.status).toBe(404);
    expect(response?.headers.get("content-type")).toContain("text/plain");
    expect(response?.headers.get("cache-control")).toBe("no-store");
    expect(await response?.text()).toContain("Not found");
  });

  it("sends no body for HEAD", async () => {
    const response = missingBuildFileResponse(
      new Request("https://d.ebate.app/assets/x.js", { method: "HEAD" }),
    );
    expect(response?.status).toBe(404);
    expect(response?.body).toBeNull();
  });

  it("leaves pages, APIs and other methods to the app", () => {
    expect(missingBuildFileResponse(new Request("https://d.ebate.app/videos"))).toBeNull();
    expect(missingBuildFileResponse(new Request("https://d.ebate.app/api/x"))).toBeNull();
    expect(
      missingBuildFileResponse(new Request("https://d.ebate.app/_next/static/x.js", { method: "POST" })),
    ).toBeNull();
  });
});
