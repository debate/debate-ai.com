/** @vitest-environment jsdom */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { EmailComposePanel } from "../../../src/components/admin/users/EmailComposePanel";
import { EmailListsPanel } from "../../../src/components/admin/users/EmailListsPanel";
import { EmailSettingsPanel } from "../../../src/components/admin/users/EmailSettingsPanel";
import { bodyText, button, change, cleanup, clickAsync, flush, installDomShims, mockFetch, mount } from "../../helpers/dom";

beforeAll(() => installDomShims());
afterEach(() => cleanup());
beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

const field = (label: string) => document.querySelector(`[aria-label='${label}']`) as HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement;

describe("EmailSettingsPanel", () => {
  const status = (over: object = {}) => ({ saved: false, endsIn: "", unreadable: false, envFallback: false, source: null, ...over });

  it("shows only a masked status once a key is saved, and offers replace and remove", async () => {
    const { calls } = mockFetch([
      { match: "/resend-key", method: "POST", respond: { status: status({ saved: true, endsIn: "wxyz", source: "saved" }) } },
      { match: "/resend-key", method: "DELETE", respond: { status: status() } },
      { match: "/resend-key", respond: { status: status() } },
    ]);
    mount(<EmailSettingsPanel />);
    await flush();
    expect(bodyText()).toContain("Not set");
    expect(field("Resend API key").type).toBe("password");

    change(field("Resend API key"), "re_theSecretValue1234wxyz");
    await clickAsync(button("Save key"));
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ key: "re_theSecretValue1234wxyz" });
    expect(bodyText()).toContain("Saved, ends in wxyz");
    expect(bodyText()).not.toContain("theSecretValue");
    expect(field("Resend API key").value).toBe("");
    expect(button("Replace key")).toBeTruthy();

    await clickAsync(button("Remove key"));
    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
    expect(bodyText()).toContain("Not set");
  });

  it("says when sends fall back to the env secret", async () => {
    mockFetch([{ match: "/resend-key", respond: { status: status({ envFallback: true, source: "env" }) } }]);
    mount(<EmailSettingsPanel />);
    await flush();
    expect(bodyText()).toContain("Using env secret");
  });
});

describe("EmailListsPanel", () => {
  it("counts, flags and saves a list, then reloads it for editing", async () => {
    const saved = { id: "l1", name: "Coaches", count: 2, emails: ["a@x.com", "b@x.com"] };
    const { calls } = mockFetch([
      { match: "/lists?id=l1", respond: { list: saved } },
      { match: "/lists", method: "POST", respond: { list: saved, duplicates: 1 } },
      { match: "/lists", method: "DELETE", respond: { ok: true } },
      { match: "/lists", respond: { lists: [] } },
    ]);
    mount(<EmailListsPanel />);
    await flush();

    change(field("List name"), "Coaches");
    change(field("List addresses"), "A@x.com, b@x.com\na@x.com\nnope");
    expect(bodyText()).toContain("2 addresses (1 duplicate will be removed)");
    expect(bodyText()).toContain("Not email addresses: nope");
    expect(button("Save list").disabled).toBe(true);

    change(field("List addresses"), "A@x.com, b@x.com\na@x.com");
    await clickAsync(button("Save list"));
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ name: "Coaches", emails: "A@x.com, b@x.com\na@x.com" });
    expect(bodyText()).toContain("Saved 2 addresses (1 duplicate removed).");
    expect(field("List addresses").value).toBe("a@x.com\nb@x.com");

    await clickAsync(button("Delete"));
    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
    expect(field("List addresses").value).toBe("");
  });
});

