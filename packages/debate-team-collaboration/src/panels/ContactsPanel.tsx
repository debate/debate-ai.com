/**
 * @fileoverview Contacts list panel — the account-linked friends list over
 * `hooks/useContacts.ts`: search registered users and send a request, accept
 * or decline incoming requests, cancel outgoing ones, remove or block a
 * contact, and unblock. Contacts show an online dot from the presence
 * heartbeat the same poll records, and a "Share a card" action the host
 * page wires to whatever it is currently editing (see `onShareWith`).
 *
 * @module panels/ContactsPanel
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "debate-round/src/ui/primitives/badge";
import { Button } from "debate-round/src/ui/primitives/button";
import { Input } from "debate-round/src/ui/primitives/input";
import { EmptyState, PanelSection, PanelShell, Pill } from "debate-round/src/ui/panels/panel-shell";
import { sortContacts, type ContactUser } from "../lib/contacts";
import { searchUsers, type ContactEntry } from "../state/contacts";
import { useContacts, type UseContactsResult } from "../hooks/useContacts";

export interface ContactsPanelProps {
  /** Pass `isAuthenticated`; the panel renders a sign-in prompt when false. */
  enabled?: boolean;
  /**
   * When provided, every accepted contact gets a "Share a card" button that
   * calls this with the contact — the host page decides what "the card" is
   * (on /reason-editor, the live co-editing session of the open document).
   */
  onShareWith?: (contact: ContactEntry) => void;
  /** Share the hook instance with a sibling panel instead of polling twice. */
  contacts?: UseContactsResult;
}

