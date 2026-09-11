"use client"

/**
 * Account-linked live sharing for /reason-editor — the contacts-list front
 * door to the CardMirror engine's real-time collaboration (see
 * packages/debate-help-docs/content/docs/features/contacts.mdx). Two components, both talking to the engine
 * through `debate-editor/collab-bridge`:
 *
 * `ShareWithContacts` (header button + dialog): pick contacts and an
 * optional note; the control starts a co-editing session on the open
 * document if it has none yet (the engine's own confirm), then posts the
 * session's share code + guest pass to `/api/card-shares` so the card shows
 * up as available on each contact's account — no clipboard, no pasting a
 * `cmshare…` code. `?shareWith=<userId>` (from /contacts' "Share a card")
 * opens the dialog with that contact preselected.
 *
 * `SharedCardOpener` (mounted once on the page, renders nothing): handles
 * `?share=<id>` from /contacts' "Open" — creates a fresh document to hold
 * the joined copy (so whatever was open is never overwritten by the room's
 * content), joins the room, and marks the share opened. Also seeds the
 * engine's presence display name from the signed-in account, so partners
 * see a real name at the cursor instead of "Guest 412".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Share2, Users } from "lucide-react"
import { toast } from "sonner"
import {
  ContactAvatar,
  fetchCardShares,
  markCardShareOpened,
  sortContacts,
  useCardShares,
  useContacts,
  type CardShareEntry,
} from "debate-team-collaboration"
import { Button } from "../../lib/ui/primitives/button"
import { Input } from "../../lib/ui/primitives/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../lib/ui/primitives/dialog"
import { useSession } from "@/lib/hooks/useSession"
import { useReasonDocs } from "@/components/reason-docs/ReasonDocsProvider"
import { urlWithoutParam } from "@/lib/reason-docs/route-selection"

type Bridge = typeof import("debate-editor/collab-bridge")

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** The engine registers its collab seams at boot; wait (briefly) for that before a programmatic join/start. */
async function bridgeWhenReady(timeoutMs: number): Promise<Bridge | null> {
  const bridge = await import("debate-editor/collab-bridge")
  const deadline = Date.now() + timeoutMs
  while (!bridge.collabSeamsReady()) {
    if (Date.now() > deadline) return null
    await sleep(250)
  }
  return bridge
}

const NOT_READY = "The editor isn't ready yet — try again in a moment."
const NEEDS_DESKTOP = "Live co-editing needs the desktop layout — open this on a computer."

type Docs = Pick<ReturnType<typeof useReasonDocs>, "createDocument" | "updateTitle">

/**
 * Join a shared card in the editor: new document → wait for the engine →
 * join. Resolves true when the session went live. Shared by the toast's
 * "Open" action and the `?share=` landing path.
 */
async function joinSharedCard(
  share: CardShareEntry,
  docs: Docs,
  activeIdRef: { current: number | null },
): Promise<boolean> {
  const dismiss = toast.loading(`Opening "${share.title}" from ${share.user.name || share.user.email}…`)
  try {
    // A fresh document holds the joined copy: the engine binds the session
    // to whichever doc is focused and the page autosaves it, so joining
    // into the doc that was open would overwrite it with the room's content.
    const before = activeIdRef.current
    await docs.createDocument()
    const deadline = Date.now() + 10_000
    while (activeIdRef.current === before && Date.now() < deadline) await sleep(100)
    if (activeIdRef.current != null && activeIdRef.current !== before) {
      docs.updateTitle(activeIdRef.current, share.title)
    }
    const bridge = await bridgeWhenReady(20_000)
    if (!bridge) {
      toast.error(NOT_READY)
      return false
    }
    if (!bridge.collabAvailable()) {
      toast.error(NEEDS_DESKTOP)
      return false
    }
    const ok = await bridge.joinCollabShare(share.shareCode, share.guestPass)
    if (ok) {
      toast.success(`Joined "${share.title}"`)
      void markCardShareOpened(share.id)
    }
    return ok
  } finally {
    toast.dismiss(dismiss)
  }
}

/**
 * Drops a one-shot query parameter from the address bar, keeping the rest of
 * the URL — including the path, which names the open document.
 *
 * `history.replaceState` rather than the router: `/reason-editor` and
 * `/reason-editor/<slug>` are separate Next routes, so a `router.replace`
 * here would remount CardMirror over the reader mid-join.
 */
function dropQueryParam(param: string): void {
  if (typeof window === "undefined") return
  const next = urlWithoutParam(param, {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  })
  if (next) window.history.replaceState(null, "", next)
}

