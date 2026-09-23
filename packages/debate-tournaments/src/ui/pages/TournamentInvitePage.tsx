"use client";

import { FileText, Mail } from "lucide-react";
import type { TournamentInvite } from "../client";
import { Empty, Section, formatDate } from "../shared";

/** A tournament's public invitation: dates, events, documents and contacts. */
export function TournamentInvitePage({ invite }: { invite: TournamentInvite }) {
  const place = [invite.city, invite.state, invite.country].filter(Boolean).join(", ");
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <Fact label="Dates" value={`${formatDate(invite.start, invite.tz)} – ${formatDate(invite.end, invite.tz)}`} />
        <Fact label="Location" value={place || "—"} />
        <Fact
          label="Registration"
          value={invite.reg_end ? `Closes ${formatDate(invite.reg_end, invite.tz, true)}` : "—"}
        />
      </dl>

      <Section title={`Events (${invite.Events.length})`}>
        {invite.Events.length === 0 ? (
          <Empty>No events posted yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Event</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 text-right font-medium">Entries</th>
                  <th className="px-4 py-2 text-right font-medium">Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invite.Events.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-2">
                      <span className="font-medium">{event.name}</span>{" "}
                      <span className="text-xs text-muted-foreground">{event.abbr}</span>
                    </td>
                    <td className="px-4 py-2 capitalize">{event.type}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{event.metadata?.entryCount ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {event.fee != null ? `${event.settings?.currency ?? "$"}${event.fee}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Documents">
          {invite.Files.length === 0 ? (
            <Empty>No documents posted.</Empty>
          ) : (
            <ul className="divide-y text-sm">
              {invite.Files.map((file) => (
                <li key={file.id} className="flex items-center gap-2 px-4 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{file.label || file.filename}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Contacts">
          {invite.Contacts.length === 0 ? (
            <Empty>No contacts listed.</Empty>
          ) : (
            <ul className="divide-y text-sm">
              {invite.Contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2">
                  <span>{[c.first, c.last].filter(Boolean).join(" ")}</span>
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Mail className="h-3.5 w-3.5" aria-hidden />
                      Email
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {invite.Webpages.map((page) => (
        <Section key={page.id} title={page.title || "Information"}>
          {/* Tournament-authored HTML is shown as text, never injected as markup. */}
          <p className="whitespace-pre-line p-4 text-sm">{htmlToText(page.content)}</p>
        </Section>
      ))}
    </div>
  );
}

function htmlToText(html: string | null): string {
  return (html ?? "")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
