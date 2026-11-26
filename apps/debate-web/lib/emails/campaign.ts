/**
 * @fileoverview Sends one batch of a bulk email to a slice of a saved list,
 * through Resend or a Cloudflare Worker `send_email` binding.
 *
 * Every message carries the signed unsubscribe link (the layout's footer
 * placeholder, swapped per recipient) and a `List-Unsubscribe` header, and
 * addresses that have unsubscribed are skipped, never sent to.
 */

import { Resend } from "resend";
import { UNSUBSCRIBE_URL_PLACEHOLDER, applyUnsubscribeUrl, unsubscribeUrlFor } from "./unsubscribe";
import { getCloudflareContext } from "@/lib/database/context";
import type { RenderedEmail } from "@debate-ai/emails";
import { APP_EMAIL, APP_NAME } from "@debate-ai/webview/lib/config/site";
import { RESEND_BATCH_SIZE, type SendResult, chunk } from "./bulk";

export interface OutgoingMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

/** Sends messages and reports each one's outcome, in the same order. */
export type Transport = (messages: OutgoingMessage[]) => Promise<Array<{ ok: boolean; id?: string; error?: string }>>;

export const SKIPPED_UNSUBSCRIBED = "Unsubscribed from Debate AI emails";

/** The `send_email` binding's name in wrangler.jsonc. */
export const CLOUDFLARE_EMAIL_BINDING = "EMAIL";

/** The part of Cloudflare's Email Service binding this sender uses. */
export interface CloudflareEmailBinding {
  send(message: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    headers?: Record<string, string>;
  }): Promise<{ messageId?: string } | void>;
}

/** The Worker's `EMAIL` binding, or `null` when wrangler.jsonc does not declare it. */
export function getCloudflareEmailBinding(): CloudflareEmailBinding | null {
  const binding = getCloudflareContext()?.env?.[CLOUDFLARE_EMAIL_BINDING];
  return binding && typeof binding.send === "function" ? (binding as CloudflareEmailBinding) : null;
}

export function defaultFrom(): string {
  return `${APP_NAME} <${APP_EMAIL}>`;
}

/** Resend's batch endpoint, with permissive validation so one bad address doesn't fail the rest. */
export function resendTransport(apiKey: string): Transport {
  const resend = new Resend(apiKey);
  return async (messages) => {
    const out: Awaited<ReturnType<Transport>> = [];
    for (const group of chunk(messages, RESEND_BATCH_SIZE)) {
      try {
        const { data, error } = await resend.batch.send(
          group.map(({ from, to, subject, html, text, headers }) => ({ from, to: [to], subject, html, text, headers })),
          { batchValidation: "permissive" },
        );
        if (error || !data) {
          const message = error?.message || "Resend refused the batch.";
          for (const _ of group) out.push({ ok: false, error: message });
          continue;
        }
        const failed = new Map((data.errors ?? []).map(({ index, message }) => [index, message]));
        const ids = data.data ?? [];
        let next = 0;
        group.forEach((_, index) => {
          const message = failed.get(index);
          if (message !== undefined) out.push({ ok: false, error: message });
          else out.push({ ok: true, id: ids[next++]?.id });
        });
      } catch (caught) {
        const message = (caught as Error)?.message ?? String(caught);
        for (const _ of group) out.push({ ok: false, error: message });
      }
    }
    return out;
  };
}

/** One `send` call per message, a few at a time. */
export function cloudflareTransport(binding: CloudflareEmailBinding, concurrency = 5): Transport {
  return async (messages) => {
    const out: Awaited<ReturnType<Transport>> = new Array(messages.length);
    for (let start = 0; start < messages.length; start += concurrency) {
      await Promise.all(
        messages.slice(start, start + concurrency).map(async (message, offset) => {
          try {
            const sent = await binding.send(message);
            out[start + offset] = { ok: true, id: sent?.messageId };
          } catch (caught) {
            out[start + offset] = { ok: false, error: (caught as Error)?.message ?? String(caught) };
          }
        }),
      );
    }
    return out;
  };
}

export interface DeliverBatchOptions {
  recipients: readonly string[];
  rendered: RenderedEmail;
  /** Origin the unsubscribe link points at. */
  origin: string;
  from?: string;
  transport: Transport;
  /** Returns the addresses that may be mailed. Defaults to dropping none. */
  filterSubscribed?: (emails: readonly string[]) => Promise<string[]>;
}

/**
 * Sends `rendered` to each recipient as its own email. Refuses a template
 * whose HTML lacks the unsubscribe placeholder, since every bulk email must
 * link to the opt-out.
 */
export async function deliverBatch(options: DeliverBatchOptions): Promise<SendResult[]> {
  const { recipients, rendered, origin, transport } = options;
  if (!rendered.html.includes(UNSUBSCRIBE_URL_PLACEHOLDER)) {
    throw new Error("This email has no unsubscribe link, so it can't be sent to a list.");
  }
  const from = options.from ?? defaultFrom();
  const allowed = new Set(options.filterSubscribed ? await options.filterSubscribed(recipients) : recipients);

  const toSend = recipients.filter((email) => allowed.has(email));
  const messages = toSend.map((email): OutgoingMessage => {
    const unsubscribe = unsubscribeUrlFor(email, origin);
    return {
      from,
      to: email,
      subject: rendered.subject,
      html: applyUnsubscribeUrl(rendered.html, unsubscribe),
      text: applyUnsubscribeUrl(rendered.text, unsubscribe),
      headers: { "List-Unsubscribe": `<${unsubscribe}>` },
    };
  });
  const outcomes = messages.length > 0 ? await transport(messages) : [];

  const byEmail = new Map<string, SendResult>();
  toSend.forEach((email, index) => {
    const outcome = outcomes[index] ?? { ok: false, error: "The provider returned no result." };
    byEmail.set(
      email,
      outcome.ok ? { email, status: "sent", id: outcome.id } : { email, status: "failed", error: outcome.error || "Send failed." },
    );
  });
  return recipients.map(
    (email) => byEmail.get(email) ?? { email, status: "skipped" as const, error: SKIPPED_UNSUBSCRIBED },
  );
}
