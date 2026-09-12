import { describe, expect, it } from "vitest";

import {
  CANONICAL_HOST,
  REDIRECTED_HOSTS,
  handleCanonicalHostRedirect,
} from "../canonical-host";

/** The `Location` of the redirect for `url`, or null when there is none. */
function locationFor(url: string, init?: RequestInit): string | null {
  const response = handleCanonicalHostRedirect(new Request(url, init));
  return response ? response.headers.get("location") : null;
}

describe("handleCanonicalHostRedirect", () => {
  it("sends the ebate.app apex to the d. subdomain", () => {
    expect(locationFor("https://ebate.app/")).toBe("https://d.ebate.app/");
  });

  it("sends www.ebate.app to the d. subdomain", () => {
    expect(locationFor("https://www.ebate.app/")).toBe("https://d.ebate.app/");
  });

  it("keeps the path and query string across the hop", () => {
    expect(locationFor("https://ebate.app/cards/library?topic=nato&page=2")).toBe(
      "https://d.ebate.app/cards/library?topic=nato&page=2",
    );
  });

  it("upgrades a plain-HTTP apex request to https", () => {
    expect(locationFor("http://ebate.app/research")).toBe("https://d.ebate.app/research");
  });

  it("matches the host case-insensitively", () => {
    expect(locationFor("https://EBATE.APP/drills")).toBe("https://d.ebate.app/drills");
  });

  it("redirects permanently without changing the method", () => {
    const response = handleCanonicalHostRedirect(
      new Request("https://ebate.app/api/doc/documents", { method: "POST", body: "{}" }),
    );
    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe("https://d.ebate.app/api/doc/documents");
  });

  it("leaves the canonical host alone", () => {
    expect(handleCanonicalHostRedirect(new Request(`https://${CANONICAL_HOST}/research`))).toBeNull();
  });

  it("leaves every other host this app answers on alone", () => {
    for (const url of [
      "https://debate-ai.com/research",
      "https://www.debate-ai.com/research",
      "https://debate-ai-com.workers.dev/research",
      "http://localhost:3000/research",
    ]) {
      expect(handleCanonicalHostRedirect(new Request(url))).toBeNull();
    }
  });

  it("does not redirect a subdomain that merely ends in the apex", () => {
    expect(handleCanonicalHostRedirect(new Request("https://staging.ebate.app/"))).toBeNull();
  });

  it("lists only the short domain's apex forms as redirected", () => {
    expect(REDIRECTED_HOSTS).toEqual(["ebate.app", "www.ebate.app"]);
    expect(REDIRECTED_HOSTS).not.toContain(CANONICAL_HOST);
  });
});