describe("EmailListsPanel import", () => {
  const preview = (over: object = {}) => ({
    total: 3,
    excludedUnsubscribed: 1,
    invalid: 0,
    sources: [
      { id: "accounts", label: "Registered accounts", count: 3, added: 3 },
      { id: "stripe", label: "Stripe billing emails", count: 2, added: 0 },
    ],
    existing: null,
    added: 3,
    removed: 0,
    maxRecipients: 20000,
    ...over,
  });
  const saved = { id: "current-customers", name: "All current customers", count: 3, emails: ["a@x.com", "b@x.com", "c@x.com"] };

  it("previews counts by source, then saves the customers list", async () => {
    const { calls } = mockFetch([
      { match: "/lists/import", method: "POST", respond: { list: { id: saved.id, name: saved.name, count: 3 }, report: { excludedUnsubscribed: 1 } } },
      { match: "/lists/import", respond: { preview: preview() } },
      { match: "/lists?id=current-customers", respond: { list: saved } },
      { match: "/lists", respond: { lists: [] } },
    ]);
    mount(<EmailListsPanel />);
    await flush();
    await clickAsync(button("Import existing emails"));
    await flush();
    expect(bodyText()).toContain("3 addresses will be saved, 1 unsubscribed left out.");
    expect(bodyText()).toContain("Registered accounts");
    expect(bodyText()).toContain("2 found, 0 new");
    expect(field("Import list name").value).toBe("All current customers");

    change(field("Import list name"), "Everyone");
    await clickAsync(button("Save list"));
    await flush();
    expect(calls.find((c) => c.method === "POST" && c.url.includes("/lists/import"))?.body).toEqual({ name: "Everyone" });
    expect(bodyText()).toContain('Imported "All current customers" with 3 addresses (1 unsubscribed left out).');
    expect(field("List addresses").value).toBe("a@x.com\nb@x.com\nc@x.com");
  });

  it("offers a refresh with what it would add and remove when the list exists", async () => {
    mockFetch([
      { match: "/lists/import", respond: { preview: preview({ existing: { id: "current-customers", name: "Everyone", count: 2 }, added: 2, removed: 1 }) } },
      { match: "/lists", respond: { lists: [] } },
    ]);
    mount(<EmailListsPanel />);
    await flush();
    await clickAsync(button("Import existing emails"));
    await flush();
    expect(field("Import list name").value).toBe("Everyone");
    expect(bodyText()).toContain("refreshing adds 2 and removes 1");
    expect(button("Refresh from current users").disabled).toBe(false);
  });

  it("will not save an empty import", async () => {
    mockFetch([
      { match: "/lists/import", respond: { preview: preview({ total: 0, sources: [] }) } },
      { match: "/lists", respond: { lists: [] } },
    ]);
    mount(<EmailListsPanel />);
    await flush();
    await clickAsync(button("Import existing emails"));
    await flush();
    expect(bodyText()).toContain("No subscribed customer emails were found.");
    expect(button("Save list").disabled).toBe(true);
  });
});

