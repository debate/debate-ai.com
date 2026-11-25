import { describe, expect, it } from "vitest";

import {
  archivedBuildFileResponse,
  archivedContentType,
  buildArchiveKey,
  isBuildOutputPath,
  missingBuildFileResponse,
  type BuildArchiveBucket,
} from "../missing-build-file";

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

function bucketWith(files: Record<string, string>): BuildArchiveBucket & { keys: string[] } {
  const keys: string[] = [];
  return {
    keys,
    async get(key) {
      keys.push(key);
      const text = files[key];
      if (text === undefined) return null;
      return { body: new Response(text).body, size: text.length, httpEtag: '"e1"' };
    },
  };
}

describe("archivedBuildFileResponse", () => {
  it("serves a chunk from an earlier deploy as immutable JavaScript", async () => {
    const bucket = bucketWith({ "_next/static/chunks/Hf5A5lAS.js": "export{}" });
    const response = await archivedBuildFileResponse(
      new Request("https://d.ebate.app/_next/static/chunks/Hf5A5lAS.js"),
      bucket,
    );
    expect(bucket.keys).toEqual(["_next/static/chunks/Hf5A5lAS.js"]);
    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toContain("text/javascript");
    expect(response?.headers.get("cache-control")).toContain("immutable");
    expect(response?.headers.get("etag")).toBe('"e1"');
    expect(await response?.text()).toBe("export{}");
  });

  it("returns null when the file is not archived, so the plain 404 answers", async () => {
    const response = await archivedBuildFileResponse(
      new Request("https://d.ebate.app/_next/static/chunks/gone.js"),
      bucketWith({}),
    );
    expect(response).toBeNull();
  });

  it("does not touch the bucket for pages, other methods, or traversal", async () => {
    const bucket = bucketWith({});
    expect(await archivedBuildFileResponse(new Request("https://d.ebate.app/videos"), bucket)).toBeNull();
    expect(
      await archivedBuildFileResponse(new Request("https://d.ebate.app/assets/a.js", { method: "POST" }), bucket),
    ).toBeNull();
    expect(bucket.keys).toEqual([]);
  });

  it("falls through when there is no binding or the lookup throws", async () => {
    const request = new Request("https://d.ebate.app/assets/a.css");
    expect(await archivedBuildFileResponse(request, undefined)).toBeNull();
    const broken: BuildArchiveBucket = {
      get: async () => {
        throw new Error("R2 down");
      },
    };
    expect(await archivedBuildFileResponse(request, broken)).toBeNull();
  });

  it("sends no body for HEAD", async () => {
    const response = await archivedBuildFileResponse(
      new Request("https://d.ebate.app/assets/a.css", { method: "HEAD" }),
      bucketWith({ "assets/a.css": "body{}" }),
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toContain("text/css");
    expect(response?.body).toBeNull();
  });
});

describe("archive helpers", () => {
  it("keys files by path and types them by extension", () => {
    expect(buildArchiveKey("/_next/static/chunks/a.js")).toBe("_next/static/chunks/a.js");
    expect(archivedContentType("/assets/font.woff2")).toBe("font/woff2");
    expect(archivedContentType("/assets/blob.bin")).toBe("application/octet-stream");
  });
});
