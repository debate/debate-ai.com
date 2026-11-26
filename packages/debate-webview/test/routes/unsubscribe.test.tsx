/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => search.params }));

import UnsubscribePage from "../../src/routes/unsubscribe/page";
import { bodyText, button, cleanup, clickAsync, flush, installDomShims, mockFetch, mount } from "../helpers/dom";

beforeAll(() => installDomShims());
afterEach(() => {
  cleanup();
  search.params = new URLSearchParams();
});

function open(token?: string) {
  search.params = new URLSearchParams(token ? { t: token } : {});
}

describe("Unsubscribe landing page", () => {
  it("explains a link with no token and never calls the API", async () => {
    open();
    const { calls } = mockFetch([]);
    mount(<UnsubscribePage />);
    await flush();
    expect(bodyText()).toContain("missing its token");
    expect(calls).toHaveLength(0);
  });

  it("looks the token up (URL-encoded) and asks for confirmation", async () => {
    open("a+b/c=");
    const { calls } = mockFetch([{ match: "/api/emails/unsubscribe", respond: { email: "debater@example.com", unsubscribed: false } }]);
    mount(<UnsubscribePage />);
    expect(bodyText()).toContain("Checking that link…");
    await flush();
    expect(calls[0]!.url).toBe(`/api/emails/unsubscribe?t=${encodeURIComponent("a+b/c=")}`);
    expect(bodyText()).toContain("Stop all Debate AI emails to debater@example.com?");
    expect(button("Unsubscribe from all emails")).toBeTruthy();
  });

  it("confirms the unsubscribe with a POST and shows the result", async () => {
    open("tok");
    const { calls } = mockFetch([
      { match: "/api/emails/unsubscribe", method: "POST", respond: { email: "debater@example.com" } },
      { match: "/api/emails/unsubscribe", respond: { email: "debater@example.com", unsubscribed: false } },
    ]);
    mount(<UnsubscribePage />);
    await flush();
    await clickAsync(button("Unsubscribe from all emails"));
    const post = calls.find((call) => call.method === "POST");
    expect(post?.body).toEqual({ token: "tok", action: "unsubscribe" });
    expect(bodyText()).toContain("Unsubscribed: debater@example.com");
    expect(bodyText()).not.toContain("Already unsubscribed");
    expect(bodyText()).toContain("You will not get further Debate AI emails");
  });

  it("says so when the address was already unsubscribed", async () => {
    open("tok");
    mockFetch([{ match: "/api/emails/unsubscribe", respond: { email: "debater@example.com", unsubscribed: true } }]);
    mount(<UnsubscribePage />);
    await flush();
    expect(bodyText()).toContain("Already unsubscribed: debater@example.com");
    expect(document.querySelector("button")).toBeNull();
  });

  it("ends the sentence plainly when the address is unknown", async () => {
    open("tok");
    mockFetch([{ match: "/api/emails/unsubscribe", respond: { unsubscribed: true } }]);
    mount(<UnsubscribePage />);
    await flush();
    expect(bodyText()).toContain("Already unsubscribed. You will not get");
  });

  it("shows the server's reason for a bad token, or a default for an unreadable reply", async () => {
    open("bad");
    mockFetch([{ match: "/api/emails/unsubscribe", respond: { error: "Token expired" }, status: 400 }]);
    mount(<UnsubscribePage />);
    await flush();
    expect(bodyText()).toContain("Token expired");
    cleanup();

    mockFetch([{ match: "/api/emails/unsubscribe", respond: new Response("not json", { status: 500 }) }]);
    mount(<UnsubscribePage />);
    await flush();
    expect(bodyText()).toContain("That unsubscribe link is invalid or expired.");
  });

  it("asks to retry when the lookup cannot reach the server", async () => {
    open("tok");
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    mount(<UnsubscribePage />);
    await flush();
    expect(bodyText()).toContain("Could not reach the server. Try again in a moment.");
  });

  it("keeps the confirm button and shows why when the POST fails", async () => {
    open("tok");
    mockFetch([
      { match: "/api/emails/unsubscribe", method: "POST", respond: { error: "Rate limited" }, status: 429 },
      { match: "/api/emails/unsubscribe", respond: { email: "debater@example.com", unsubscribed: false } },
    ]);
    mount(<UnsubscribePage />);
    await flush();
    await clickAsync(button("Unsubscribe from all emails"));
    expect(bodyText()).toContain("Rate limited");
    expect(button("Unsubscribe from all emails").disabled).toBe(false);
  });

  it("falls back to a default message, and handles a dropped connection on confirm", async () => {
    open("tok");
    const routes = mockFetch([
      { match: "/api/emails/unsubscribe", method: "POST", respond: new Response("oops", { status: 500 }) },
      { match: "/api/emails/unsubscribe", respond: { email: "debater@example.com", unsubscribed: false } },
    ]);
    mount(<UnsubscribePage />);
    await flush();
    await clickAsync(button("Unsubscribe from all emails"));
    expect(bodyText()).toContain("Could not unsubscribe.");

    const original = routes.fn.getMockImplementation()!;
    routes.fn.mockImplementation(async (input, init) => {
      if (init?.method === "POST") throw new TypeError("offline");
      return original(input, init);
    });
    await clickAsync(button("Unsubscribe from all emails"));
    expect(bodyText()).toContain("Could not reach the server. Try again in a moment.");
  });

  it("links to notification settings and home", async () => {
    open("tok");
    mockFetch([{ match: "/api/emails/unsubscribe", respond: { email: "e@x.com", unsubscribed: false } }]);
    mount(<UnsubscribePage />);
    await flush();
    const hrefs = [...document.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/settings?category=notifications");
    expect(hrefs).toContain("/");
  });
});