describe("EmailComposePanel", () => {
  const template = { id: "t1", name: "News", subject: "Big news", body: "Hello" };
  const list = { id: "l1", name: "Coaches", count: 3 };

  function routes(sendBatch: (call: { body: unknown }) => unknown) {
    return mockFetch([
      { match: "/campaign", method: "POST", respond: sendBatch },
      {
        match: "/campaign",
        respond: { providers: { resend: { ready: true, batchSize: 100 }, cloudflare: { ready: false, batchSize: 25 } } },
      },
      { match: "/templates", method: "POST", respond: (call: { body: { action?: string } }) => (call.body.action === "preview" ? { subject: "Big news", html: "<p>hi</p>", text: "hi" } : { template }) },
      { match: "/templates", respond: { templates: [template], starter: { name: "Welcome", subject: "Welcome to Debate AI", body: "# Welcome" } } },
      { match: "/lists", respond: { lists: [list] } },
    ]);
  }

  it("starts a template from the Welcome email and previews it", async () => {
    const { calls } = routes(() => ({}));
    mount(<EmailComposePanel />);
    await flush();
    await clickAsync(button("Start from Welcome email"));
    expect(field("Subject").value).toBe("Welcome to Debate AI");
    expect(field("Email body").value).toBe("# Welcome");
    await clickAsync(button("Preview"));
    expect(calls.find((c) => (c.body as { action?: string })?.action === "preview")?.body).toEqual({
      action: "preview",
      subject: "Welcome to Debate AI",
      body: "# Welcome",
    });
    expect(document.querySelector("iframe")?.getAttribute("srcdoc")).toBe("<p>hi</p>");
  });

  it("confirms with the recipient count, sends in batches and shows each result", async () => {
    const { calls } = routes((call) => {
      const { offset = 0 } = call.body as { offset?: number };
      return offset === 0
        ? {
            results: [
              { email: "a@x.com", status: "sent" },
              { email: "b@x.com", status: "failed", error: "Mailbox full" },
            ],
            totals: { sent: 1, failed: 1, skipped: 0 },
            total: 3,
            nextOffset: 2,
          }
        : {
            results: [{ email: "c@x.com", status: "skipped", error: "Unsubscribed from Debate AI emails" }],
            totals: { sent: 0, failed: 0, skipped: 1 },
            total: 3,
            nextOffset: null,
          };
    });
    mount(<EmailComposePanel />);
    await flush();
    await clickAsync(button(/News/));
    change(field("List"), "l1");
    await flush();
    expect(button("Review and send").disabled).toBe(false);

    await clickAsync(button("Review and send"));
    expect(bodyText()).toContain("Send Big news to 3 addresses in Coaches through Resend, in batches of 100?");
    expect(calls.filter((c) => c.url.includes("/campaign") && c.method === "POST")).toHaveLength(0);

    await clickAsync(button("Send to 3 addresses"));
    await flush();
    const posts = calls.filter((c) => c.url.includes("/campaign") && c.method === "POST");
    expect(posts.map((c) => c.body)).toEqual([
      { templateId: "t1", listId: "l1", provider: "resend", offset: 0 },
      { templateId: "t1", listId: "l1", provider: "resend", offset: 2 },
    ]);
    expect(bodyText()).toContain("Sent 1, failed 1, skipped 1.");
    expect(bodyText()).toContain("b@x.com (failed): Mailbox full");
    expect(bodyText()).toContain("c@x.com (skipped): Unsubscribed from Debate AI emails");
  });

  it("keeps sending off for a provider that is not set up and when the template has unsaved edits", async () => {
    routes(() => ({}));
    mount(<EmailComposePanel />);
    await flush();
    await clickAsync(button(/News/));
    change(field("List"), "l1");
    change(field("Provider"), "cloudflare");
    expect(button("Review and send").disabled).toBe(true);
    expect(bodyText()).toContain("EMAIL send_email binding");
    change(field("Provider"), "resend");
    expect(button("Review and send").disabled).toBe(false);
    change(field("Subject"), "Edited");
    expect(button("Review and send").disabled).toBe(true);
    expect(bodyText()).toContain("Save your changes to the template before sending.");
  });

  it("refreshes the customers list and confirms the recipient count before sending to all current customers", async () => {
    const customers = { id: "current-customers", name: "All current customers", count: 7 };
    let refreshed = false;
    const { calls } = mockFetch([
      { match: "/lists/import", method: "POST", respond: () => ((refreshed = true), { list: customers, report: {} }) },
      { match: "/campaign", method: "POST", respond: () => ({ results: [{ email: "a@x.com", status: "sent" }], totals: { sent: 1, failed: 0, skipped: 0 }, total: 7, nextOffset: null }) },
      { match: "/campaign", respond: { providers: { resend: { ready: true, batchSize: 100 }, cloudflare: { ready: false, batchSize: 25 } } } },
      { match: "/templates", respond: { templates: [template], starter: { name: "Welcome", subject: "Welcome to Debate AI", body: "# Welcome" } } },
      { match: "/lists", respond: () => ({ lists: refreshed ? [list, customers] : [list] }) },
    ]);
    mount(<EmailComposePanel />);
    await flush();
    expect(button("Send to all current customers").disabled).toBe(true);
    await clickAsync(button(/News/));
    await clickAsync(button("Send to all current customers"));
    await flush();
    expect(bodyText()).toContain("Send Big news to 7 addresses in All current customers through Resend");
    expect(calls.filter((c) => c.url.includes("/campaign") && c.method === "POST")).toHaveLength(0);

    await clickAsync(button("Send to 7 addresses"));
    await flush();
    expect(calls.find((c) => c.url.includes("/campaign") && c.method === "POST")?.body).toEqual({
      templateId: "t1",
      listId: "current-customers",
      provider: "resend",
      offset: 0,
    });
  });
});
