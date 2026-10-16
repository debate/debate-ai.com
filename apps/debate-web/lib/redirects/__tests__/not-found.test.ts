import { describe, expect, it } from "vitest";

import { notFoundFallbackPath, redirectNotFound } from "../not-found";

const NOT_FOUND = () => new Response("missing", { status: 404 });

function navigate(url: string, headers: Record<string, string> = { "sec-fetch-dest": "document" }): Request {
  return new Request(url, { headers });
}

describe("notFoundFallbackPath", () => {
  it("drops the last segment", () => {
    expect(notFoundFallbackPath("/tournaments/2026/nope")).toBe("/tournaments/2026");
    expect(notFoundFallbackPath("/tournaments/nope/")).toBe("/tournaments");
    expect(notFoundFallbackPath("/nope")).toBe("/");
  });

  it("has nowhere to go from the root", () => {
    expect(notFoundFallbackPath("/")).toBeNull();
  });
});

describe("redirectNotFound", () => {
  it("sends a missing page one segment up", () => {
    const response = redirectNotFound(navigate("https://d.ebate.app/tournaments/nope?x=1"), NOT_FOUND());
    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toBe("https://d.ebate.app/tournaments");
  });

  it("accepts an HTML Accept header when Sec-Fetch-Dest is absent", () => {
    const request = navigate("https://d.ebate.app/research/cards/nope", { accept: "text/html,*/*" });
    expect(redirectNotFound(request, NOT_FOUND())?.headers.get("location")).toBe("https://d.ebate.app/research/cards");
  });

  it("leaves found pages alone", () => {
    expect(redirectNotFound(navigate("https://d.ebate.app/tournaments"), new Response("ok"))).toBeNull();
  });

  it("keeps the 404 for API calls, assets, RSC fetches and non-document requests", () => {
    expect(redirectNotFound(navigate("https://d.ebate.app/api/nope"), NOT_FOUND())).toBeNull();
    expect(redirectNotFound(navigate("https://d.ebate.app/logo-missing.png"), NOT_FOUND())).toBeNull();
    expect(redirectNotFound(navigate("https://d.ebate.app/nope", { rsc: "1", accept: "text/x-component" }), NOT_FOUND())).toBeNull();
    expect(redirectNotFound(navigate("https://d.ebate.app/nope", { "sec-fetch-dest": "empty" }), NOT_FOUND())).toBeNull();
    expect(redirectNotFound(new Request("https://d.ebate.app/nope", { method: "POST" }), NOT_FOUND())).toBeNull();
  });

  it("does not redirect the root", () => {
    expect(redirectNotFound(navigate("https://d.ebate.app/"), NOT_FOUND())).toBeNull();
  });
});
