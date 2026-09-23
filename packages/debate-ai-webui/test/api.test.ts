import { describe, expect, it } from "vitest";

import { apiBaseUrl, siteUrl, unwrap, DEFAULT_ORIGIN } from "../src/api";

describe("apiBaseUrl", () => {
  it("appends the API prefix to a deployment origin", () => {
    expect(apiBaseUrl("https://debate-ai.com")).toBe("https://debate-ai.com/api");
    expect(apiBaseUrl("http://localhost:3000")).toBe("http://localhost:3000/api");
  });

  it("tolerates a trailing slash", () => {
    expect(apiBaseUrl("https://debate-ai.com/")).toBe("https://debate-ai.com/api");
    expect(apiBaseUrl("https://debate-ai.com///")).toBe("https://debate-ai.com/api");
  });

  it("leaves an origin that already names the API prefix alone", () => {
    // The extension's `apiBase` setting is documented as either form, so
    // configuring it as the API base must not produce /api/api.
    expect(apiBaseUrl("https://debate-ai.com/api")).toBe("https://debate-ai.com/api");
  });

  it("falls back to production for a blank or unparseable origin", () => {
    // A relative base would resolve against the *host's* origin — for an
    // extension page, `chrome-extension://<id>/api`, which reaches nothing.
    for (const value of ["", "   ", undefined, "debate-ai.com", "not a url"]) {
      expect(apiBaseUrl(value)).toBe(`${DEFAULT_ORIGIN}/api`);
    }
  });
});

describe("siteUrl", () => {
  it("strips the API prefix back off and appends the route", () => {
    expect(siteUrl("https://debate-ai.com", "/cards")).toBe("https://debate-ai.com/cards");
    expect(siteUrl("https://debate-ai.com/api", "/cards")).toBe("https://debate-ai.com/cards");
  });

  it("defaults to the site root and tolerates a route without its slash", () => {
    expect(siteUrl("http://localhost:3000")).toBe("http://localhost:3000/");
    expect(siteUrl("http://localhost:3000", "videos")).toBe("http://localhost:3000/videos");
  });
});

describe("unwrap", () => {
  it("returns the payload of a successful call", async () => {
    await expect(unwrap(Promise.resolve({ data: { total: 3 } }))).resolves.toEqual({ total: 3 });
  });

  it("throws the API's own message — the SDK never rejects on its own", async () => {
    await expect(unwrap(Promise.resolve({ error: "Missing or invalid url." }))).rejects.toThrow(
      "Missing or invalid url.",
    );
  });

  it("throws rather than resolving undefined when a call returns neither", async () => {
    await expect(unwrap(Promise.resolve({}))).rejects.toThrow(/empty response/i);
  });

  it("treats a falsy-but-present payload as data", async () => {
    // `alreadyCut: false` and `total: 0` are answers, not missing responses.
    await expect(unwrap(Promise.resolve({ data: 0 }))).resolves.toBe(0);
    await expect(unwrap(Promise.resolve({ data: false }))).resolves.toBe(false);
  });
});