/** Avatar with an initial fallback; the online dot rides on the corner. */
export function ContactAvatar({ user, online }: { user: ContactUser; online?: boolean }) {
  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();
  return (
    <span className="relative inline-flex h-8 w-8 shrink-0">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.image} alt="" className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <span className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold">
          {initial}
        </span>
      )}
      {online !== undefined && (
        <span
          aria-label={online ? "Online" : "Offline"}
          title={online ? "Online" : "Offline"}
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${
            online ? "bg-emerald-500" : "bg-muted-foreground/40"
          }`}
        />
      )}
    </span>
  );
}

function UserLine({ user, online }: { user: ContactUser; online?: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <ContactAvatar user={user} online={online} />
      <div className="min-w-0">
        <p className="text-sm text-foreground truncate">{user.name || user.email}</p>
        {user.name && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
      </div>
    </div>
  );
}

async function run(work: Promise<unknown>, success?: string): Promise<void> {
  try {
    await work;
    if (success) toast.success(success);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Something went wrong.");
  }
}

/** Search box + results with "Add" buttons; results already in the graph show their state instead. */
function AddContactSearch({ contacts }: { contacts: UseContactsResult }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactUser[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = setTimeout(() => {
      void searchUsers(q).then((rows) => {
        if (!alive) return;
        setResults(rows);
        setSearching(false);
      });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const known = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contacts.contacts) map.set(c.user.id, "Contact");
    for (const r of contacts.outgoing) map.set(r.user.id, "Requested");
    for (const r of contacts.incoming) map.set(r.user.id, "Wants to connect");
    for (const b of contacts.blocked) map.set(b.user.id, "Blocked");
    return map;
  }, [contacts.contacts, contacts.outgoing, contacts.incoming, contacts.blocked]);

  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query.trim());

  const send = async (target: { userId: string } | { email: string }) => {
    try {
      const result = await contacts.request(target);
      toast.success(
        result.status === "accepted"
          ? "You're now contacts."
          : result.status === "requested"
            ? "Contact request sent."
            : result.status === "already-contacts"
              ? "You're already contacts."
              : "Request already pending.",
      );
      setQuery("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send that request.");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a contact by name or email…"
          aria-label="Search registered users"
        />
        {looksLikeEmail && (
          <Button size="sm" onClick={() => void send({ email: query.trim() })}>
            Send request
          </Button>
        )}
      </div>
      {query.trim() && (
        <div className="rounded-md border border-border divide-y divide-border">
          {searching && results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {looksLikeEmail
                ? "No account with that email yet — sending a request will reach them once they sign up with it."
                : "No registered users match."}
            </p>
          ) : (
            results.map((user) => {
              const state = known.get(user.id);
              return (
                <div key={user.id} className="px-3 py-2 flex items-center justify-between gap-2">
                  <UserLine user={user} />
                  {state ? (
                    <Pill>{state}</Pill>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => void send({ userId: user.id })}>
                      Add
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/** Renders the signed-in user's contacts, pending requests, and block list with every action wired. */
export function ContactsPanel({ enabled = true, onShareWith, contacts: shared }: ContactsPanelProps) {
  const own = useContacts(enabled && !shared);
  const contacts = shared ?? own;
  const sorted = useMemo(() => sortContacts(contacts.contacts), [contacts.contacts]);
  const onlineCount = sorted.filter((c) => c.online).length;

  if (!enabled) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState title="Sign in to manage contacts." message="Contacts and shared cards are tied to your account." />
      </div>
    );
  }

  return (
    <PanelShell
      title="Contacts"
      description="People you can share a live card with. Contacts see each other as online while the app is open."
      actions={
        <div className="flex items-center gap-2">
          <Badge variant={onlineCount > 0 ? "default" : "outline"}>{onlineCount} online</Badge>
          <Badge variant="outline">{sorted.length} contacts</Badge>
        </div>
      }
    >
      <AddContactSearch contacts={contacts} />

      {contacts.incoming.length > 0 && (
        <PanelSection
          title="Requests for you"
          actions={<Badge>{contacts.incoming.length}</Badge>}
        >
          {contacts.incoming.map((req) => (
            <div key={req.id} className="rounded-md border border-border px-3 py-2 flex flex-wrap items-center justify-between gap-2">
              <UserLine user={req.user} />
              <div className="flex items-center gap-1">
                <Button size="sm" onClick={() => void run(contacts.accept(req.id), "Contact added.")}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => void run(contacts.decline(req.id))}>
                  Decline
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void run(contacts.block(req.user.id), `${req.user.name || "User"} blocked.`)}
                >
                  Block
                </Button>
              </div>
            </div>
          ))}
        </PanelSection>
      )}

      <PanelSection title="Your contacts">
        {contacts.loading && !contacts.loaded ? (
          <p className="text-sm text-muted-foreground">Loading contacts…</p>
        ) : sorted.length === 0 ? (
          <EmptyState
            title="No contacts yet."
            message="Search for a teammate above and send them a request — once they accept, you can share cards with each other."
          />
        ) : (
          sorted.map((contact) => (
            <div key={contact.id} className="rounded-md border border-border px-3 py-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <UserLine user={contact.user} online={contact.online} />
                <Pill tone={contact.online ? "positive" : "neutral"}>{contact.online ? "Available" : "Away"}</Pill>
              </div>
              <div className="flex items-center gap-1">
                {onShareWith && (
                  <Button size="sm" onClick={() => onShareWith(contact)}>
                    Share a card
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => void run(contacts.remove(contact.id), "Contact removed.")}>
                  Remove
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void run(contacts.block(contact.user.id), `${contact.user.name || "User"} blocked.`)}
                >
                  Block
                </Button>
              </div>
            </div>
          ))
        )}
      </PanelSection>

      {contacts.outgoing.length > 0 && (
        <PanelSection title="Sent requests">
          {contacts.outgoing.map((req) => (
            <div key={req.id} className="rounded-md border border-border px-3 py-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserLine user={req.user} />
                <Pill tone="info">Pending</Pill>
              </div>
              <Button size="sm" variant="outline" onClick={() => void run(contacts.remove(req.id), "Request cancelled.")}>
                Cancel
              </Button>
            </div>
          ))}
        </PanelSection>
      )}

      {contacts.blocked.length > 0 && (
        <PanelSection
          title="Blocked"
          description="Blocked users can't send you requests or share cards with you, and any existing shares between you were revoked."
        >
          {contacts.blocked.map((entry) => (
            <div key={entry.user.id} className="rounded-md border border-border px-3 py-2 flex flex-wrap items-center justify-between gap-2">
              <UserLine user={entry.user} />
              <Button size="sm" variant="outline" onClick={() => void run(contacts.unblock(entry.user.id), "Unblocked.")}>
                Unblock
              </Button>
            </div>
          ))}
        </PanelSection>
      )}
    </PanelShell>
  );
}
