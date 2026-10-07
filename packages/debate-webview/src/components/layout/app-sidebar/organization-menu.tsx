"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Building2, Check, Loader2, Plus, User, UserPlus } from "lucide-react"

import { ORGANIZATION_CHANGED_EVENT } from "@debate/team-collaboration"
import { authClient } from "../../../lib/auth/client"
import { Button } from "../../../lib/ui/primitives/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../lib/ui/primitives/dialog"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "../../../lib/ui/primitives/dropdown-menu"
import { Input } from "../../../lib/ui/primitives/input"
import { Label } from "../../../lib/ui/primitives/label"
import { cn } from "../../../lib/ui/lib/utils"
import { slugifyOrganizationName } from "../../../lib/nav/organization-slug"

/**
 * The account menu's Organizations submenu: the personal workspace, every
 * organization the account belongs to (better-auth's organization plugin),
 * and "New organization". Picking one sets it active on the session, which is
 * what `/api/contacts` and `/api/card-shares` read to narrow the contacts list
 * and shared cards to that group's members. Owners and admins of the active
 * organization also get "Add members", which adds from their own contacts.
 *
 * The two dialogs are opened by the parent (`NavUser`) so they outlive the
 * dropdown, which unmounts this submenu as it closes.
 */
export function OrganizationSubmenu({
  itemClassName,
  activeOrganizationId,
  onCreate,
  onAddMembers,
}: {
  itemClassName: string
  activeOrganizationId: string | null
  onCreate: () => void
  onAddMembers: () => void
}) {
  const router = useRouter()
  const { data: organizations, isPending } = authClient.useListOrganizations()
  const [switching, setSwitching] = useState<string | null>(null)
  const active = organizations?.find((org) => org.id === activeOrganizationId) ?? null

  async function switchTo(organizationId: string | null) {
    if (organizationId === activeOrganizationId) return
    setSwitching(organizationId ?? "personal")
    try {
      await authClient.organization.setActive({ organizationId })
      // Contacts and shared cards refetch for the new scope; server-rendered
      // pages read the session too.
      window.dispatchEvent(new Event(ORGANIZATION_CHANGED_EVENT))
      router.refresh()
    } finally {
      setSwitching(null)
    }
  }

  const mark = (selected: boolean, key: string) =>
    switching === key ? (
      <Loader2 className="ml-auto animate-spin" />
    ) : selected ? (
      <Check className="ml-auto !text-foreground" />
    ) : null

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={itemClassName}>
        <Building2 />
        <span className="truncate">{active ? active.name : "Organizations"}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-[min(28rem,var(--radix-dropdown-menu-content-available-height))] w-60 overflow-y-auto rounded-lg">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Contacts and shared cards follow the one you pick
        </DropdownMenuLabel>
        <DropdownMenuItem
          className={itemClassName}
          onSelect={(e) => { e.preventDefault(); void switchTo(null) }}
        >
          <User />
          Personal
          {mark(!activeOrganizationId, "personal")}
        </DropdownMenuItem>
        {isPending && !organizations ? (
          <DropdownMenuItem className={itemClassName} disabled>
            <Loader2 className="animate-spin" />
            Loading…
          </DropdownMenuItem>
        ) : null}
        {organizations?.map((org) => (
          <DropdownMenuItem
            key={org.id}
            className={cn(itemClassName, org.id === activeOrganizationId && "bg-accent/60")}
            onSelect={(e) => { e.preventDefault(); void switchTo(org.id) }}
          >
            <Building2 />
            <span className="truncate">{org.name}</span>
            {mark(org.id === activeOrganizationId, org.id)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {active ? (
          <DropdownMenuItem className={itemClassName} onSelect={onAddMembers}>
            <UserPlus />
            Members of {active.name}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem className={itemClassName} onSelect={onCreate}>
          <Plus />
          New organization
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

/** Names a new organization, creates it and makes it the active one. */
export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName("")
      setError(null)
    }
  }, [open])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    try {
      // The slug only has to be unique; a short random tail keeps two teams
      // with the same name from colliding.
      const { error: createError } = await authClient.organization.create({
        name: trimmed,
        slug: slugifyOrganizationName(trimmed),
      })
      if (createError) {
        setError(createError.message ?? "Could not create that organization.")
        return
      }
      // better-auth makes a new organization active for its creator.
      window.dispatchEvent(new Event(ORGANIZATION_CHANGED_EVENT))
      router.refresh()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New organization</DialogTitle>
            <DialogDescription>
              A shared group, like your team or school. While it is active, your contacts and shared cards are its
              members&apos;.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="organization-name">Name</Label>
            <Input
              id="organization-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lincoln High Debate"
              maxLength={80}
              autoFocus
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface MemberUser {
  id: string
  name: string
  email: string
  image: string | null
}

interface MembersPage {
  organization: { id: string; name: string; role: string }
  members: MemberUser[]
  candidates: MemberUser[]
}

/** Lists the active organization's members and adds the caller's contacts to it. */
export function AddMembersDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [page, setPage] = useState<MembersPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)

  async function load() {
    setError(null)
    const res = await fetch("/api/organizations/members", { credentials: "include" })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      setError(json?.error ?? "Could not load members.")
      return
    }
    setPage(json as MembersPage)
  }

  useEffect(() => {
    if (open) {
      setPage(null)
      void load()
    }
  }, [open])

  async function add(userId: string) {
    setAdding(userId)
    try {
      const res = await fetch("/api/organizations/members", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) setError(json?.error ?? "Could not add that member.")
      await load()
    } finally {
      setAdding(null)
    }
  }

  const canAdd = page ? /\b(owner|admin)\b/.test(page.organization.role) : false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{page ? `Members of ${page.organization.name}` : "Members"}</DialogTitle>
          <DialogDescription>
            {canAdd || !page
              ? "Add people from your contacts. They become each other's contacts while this organization is active."
              : "Only an owner or admin can add members."}
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!page && !error ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        {page ? (
          <div className="grid max-h-80 gap-4 overflow-y-auto">
            <section className="grid gap-1">
              <h3 className="text-xs font-medium text-muted-foreground">Members</h3>
              {page.members.map((m) => (
                <div key={m.id} className="truncate text-sm">
                  {m.name || "Unnamed"}
                </div>
              ))}
            </section>
            {canAdd ? (
              <section className="grid gap-1">
                <h3 className="text-xs font-medium text-muted-foreground">Your contacts</h3>
                {page.candidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Every contact is already a member. Add contacts from the Contacts page first.
                  </p>
                ) : (
                  page.candidates.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm">{c.name || "Unnamed"}</span>
                      <Button size="sm" variant="outline" disabled={adding !== null} onClick={() => void add(c.id)}>
                        {adding === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                      </Button>
                    </div>
                  ))
                )}
              </section>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
