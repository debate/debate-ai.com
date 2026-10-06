/**
 * @fileoverview "Bring your own key" for the AI routes: which keys parse, that
 * the key reaches only the AI routes, and which provider errors mean the
 * key is out of credit rather than briefly rate-limited.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AI_KEY_NEEDED_HEADER,
  OWN_AI_KEY_HEADER,
  attachOwnAiKey,
  clearOwnAiKey,
  isKeyExhaustedError,
  isOwnAiKeyRoute,
  maskOwnAiKey,
  parseOwnAiKey,
  setOwnAiKey,
  subscribeToAiKeyNeeded,
} from "../../../src/lib/ai/own-ai-key";

afterEach(() => clearOwnAiKey());

describe("parseOwnAiKey", () => {
  it("recognises OpenRouter and Anthropic keys by prefix", () => {
    expect(parseOwnAiKey("  sk-or-v1-abc123  ")).toEqual({ provider: "openrouter", key: "sk-or-v1-abc123" });
    expect(parseOwnAiKey("sk-ant-api03-xyz")).toEqual({ provider: "anthropic", key: "sk-ant-api03-xyz" });
  });

  it("rejects anything else", () => {
    for (const raw of [null, undefined, "", "sk-proj-openai", "sk-or-has space", `sk-or-${"x".repeat(300)}`]) {
      expect(parseOwnAiKey(raw)).toBeNull();
    }
  });
});

describe("maskOwnAiKey", () => {
  it("keeps only the prefix and last four characters", () => {
    expect(maskOwnAiKey("sk-or-v1-0123456789abcdef")).toBe("sk-or-v1…cdef");
  });
});

describe("isOwnAiKeyRoute", () => {
  it("matches the AI routes on this origin only", () => {
    expect(isOwnAiKeyRoute("/api/reason-ai")).toBe(true);
    expect(isOwnAiKeyRoute("/api/card-ai-analysis?x=1")).toBe(true);
    expect(isOwnAiKeyRoute("/api/search")).toBe(false);
    expect(isOwnAiKeyRoute("https://evil.example/api/reason-ai")).toBe(false);
    expect(isOwnAiKeyRoute("https://debate-ai.com/api/reason-ai", "https://debate-ai.com")).toBe(true);
    expect(isOwnAiKeyRoute("https://evil.example/api/reason-ai", "https://debate-ai.com")).toBe(false);
  });
});

describe("attachOwnAiKey", () => {
  const ok = () => new Response("{}", { status: 200 });

  it("adds the saved key to AI requests and nothing else", async () => {
    const inner = vi.fn(async () => ok());
    const target = { fetch: inner as unknown as typeof fetch };
    const detach = attachOwnAiKey(target);
    setOwnAiKey("sk-or-v1-secret");

    await target.fetch("/api/reason-ai", { method: "POST", headers: { "content-type": "application/json" } });
    await target.fetch("/api/search");

    const [, aiInit] = inner.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(aiInit.headers);
    expect(headers.get(OWN_AI_KEY_HEADER)).toBe("sk-or-v1-secret");
    expect(headers.get("content-type")).toBe("application/json");
    const [, otherInit] = inner.mock.calls[1] as unknown as [string, RequestInit | undefined];
    expect(new Headers(otherInit?.headers).has(OWN_AI_KEY_HEADER)).toBe(false);
    detach();
    expect(target.fetch).toBe(inner);
  });

  it("sends no key header when none is saved", async () => {
    const inner = vi.fn(async () => ok());
    const target = { fetch: inner as unknown as typeof fetch };
    attachOwnAiKey(target);
    await target.fetch("/api/reason-ai");
    const [, init] = inner.mock.calls[0] as unknown as [string, RequestInit | undefined];
    expect(new Headers(init?.headers).has(OWN_AI_KEY_HEADER)).toBe(false);
  });

  it("tells listeners when the shared key has hit its limit", async () => {
    const exhausted = new Response("{}", { status: 503, headers: { [AI_KEY_NEEDED_HEADER]: "shared-limit" } });
    const target = { fetch: vi.fn(async () => exhausted) as unknown as typeof fetch };
    attachOwnAiKey(target);
    const listener = vi.fn();
    const unsubscribe = subscribeToAiKeyNeeded(listener);
    await target.fetch("/api/card-ai-analysis");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

describe("isKeyExhaustedError", () => {
  it("treats out-of-credit and key-limit replies as exhausted", () => {
    expect(isKeyExhaustedError(402, "")).toBe(true);
    expect(isKeyExhaustedError(403, "Key limit exceeded (total limit)")).toBe(true);
    expect(isKeyExhaustedError(400, "Your credit balance is too low")).toBe(true);
  });

  it("leaves rate limits and other errors alone", () => {
    expect(isKeyExhaustedError(429, "Rate limit exceeded")).toBe(false);
    expect(isKeyExhaustedError(400, "messages: field required")).toBe(false);
    expect(isKeyExhaustedError(401, "No auth credentials found")).toBe(false);
  });
});
