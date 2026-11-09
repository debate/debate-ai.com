/** @vitest-environment jsdom */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { EmailsPanel } from "../../../src/components/admin/users/EmailsPanel";
import { bodyText, button, change, cleanup, clickAsync, flush, installDomShims, mockFetch, mount } from "../../helpers/dom";

const TEMPLATES = [
  { id: "welcome", name: "Welcome", description: "Greets a new account.", sentFrom: null },
  { id: "file-invite", name: "File collaboration invite", description: "A share.", sentFrom: "POST /api/card-shares" },
];

beforeAll(() => installDomShims());
afterEach(() => cleanup());
beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

function routes(sendRespond: (call: { body: unknown }) => unknown) {
  return mockFetch([
    { match: "/api/admin/emails/send", method: "POST", respond: sendRespond },
    { match: "/api/admin/emails?template=", respond: { subject: "Welcome to Debate AI", html: "<p>hi</p>", text: "hi" } },
    { match: "/api/admin/emails", method: "POST", respond: { ok: true, to: "admin@example.com" } },
    { match: "/api/admin/emails", respond: { templates: TEMPLATES } },
  ]);
}

const textarea = () => document.querySelector("textarea[aria-label='Email addresses']") as HTMLTextAreaElement;

describe("EmailsPanel send to a list", () => {
  it("counts, dedupes and flags invalid addresses before sending", async () => {
    routes(() => ({}));
    mount(<EmailsPanel />);
    await flush();
    change(textarea(), "a@x.com, A@x.com\nnope");
    expect(bodyText()).toContain("1 address (1 duplicate skipped)");
    expect(bodyText()).toContain("Not email addresses: nope");
    expect(button(/Send to 1 address/).disabled).toBe(true);
  });

  it("sends the parsed list and keeps only failed addresses to retry", async () => {
    const { calls } = routes(() => ({
      sent: 1,
      failed: 1,
      results: [
        { email: "a@x.com", ok: true },
        { email: "b@x.com", ok: false, error: "Bounced" },
      ],
    }));
    mount(<EmailsPanel />);
    await flush();
    change(textarea(), "a@x.com\nb@x.com");
    await clickAsync(button(/Send to 2 addresses/));
    await flush();
    const sendCall = calls.find((call) => call.url.includes("/send"));
    expect(sendCall?.body).toEqual({ template: "welcome", recipients: ["a@x.com", "b@x.com"] });
    expect(bodyText()).toContain("Sent 1 of 2.");
    expect(bodyText()).toContain("b@x.com: Bounced");
    expect(textarea().value).toBe("b@x.com");
  });

  it("shows the route's error and sends nothing when the admin cancels", async () => {
    const { calls } = routes(() => new Response(JSON.stringify({ error: "RESEND_API_KEY is not set" }), { status: 503 }));
    mount(<EmailsPanel />);
    await flush();
    change(textarea(), "a@x.com");
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await clickAsync(button(/Send to 1 address/));
    expect(calls.some((call) => call.url.includes("/send"))).toBe(false);
    await clickAsync(button(/Send to 1 address/));
    await flush();
    expect(bodyText()).toContain("RESEND_API_KEY is not set");
  });

  it("only offers the list box for the welcome email", async () => {
    routes(() => ({}));
    mount(<EmailsPanel />);
    await flush();
    expect(textarea()).not.toBeNull();
    await clickAsync(button(/File collaboration invite/));
    expect(textarea()).toBeNull();
  });
});