/** Mount once per page. Handles `?share=<id>` and seeds the presence name. Renders nothing. */
export function SharedCardOpener() {
  const searchParams = useSearchParams()
  const { user, isAuthenticated } = useSession()
  const { createDocument, updateTitle, activeId } = useReasonDocs()
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const handledRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user?.name) return
    void import("debate-editor/collab-bridge").then((b) => b.seedCollabDisplayName(user.name))
  }, [user?.name])

  const shareParam = searchParams.get("share")
  useEffect(() => {
    if (!shareParam || !isAuthenticated || handledRef.current === shareParam) return
    handledRef.current = shareParam
    // Strip the query first: a reload mid-join must not re-run the join.
    // In place, not `router.replace("/reason-editor")` — the path names the
    // document the reader is on (see `lib/reason-docs/route-selection`), and
    // routing back to the bare route would both lose that name and remount
    // the editor under them.
    dropQueryParam("share")
    void (async () => {
      const page = await fetchCardShares()
      const entry = page?.received.find((s) => String(s.id) === shareParam)
      if (!entry) {
        toast.error("That shared card is no longer available.")
        return
      }
      await joinSharedCard(entry, { createDocument, updateTitle }, activeIdRef)
    })()
  }, [shareParam, isAuthenticated, createDocument, updateTitle])

  return null
}

export interface ShareWithContactsProps {
  /** Title of the open document — becomes the shared card's title. */
  title: string
}

/** The header's "Share with contacts" button and its dialog. */
export function ShareWithContacts({ title }: ShareWithContactsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated } = useSession()
  const { createDocument, updateTitle, activeId } = useReasonDocs()
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const contacts = useContacts(isAuthenticated)
  const shares = useCardShares(isAuthenticated, {
    onOpen: (share) => void joinSharedCard(share, { createDocument, updateTitle }, activeIdRef),
  })

  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  // `?shareWith=<userId>` → open the dialog with that contact preselected.
  const shareWithParam = searchParams.get("shareWith")
  const handledShareWithRef = useRef<string | null>(null)
  useEffect(() => {
    if (!shareWithParam || handledShareWithRef.current === shareWithParam) return
    handledShareWithRef.current = shareWithParam
    setPicked(new Set([shareWithParam]))
    setOpen(true)
    dropQueryParam("shareWith")
  }, [shareWithParam])

  const sorted = useMemo(() => sortContacts(contacts.contacts), [contacts.contacts])

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = useCallback(async () => {
    if (picked.size === 0) return
    setBusy(true)
    try {
      const bridge = await bridgeWhenReady(5_000)
      if (!bridge) {
        toast.error(NOT_READY)
        return
      }
      if (!bridge.collabAvailable()) {
        toast.error(NEEDS_DESKTOP)
        return
      }
      // The doc's existing session, or start one (the engine confirms).
      const share = bridge.activeCollabShare() ?? (await bridge.startCollabSession())
      if (!share) {
        toast.error("No co-editing session was started, so nothing was shared.")
        return
      }
      const result = await shares.share({
        shareCode: share.shareCode,
        guestPass: share.guestPass,
        title,
        message,
        recipientIds: [...picked],
      })
      if (result.shared.length > 0) {
        toast.success(
          result.shared.length === 1
            ? "Shared — it's now available on their account."
            : `Shared with ${result.shared.length} contacts.`,
        )
      }
      if (result.skipped.length > 0) {
        toast.warning(`${result.skipped.length} recipient(s) couldn't be shared with (not a contact, or blocked).`)
      }
      setOpen(false)
      setPicked(new Set())
      setMessage("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not share this card.")
    } finally {
      setBusy(false)
    }
  }, [picked, shares, title, message])

  if (!isAuthenticated) return null

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5"
        onClick={() => setOpen(true)}
        title="Share this document as a live card with your contacts"
      >
        <Share2 className="h-4 w-4" />
        <span className="hidden sm:inline">Share with contacts</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share with contacts</DialogTitle>
            <DialogDescription>
              Starts a live co-editing session on “{title || "Untitled"}” and makes it available on each contact's
              account. They can open it from their Contacts page on any device.
            </DialogDescription>
          </DialogHeader>

          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You don't have any contacts yet.{" "}
              <button type="button" className="underline" onClick={() => router.push("/contacts")}>
                Add some
              </button>{" "}
              first — cards can only be shared with contacts.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-md border border-border divide-y divide-border">
              {sorted.map((c) => {
                const on = picked.has(c.user.id)
                return (
                  <label key={c.user.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={on}
                      onChange={() => toggle(c.user.id)}
                      aria-label={`Share with ${c.user.name || c.user.email}`}
                    />
                    <ContactAvatar user={c.user} online={c.online} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm truncate">{c.user.name || c.user.email}</span>
                      <span className="block text-xs text-muted-foreground">{c.online ? "Online now" : "Away"}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          )}

          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a note (optional)"
            aria-label="Note to send with the share"
            maxLength={500}
          />

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => router.push("/contacts")}>
              <Users className="h-4 w-4" /> Manage contacts
            </Button>
            <Button type="button" disabled={picked.size === 0 || busy} onClick={() => void submit()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              Share{picked.size > 0 ? ` with ${picked.size}` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
