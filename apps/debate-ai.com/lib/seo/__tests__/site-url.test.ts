/**
 * @fileoverview Which domain the SEO metadata names.
 *
 * A sitemap whose `<loc>` points at the wrong host is the one SEO failure that
 * costs everything quietly: the URLs are all valid, all fetchable, and all
 * describing a domain the site redirects away from. So the lookup is tested
 * as a resolver — what a given set of variables produces, and what happens when
 * they are set badly.
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  absoluteUrl,
  DEFAULT_SITE_ORIGIN,
  normalizeOrigin,
  resolveSiteOrigin,
  setSiteOriginReader,
  siteOrigin,
} from "../site-url";

/** A reader over a plain object, standing in for the Worker's `env`. */
function reader(vars: Record<string, string>) {
  return (name: string) => vars[name];
}

afterEach(() => {
  // Put the module back on `process.env` so one test's vars cannot leak.
  setSiteOriginReader(null);
  delete process.env.CANONICAL_SITE_URL;
});

describe("normalizeOrigin", () => {
  it("accepts a full origin", () => {
    expect(normalizeOrigin("https://d.ebate.app")).toBe("https://d.ebate.app");
  });

  it("adds https to a bare host, which is what a Host-shaped variable holds", () => {
    expect(normalizeOrigin("d.ebate.app")).toBe("https://d.ebate.app");
    expect(normalizeOrigin("staging.example.com:8787")).toBe("https://staging.example.com:8787");
  });

  it("strips anything that is not part of an origin", () => {
    expect(normalizeOrigin("https://d.ebate.app/")).toBe("https://d.ebate.app");
    expect(normalizeOrigin("https://d.ebate.app/some/path?q=1#x")).toBe("https://d.ebate.app");
  });

  it("rejects a value that is not an origin, rather than emitting a broken URL", () => {
    for (const bad of [undefined, null, "", "   ", "http://", "///"]) {
      expect(normalizeOrigin(bad)).toBeNull();
    }
  });
});

describe("resolveSiteOrigin", () => {
  it("prefers the most specific variable that is set", () => {
    const vars = {
      CANONICAL_SITE_URL: "https://seo.example.com",
      BETTER_AUTH_URL: "https://auth.example.com",
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
    };
    expect(resolveSiteOrigin(reader(vars))).toBe("https://seo.example.com");
  });

  it("falls through the chain in order", () => {
    expect(
      resolveSiteOrigin(
        reader({ BETTER_AUTH_URL: "https://auth.example.com", NEXT_PUBLIC_APP_URL: "https://app.example.com" }),
      ),
    ).toBe("https://auth.example.com");
    expect(resolveSiteOrigin(reader({ NEXT_PUBLIC_APP_URL: "https://app.example.com" }))).toBe(
      "https://app.example.com",
    );
  });

  it("skips a variable set to something unusable and keeps looking", () => {
    // A half-configured deployment should fall through to the next variable,
    // not emit `<loc>undefined/…</loc>`.
    expect(
      resolveSiteOrigin(
        reader({ CANONICAL_SITE_URL: "http://", BETTER_AUTH_URL: "https://auth.example.com" }),
      ),
    ).toBe("https://auth.example.com");
  });

  it("reports nothing configured when no variable is set", () => {
    expect(resolveSiteOrigin(reader({}))).toBeNull();
  });
});

describe("siteOrigin", () => {
  it("uses the production default when nothing is configured", () => {
    expect(siteOrigin()).toBe(DEFAULT_SITE_ORIGIN);
  });

  it("follows the published reader, so the Worker's bindings decide", () => {
    setSiteOriginReader(reader({ CANONICAL_SITE_URL: "https://preview.example.com" }));
    expect(siteOrigin()).toBe("https://preview.example.com");
    // The sitemap's URLs follow it, which is the whole point.
    expect(absoluteUrl("/videos")).toBe("https://preview.example.com/videos");
  });

  it("returns to reading process.env once the reader is cleared", () => {
    setSiteOriginReader(reader({ CANONICAL_SITE_URL: "https://preview.example.com" }));
    setSiteOriginReader(null);
    expect(siteOrigin()).toBe(DEFAULT_SITE_ORIGIN);
  });

  it("reads process.env when no reader has been published", () => {
    // Local dev and tests never run the Worker entry.
    process.env.CANONICAL_SITE_URL = "https://local.example.com";
    expect(siteOrigin()).toBe("https://local.example.com");
  });
});

describe("absoluteUrl", () => {
  it("prefixes a site-relative path with the origin", () => {
    expect(absoluteUrl("/videos")).toBe(`${DEFAULT_SITE_ORIGIN}/videos`);
    expect(absoluteUrl("videos")).toBe(`${DEFAULT_SITE_ORIGIN}/videos`);
  });

  it("leaves an already-absolute URL alone", () => {
    expect(absoluteUrl("https://i.ytimg.com/vi/abc/hqdefault.jpg")).toBe(
      "https://i.ytimg.com/vi/abc/hqdefault.jpg",
    );
  });
});
