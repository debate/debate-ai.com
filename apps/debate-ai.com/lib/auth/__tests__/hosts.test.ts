import { describe, expect, it } from "vitest";
import {
  DEFAULT_ALLOWED_HOSTS,
  buildAllowedHosts,
  buildTrustedOrigins,
  hostOf,
  parseList,
} from "../hosts";
import { EXTENSION_ORIGIN } from "debate-ai-webui/lib/config/site";

describe("parseList", () => {
  it("splits a comma-separated value and drops the empties", () => {
    expect(parseList(" a.com , ,b.com ")).toEqual(["a.com", "b.com"]);
  });

  it("treats unset and empty as no entries", () => {
    expect(parseList(undefined)).toEqual([]);
    expect(parseList("")).toEqual([]);
  });
});

describe("hostOf", () => {
  it("keeps a bare host as-is", () => {
    expect(hostOf("ebate.app")).toBe("ebate.app");
  });

  it("reduces an origin or URL to its host, port included", () => {
    expect(hostOf("https://ebate.app/login")).toBe("ebate.app");
    expect(hostOf("http://localhost:3000")).toBe("localhost:3000");
  });

  it("returns null for values no browser could be served from", () => {
    expect(hostOf("")).toBeNull();
    expect(hostOf("   ")).toBeNull();
  });
});

describe("buildAllowedHosts", () => {
  it("covers every domain this app is served from", () => {
    const hosts = buildAllowedHosts();
    // The regression this fixes: sign-in 403'd with "Invalid origin" on the
    // short domain because only the canonical one was ever allowed.
    expect(hosts).toContain("ebate.app");
    expect(hosts).toContain("debate-ai.com");
    expect(hosts).toContain("localhost:3000");
  });

  it("keeps wildcard patterns intact rather than URL-parsing them", () => {
    expect(buildAllowedHosts()).toContain("*.vercel.app");
  });

  it("adds the host of an explicitly configured base URL", () => {
    expect(buildAllowedHosts({ configuredBaseURL: "https://staging.example.com" })).toContain(
      "staging.example.com",
    );
  });

  it("accepts extra hosts as hosts, origins or patterns", () => {
    const hosts = buildAllowedHosts({
      extraHosts: "extra.example, https://origin.example, *.preview.example",
    });
    expect(hosts).toEqual(
      expect.arrayContaining(["extra.example", "origin.example", "*.preview.example"]),
    );
  });

  it("does not repeat a host already in the defaults", () => {
    const hosts = buildAllowedHosts({
      configuredBaseURL: "https://debate-ai.com",
      extraHosts: "ebate.app",
    });
    expect(hosts.filter((host) => host === "debate-ai.com")).toHaveLength(1);
    expect(hosts.filter((host) => host === "ebate.app")).toHaveLength(1);
  });

  it("never lets a bad entry through as an empty host", () => {
    expect(buildAllowedHosts({ extraHosts: " , " })).not.toContain("");
    expect(DEFAULT_ALLOWED_HOSTS.every(Boolean)).toBe(true);
  });
});

describe("buildTrustedOrigins", () => {
  it("always trusts the canonical origin and the dev server", () => {
    const origins = buildTrustedOrigins();
    expect(origins).toContain("https://debate-ai.com");
    expect(origins).toContain("http://localhost:3000");
  });

  it("trusts the browser extension, by its exact id and not a wildcard", () => {
    const origins = buildTrustedOrigins();
    // Without this the extension's sign-in handoff — a POST to
    // /api/auth/one-time-token/verify from chrome-extension://<id> — is
    // rejected by better-auth's origin check before it reaches the endpoint.
    expect(origins).toContain(EXTENSION_ORIGIN);
    // A wildcard here would trust every extension the visitor has installed.
    expect(origins).not.toContain("chrome-extension://*");
    expect(origins.some((origin) => origin.includes("*"))).toBe(false);
  });

  it("merges the configured base URL and the env-supplied extras", () => {
    const origins = buildTrustedOrigins({
      configuredBaseURL: "https://staging.example.com",
      extraOrigins: "https://one.example, https://two.example",
    });
    expect(origins).toEqual(
      expect.arrayContaining([
        "https://staging.example.com",
        "https://one.example",
        "https://two.example",
      ]),
    );
  });

  it("deduplicates", () => {
    const origins = buildTrustedOrigins({
      configuredBaseURL: "https://debate-ai.com",
      extraOrigins: "https://debate-ai.com",
    });
    expect(origins.filter((origin) => origin === "https://debate-ai.com")).toHaveLength(1);
  });
});
