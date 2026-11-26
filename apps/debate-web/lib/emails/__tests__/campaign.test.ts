/**
 * @fileoverview The bulk sender: every message carries a per-recipient
 * unsubscribe link, unsubscribed addresses are skipped, and results come back
 * in recipient order for both transports.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const resendState = vi.hoisted(() => ({
  batches: [] as Array<Array<{ to: string[]; headers: Record<string, string> }>>,
  reply: null as null | ((chunk: unknown[]) => unknown),
}));

vi.mock("@/lib/env", () => ({ getEnv: () => undefined }));
vi.mock("@/lib/database/context", () => ({ getCloudflareContext: () => undefined, getDBFromContext: async () => ({}) }));
vi.mock("resend", () => ({
  Resend: class {
    batch = {
      send: async (chunk: Array<{ to: string[]; headers: Record<string, string> }>) => {
        resendState.batches.push(chunk);
        if (resendState.reply) return resendState.reply(chunk);
        return { data: { data: chunk.map((_, i) => ({ id: `id_${i}` })), errors: [] }, error: null };
      },
    };
  },
}));

const { cloudflareTransport, deliverBatch, resendTransport, SKIPPED_UNSUBSCRIBED } = await import("../campaign");
const { UNSUBSCRIBE_URL_PLACEHOLDER } = await import("../unsubscribe");

const rendered = {
  subject: "Hello",
  html: `<a href="${UNSUBSCRIBE_URL_PLACEHOLDER}">Unsubscribe</a>`,
  text: `Unsubscribe: ${UNSUBSCRIBE_URL_PLACEHOLDER}`,
};

beforeEach(() => {
  resendState.batches = [];
  resendState.reply = null;
});

describe("deliverBatch", () => {
  it("gives each recipient their own unsubscribe link in the body and the header", async () => {
    const sent: Array<{ to: string; html: string; text: string; headers: Record<string, string> }> = [];
    const results = await deliverBatch({
      recipients: ["a@x.com", "b@x.com"],
      rendered,
      origin: "https://d.ebate.app",
      transport: async (messages) => {
        sent.push(...messages);
        return messages.map(() => ({ ok: true }));
      },
    });
    expect(results.map((result) => result.status)).toEqual(["sent", "sent"]);
    expect(sent).toHaveLength(2);
    for (const message of sent) {
      expect(message.html).not.toContain(UNSUBSCRIBE_URL_PLACEHOLDER);
      expect(message.html).toContain("https://d.ebate.app/unsubscribe?t=");
      expect(message.text).toContain("https://d.ebate.app/unsubscribe?t=");
      expect(message.headers["List-Unsubscribe"]).toMatch(/^<https:\/\/d\.ebate\.app\/unsubscribe\?t=/);
    }
    expect(sent[0].html).not.toEqual(sent[1].html);
  });

  it("skips unsubscribed addresses without sending to them, keeping order", async () => {
    const seen: string[] = [];
    const results = await deliverBatch({
      recipients: ["a@x.com", "gone@x.com", "c@x.com"],
      rendered,
      origin: "https://d.ebate.app",
      filterSubscribed: async (emails) => emails.filter((email) => email !== "gone@x.com"),
      transport: async (messages) => {
        seen.push(...messages.map((message) => message.to));
        return messages.map((_, i) => (i === 1 ? { ok: false, error: "Bounced" } : { ok: true, id: "m1" }));
      },
    });
    expect(seen).toEqual(["a@x.com", "c@x.com"]);
    expect(results).toEqual([
      { email: "a@x.com", status: "sent", id: "m1" },
      { email: "gone@x.com", status: "skipped", error: SKIPPED_UNSUBSCRIBED },
      { email: "c@x.com", status: "failed", error: "Bounced" },
    ]);
  });

  it("refuses a template with no unsubscribe link", async () => {
    const transport = vi.fn();
    await expect(
      deliverBatch({
        recipients: ["a@x.com"],
        rendered: { subject: "x", html: "<p>no footer</p>", text: "no footer" },
        origin: "https://d.ebate.app",
        transport,
      }),
    ).rejects.toThrow(/unsubscribe/i);
    expect(transport).not.toHaveBeenCalled();
  });

  it("does not call the transport when everyone has unsubscribed", async () => {
    const transport = vi.fn();
    const results = await deliverBatch({
      recipients: ["a@x.com"],
      rendered,
      origin: "https://d.ebate.app",
      filterSubscribed: async () => [],
      transport,
    });
    expect(transport).not.toHaveBeenCalled();
    expect(results).toEqual([{ email: "a@x.com", status: "skipped", error: SKIPPED_UNSUBSCRIBED }]);
  });
});

describe("resendTransport", () => {
  const message = (to: string) => ({ from: "f", to, subject: "s", html: "h", text: "t", headers: {} });

  it("sends 100 per Resend batch call and maps per-index errors", async () => {
    resendState.reply = (chunk) => ({
      data: { data: chunk.slice(1).map((_, i) => ({ id: `id_${i}` })), errors: [{ index: 0, message: "Invalid address" }] },
      error: null,
    });
    const messages = Array.from({ length: 150 }, (_, i) => message(`u${i}@x.com`));
    const outcomes = await resendTransport("re_key")(messages);
    expect(resendState.batches.map((batch) => batch.length)).toEqual([100, 50]);
    expect(outcomes).toHaveLength(150);
    expect(outcomes[0]).toEqual({ ok: false, error: "Invalid address" });
    expect(outcomes[1]).toMatchObject({ ok: true, id: "id_0" });
    expect(outcomes[100]).toEqual({ ok: false, error: "Invalid address" });
  });

  it("fails the whole batch when Resend refuses it, without throwing", async () => {
    resendState.reply = () => ({ data: null, error: { message: "Invalid API key" } });
    const outcomes = await resendTransport("re_key")([message("a@x.com"), message("b@x.com")]);
    expect(outcomes).toEqual([
      { ok: false, error: "Invalid API key" },
      { ok: false, error: "Invalid API key" },
    ]);
  });
});

describe("cloudflareTransport", () => {
  it("sends one message per call and reports each failure", async () => {
    const send = vi.fn(async (message: { to: string }) => {
      if (message.to === "bad@x.com") throw new Error("Recipient rejected");
      return { messageId: `cf_${message.to}` };
    });
    const messages = ["a@x.com", "bad@x.com", "c@x.com"].map((to) => ({
      from: "f",
      to,
      subject: "s",
      html: "h",
      text: "t",
      headers: {},
    }));
    const outcomes = await cloudflareTransport({ send }, 2)(messages);
    expect(send).toHaveBeenCalledTimes(3);
    expect(outcomes).toEqual([
      { ok: true, id: "cf_a@x.com" },
      { ok: false, error: "Recipient rejected" },
      { ok: true, id: "cf_c@x.com" },
    ]);
  });
});
