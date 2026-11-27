"use client"

/**
 * The "Manage contacts" modal that opens over the share dialog: add people,
 * answer requests and remove contacts on one tab, and keep named groups
 * ("teams") of contacts on the other, so a share can be addressed to a whole
 * group in one click. Both lists come from the share dialog's own hook
 * instances, so edits here show up behind the modal immediately.
 */

import { useMemo, useState } from "react"
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import {
  AddContactSearch,
  ContactAvatar,
  MAX_CONTACT_GROUP_NAME_LENGTH,
  sortContacts,
  type ContactEntry,
  type ContactGroup,
  type UseContactGroupsResult,
  type UseContactsResult,
} from "@debate-ai/team-collaboration"
import { Button } from "../ui/primitives/button"
import { Input } from "../ui/primitives/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/primitives/dialog"

type Tab = "contacts" | "groups"

export interface ManageContactsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contacts: UseContactsResult
  groups: UseContactGroupsResult
  /** Which tab shows first; defaults to the contacts list. */
  initialTab?: Tab
}

async function attempt(work: Promise<unknown>, success?: string): Promise<boolean> {
  try {
    await work
    if (success) toast.success(success)
    return true
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Something went wrong.")
    return false
  }
}

const nameOf = (c: ContactEntry) => c.user.name || c.user.email

function ContactsTab({ contacts }: { contacts: UseContactsResult }) {
  const sorted = useMemo(() => sortContacts(contacts.contacts), [contacts.contacts])
  return (
    <div className="space-y-4">
      <AddContactSearch contacts={contacts} />

      {contacts.incoming.length > 0 && (
        <section className="space-y-2" aria-label="Requests for you">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Requests for you</h3>
          {contacts.incoming.map((req) => (
            <div key={req.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
              <span className="min-w-0 truncate text-sm">{req.user.name || req.user.email}</span>
              <span className="flex shrink-0 gap-1">
                <Button size="sm" onClick={() => void attempt(contacts.accept(req.id), "Contact added.")}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => void attempt(contacts.decline(req.id))}>
                  Decline
                </Button>
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2" aria-label="Your contacts">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {contacts.organization ? `Members of ${contacts.organization.name}` : "Your contacts"}
        </h3>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {contacts.loaded ? "No contacts yet — search above to send a request." : "Loading contacts…"}
          </p>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {sorted.map((c) => (
              <div key={c.user.id} className="flex items-center gap-2 px-3 py-2">
                <ContactAvatar user={c.user} online={c.online} />
                <span className="min-w-0 flex-1 truncate text-sm">{nameOf(c)}</span>
                {!contacts.organization && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${nameOf(c)}`}
                    onClick={() => void attempt(contacts.remove(c.id), "Contact removed.")}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        {contacts.outgoing.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {contacts.outgoing.length} request{contacts.outgoing.length === 1 ? "" : "s"} waiting to be accepted.
          </p>
        )}
      </section>
    </div>
  )
}

interface GroupEditorProps {
  contacts: ContactEntry[]
  initialName: string
  initialMembers: readonly string[]
  submitLabel: string
  onSubmit: (name: string, memberIds: string[]) => Promise<boolean>
  onCancel: () => void
}

function GroupEditor({ contacts, initialName, initialMembers, submitLabel, onSubmit, onCancel }: GroupEditorProps) {
  const [name, setName] = useState(initialName)
  const [members, setMembers] = useState(() => new Set(initialMembers))
  const [busy, setBusy] = useState(false)

  const toggle = (id: string) =>
    setMembers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const save = async () => {
    setBusy(true)
    const ok = await onSubmit(name, [...members].filter((id) => contacts.some((c) => c.user.id === id)))
    setBusy(false)
    if (ok) onCancel()
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Group name, e.g. Varsity squad"
        aria-label="Group name"
        maxLength={MAX_CONTACT_GROUP_NAME_LENGTH}
        autoFocus
      />
      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add contacts on the Contacts tab first, then put them in groups.</p>
      ) : (
        <div className="max-h-48 divide-y divide-border overflow-y-auto rounded-md border border-border">
          {contacts.map((c) => (
            <label key={c.user.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-accent/50">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={members.has(c.user.id)}
                onChange={() => toggle(c.user.id)}
                aria-label={`Include ${nameOf(c)}`}
              />
              <ContactAvatar user={c.user} online={c.online} />
              <span className="min-w-0 flex-1 truncate text-sm">{nameOf(c)}</span>
            </label>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={busy || !name.trim()} onClick={() => void save()}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}

function GroupsTab({ contacts, groups }: { contacts: UseContactsResult; groups: UseContactGroupsResult }) {
  const sorted = useMemo(() => sortContacts(contacts.contacts), [contacts.contacts])
  const known = useMemo(() => new Set(sorted.map((c) => c.user.id)), [sorted])
  const [editing, setEditing] = useState<number | "new" | null>(null)

  const countOf = (g: ContactGroup) => g.memberIds.filter((id) => known.has(id)).length

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Put contacts into named groups — a debate team, a lab, a partner list — then pick a whole group when you share.
      </p>

      {editing === "new" ? (
        <GroupEditor
          contacts={sorted}
          initialName=""
          initialMembers={[]}
          submitLabel="Create group"
          onSubmit={(name, memberIds) => attempt(groups.create({ name, memberIds }), "Group created.")}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> New group
        </Button>
      )}

      {groups.groups.length === 0 && editing !== "new" ? (
        <p className="text-sm text-muted-foreground">
          {groups.loaded ? "No groups yet." : "Loading groups…"}
        </p>
      ) : (
        groups.groups.map((g) =>
          editing === g.id ? (
            <GroupEditor
              key={g.id}
              contacts={sorted}
              initialName={g.name}
              initialMembers={g.memberIds}
              submitLabel="Save"
              onSubmit={(name, memberIds) => attempt(groups.update({ id: g.id, name, memberIds }), "Group saved.")}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div key={g.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{g.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {countOf(g)} {countOf(g) === 1 ? "contact" : "contacts"}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Edit ${g.name}`}
                onClick={() => setEditing(g.id)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Delete ${g.name}`}
                onClick={() => void attempt(groups.remove(g.id), "Group deleted.")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ),
        )
      )}
    </div>
  )
}

/** Modal overlay for managing contacts and contact groups. */
export function ManageContactsDialog({
  open,
  onOpenChange,
  contacts,
  groups,
  initialTab = "contacts",
}: ManageContactsDialogProps) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const tabs: { id: Tab; label: string }[] = [
    { id: "contacts", label: "Contacts" },
    { id: "groups", label: "Groups" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage contacts</DialogTitle>
          <DialogDescription>Add people and organize them into groups for sharing live cards.</DialogDescription>
        </DialogHeader>

        <div role="tablist" aria-label="Manage contacts" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {t.id === "groups" && groups.groups.length > 0 ? ` (${groups.groups.length})` : ""}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto pr-1">
          {tab === "contacts" ? <ContactsTab contacts={contacts} /> : <GroupsTab contacts={contacts} groups={groups} />}
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
