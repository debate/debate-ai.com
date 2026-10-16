import { describe, expect, it } from "vitest"
import {
  DEFAULT_QWKSEARCH_ORIGIN,
  buildAuthorizeUrl,
  connectionFromToken,
  parseConnection,
  parsePending,
  pkceChallenge,
  qwksearchOrigin,
  randomToken,
  safeReturnTo,
  sameString,
  serializeConnection,
  serializePending,
  toSessionPayload,
  withStatus,
} from "../connect"

const TOKEN = {
  token_type: "api_key",
  api_key: "qwk_abc",
  user: { id: "u1", name: "Ada", email: "ada@example.com", image: null },
  plan: "free",
  upgrade_url: "https://buy.stripe.com/x?client_reference_id=u1",
}

describe("safeReturnTo", () => {
  it("keeps same-origin paths and refuses anything that could leave the site", () => {
    expect(safeReturnTo("/settings/research?tab=1")).toBe("/settings/research?tab=1")
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "doc", "", null]) {
      expect(safeReturnTo(bad)).toBe("/doc")
    }
  })
})

describe("withStatus", () => {
  it("adds the outcome without dropping existing params or the hash", () => {
    expect(withStatus("/doc?x=1#top", "connected")).toBe("/doc?x=1&qwksearch=connected#top")
  })
})

describe("qwksearchOrigin", () => {
  it("defaults to qwksearch.com and normalizes overrides to an origin", () => {
    expect(qwksearchOrigin(undefined)).toBe(DEFAULT_QWKSEARCH_ORIGIN)
    expect(qwksearchOrigin("https://beta.qwksearch.com/")).toBe("https://beta.qwksearch.com")
    expect(qwksearchOrigin("not a url")).toBe(DEFAULT_QWKSEARCH_ORIGIN)
  })
})

describe("PKCE + authorize URL", () => {
  it("makes RFC 7636-shaped verifiers and the known S256 challenge", async () => {
    expect(randomToken(48)).toMatch(/^[A-Za-z0-9_-]{64}$/)
    // RFC 7636 Appendix B test vector.
    expect(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    )
  })

  it("points at /connect with every parameter QwkSearch requires", () => {
    const url = new URL(
      buildAuthorizeUrl({
        origin: "https://qwksearch.com",
        redirectUri: "https://debate-ai.com/api/qwksearch/callback",
        state: "s",
        challenge: "c",
      }),
    )
    expect(url.origin + url.pathname).toBe("https://qwksearch.com/connect")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      redirect_uri: "https://debate-ai.com/api/qwksearch/callback",
      state: "s",
      code_challenge: "c",
      code_challenge_method: "S256",
    })
  })
})

describe("pending-flow cookie", () => {
  it("round-trips and sanitizes the return path", () => {
    const raw = serializePending({ verifier: "v", state: "s", returnTo: "https://evil.com" })
    expect(parsePending(raw)).toEqual({ verifier: "v", state: "s", returnTo: "/doc" })
    expect(parsePending("garbage")).toBeNull()
    expect(parsePending(undefined)).toBeNull()
  })
})

describe("sameString", () => {
  it("compares exactly", () => {
    expect(sameString("abc", "abc")).toBe(true)
    expect(sameString("abc", "abd")).toBe(false)
    expect(sameString("abc", "ab")).toBe(false)
  })
})

describe("connections", () => {
  const now = new Date("2026-10-07T00:00:00Z")

  it("builds one from the token response and round-trips through storage", () => {
    const connection = connectionFromToken(TOKEN, null, now)
    expect(connection).toEqual({
      apiKey: "qwk_abc",
      user: { id: "u1", name: "Ada", email: "ada@example.com", image: null },
      plan: "free",
      upgradeUrl: TOKEN.upgrade_url,
      connectedAt: "2026-10-07T00:00:00.000Z",
    })
    expect(parseConnection(serializeConnection(connection))).toEqual(connection)
  })

  it("keeps the stored key when refreshing from /api/connect/me, which omits it", () => {
    const previous = connectionFromToken(TOKEN, null, now)
    const refreshed = connectionFromToken({ user: TOKEN.user, plan: "pro", upgrade_url: null }, previous, now)
    expect(refreshed).toMatchObject({ apiKey: "qwk_abc", plan: "pro", upgradeUrl: null })
  })

  it("rejects responses without a key or user", () => {
    expect(connectionFromToken({ user: TOKEN.user })).toBeNull()
    expect(connectionFromToken({ api_key: "k" })).toBeNull()
    expect(connectionFromToken(null)).toBeNull()
    expect(parseConnection("{")).toBeNull()
  })

  it("answers the session shape research-agent-ui reads", () => {
    expect(toSessionPayload(null)).toEqual({ connected: false })
    expect(toSessionPayload(connectionFromToken(TOKEN, null, now))).toEqual({
      connected: true,
      user: { id: "u1", name: "Ada", email: "ada@example.com", image: null },
      apiKey: "qwk_abc",
      plan: "free",
      upgradeUrl: TOKEN.upgrade_url,
    })
  })
})
