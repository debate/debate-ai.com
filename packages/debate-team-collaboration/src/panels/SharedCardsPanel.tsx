/**
 * @fileoverview Shared cards panel over `hooks/useCardShares.ts`: every live
 * card a contact has shared with the signed-in user ("available to you"),
 * every card they've shared out (with revoke), and a paste box for sharing
 * a code or invite link copied from the editor's own Start Session flow.
 * Opening a received card is the host page's job (`onOpen`) — on
 * /reason-editor it joins the session in place; anywhere else it navigates
 * there first.
 *
 * @module panels/SharedCardsPanel
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "debate-round/src/ui/primitives/badge";
import { Button } from "debate-round/src/ui/primitives/button";
import { Input } from "debate-round/src/ui/primitives/input";
import { EmptyState, PanelSection, PanelShell, Pill } from "debate-round/src/ui/panels/panel-shell";
import { parseInviteInput } from "../lib/contacts";
import type { CardShareEntry } from "../state/cardShares";
import type { ContactEntry } from "../state/contacts";
import { useCardShares, type UseCardSharesResult } from "../hooks/useCardShares";
import { ContactAvatar } from "./ContactsPanel";

export interface SharedCardsPanelProps {
  enabled?: boolean;
  /** Called with the share to open (after it's been marked opened server-side). */
  onOpen?: (share: CardShareEntry) => void;
  /** Accepted contacts, for the paste-to-share form's recipient picker. Omit to hide the form. */
  contacts?: ContactEntry[];
  /** Share the hook instance with a sibling instead of polling twice. */
  shares?: UseCardSharesResult;
}

function formatWhen(iso: string): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const mins = Math.round((Date.now() - at) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(at).toLocaleDateString();
}

/** Paste a `cmshare…` code or invite link, pick contacts, share. */
function ShareByCodeForm({
  contacts,
  shares,
}: {
  contacts: ContactEntry[];
  shares: UseCardSharesResult;
}) {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const parsed = parseInviteInput(code);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    if (!parsed || picked.size === 0) return;
    setBusy(true);
    try {
      const result = await shares.share({
        shareCode: parsed.shareCode,
        guestPass: parsed.guestPass,
        title,
        recipientIds: [...picked],
      });
      toast.success(
        result.shared.length === 1
          ? "Card shared with 1 contact."
          : `Card shared with ${result.shared.length} contacts.`,
      );
      if (result.skipped.length > 0) toast.warning(`${result.skipped.length} recipient(s) couldn't be shared with.`);
      setCode("");
      setTitle("");
      setPicked(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not share that card.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelSection
      title="Share a card by code"
      description="Paste the share code or invite link the editor copied when you started a session, then pick who gets it."
      className="rounded-md border border-border p-3"
    >
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="cmshare… or https://…/#join=…"
        aria-label="Share code or invite link"
        aria-invalid={code.trim() !== "" && !parsed}
      />
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" aria-label="Card title" />
      {contacts.length === 0 ? (
        <p className="text-xs text-muted-foreground">Add a contact first — cards can only be shared with contacts.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {contacts.map((c) => {
            const on = picked.has(c.user.id);
            return (
              <Pill key={c.user.id} selected={on} onClick={() => toggle(c.user.id)}>
                <span className={`h-1.5 w-1.5 rounded-full ${c.online ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                {c.user.name || c.user.email}
              </Pill>
            );
          })}
        </div>
      )}
      <Button size="sm" disabled={!parsed || picked.size === 0 || busy} onClick={() => void submit()}>
        {busy ? "Sharing…" : `Share with ${picked.size || ""} ${picked.size === 1 ? "contact" : "contacts"}`.replace("  ", " ")}
      </Button>
    </PanelSection>
  );
}

/** Lists cards shared with and by the signed-in user, with open/remove/revoke actions. */
export function SharedCardsPanel({ enabled = true, onOpen, contacts, shares: shared }: SharedCardsPanelProps) {
  const own = useCardShares(enabled && !shared, { onOpen, toastOnArrival: false });
  const shares = shared ?? own;

  if (!enabled) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState title="Sign in to see shared cards." message="Cards contacts share with you appear here on any device you sign in on." />
      </div>
    );
  }

  const open = async (share: CardShareEntry) => {
    await shares.markOpened(share);
    onOpen?.(share);
  };

  const remove = async (id: number, what: string) => {
    try {
      await shares.remove(id);
      toast.success(what);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove that share.");
    }
  };

  return (
    <PanelShell
      title="Shared cards"
      description="Live co-editing cards your contacts made available to you, and the ones you've shared out."
      actions={<Badge variant={shares.unopenedCount > 0 ? "default" : "outline"}>{shares.unopenedCount} new</Badge>}
    >
      <PanelSection title="Available to you">
        {shares.loading && !shares.loaded ? (
          <p className="text-sm text-muted-foreground">Loading shared cards…</p>
        ) : shares.received.length === 0 ? (
          <EmptyState title="Nothing shared with you yet." message="When a contact shares a card, it shows up here as available to open." />
        ) : (
          shares.received.map((share) => (
            <div key={share.id} className="rounded-md border border-border px-3 py-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <ContactAvatar user={share.user} />
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">
                    {share.title}
                    {!share.openedAt && <Pill tone="info" className="ml-2">New</Pill>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    from {share.user.name || share.user.email} · {formatWhen(share.updatedAt)}
                    {share.message ? ` · “${share.message}”` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Pill tone="positive">Available</Pill>
                {onOpen && (
                  <Button size="sm" onClick={() => void open(share)}>
                    Open
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => void remove(share.id, "Removed from your list.")}>
                  Dismiss
                </Button>
              </div>
            </div>
          ))
        )}
      </PanelSection>

      {shares.sent.length > 0 && (
        <PanelSection title="Shared by you">
          {shares.sent.map((share) => (
            <div key={share.id} className="rounded-md border border-border px-3 py-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <ContactAvatar user={share.user} />
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{share.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    to {share.user.name || share.user.email} · {formatWhen(share.updatedAt)} ·{" "}
                    {share.openedAt ? "opened" : "not opened yet"}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => void remove(share.id, "Share revoked.")}>
                Stop sharing
              </Button>
            </div>
          ))}
        </PanelSection>
      )}

      {contacts && <ShareByCodeForm contacts={contacts} shares={shares} />}
    </PanelShell>
  );
}
