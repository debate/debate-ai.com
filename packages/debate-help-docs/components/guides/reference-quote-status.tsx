"use client"
/**
 * @file reference-quote-status.tsx
 * @description The small icon on each References entry that says whether the
 * entry's quoted card text is on the page, and the dialog for filling a gap:
 *
 * - underlined — full text with NSDA-style underlining (green underline icon)
 * - full — full text, no underlining (file icon)
 * - ellipses — only `…` gaps so far (amber ellipsis, clickable)
 * - missing — no text at all (small red X, clickable)
 *
 * Clicking the red X, or the ellipsis, opens a modal where anyone — signed in
 * or not — can paste the full text. It posts
 * to `POST /api/reference-quote-suggestions`, which stores it in D1 for the
 * admin panel's Reference text tab (limits and checks: `lib/reference-suggestions.ts`).
 *
 * Used in three places:
 * - `ReferenceQuoteStatus`, injected into each entry's summary line on a
 *   References page by `lib/mdx/rehype-citation-cards.ts` (status computed
 *   at build time from the entry's card);
 * - the citation hover card (`citation-card.tsx`), which renders the icon and
 *   owns the dialog itself, since the hover card unmounts when the pointer
 *   leaves it to reach the modal;
 * - `ReferenceQuoteLegend`, the key at the top of a References page.
 */
import { useId, useState, type FormEvent, type MouseEvent } from "react"
import { CircleX, Ellipsis, FileText, Underline } from "lucide-react"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog"
import { Textarea } from "../ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { cn } from "../../lib/utils"
import {
  canSuggestText,
  isReferenceQuoteStatus,
  REFERENCE_QUOTE_STATUS_INFO,
  REFERENCE_QUOTE_STATUSES,
  type ReferenceQuoteStatus as Status,
} from "../../lib/reference-quote-status"
import {
  MAX_SUGGESTION_TEXT_LENGTH,
  MIN_SUGGESTION_TEXT_LENGTH,
  splitReferenceHref,
} from "../../lib/reference-suggestions"

/** Where suggestions are posted. */
export const REFERENCE_SUGGESTIONS_ENDPOINT = "/api/reference-quote-suggestions"

const STATUS_STYLE: Record<Status, { Icon: typeof FileText; className: string }> = {
  underlined: { Icon: Underline, className: "text-emerald-600 dark:text-emerald-400" },
  full: { Icon: FileText, className: "text-sky-600 dark:text-sky-400" },
  ellipses: { Icon: Ellipsis, className: "text-amber-600 dark:text-amber-400" },
  missing: { Icon: CircleX, className: "text-red-600 dark:text-red-500" },
}

interface IconProps {
  status: Status
  /** What the entry is, for the accessible name: its bibliography line as plain text. */
  title?: string
  /** Called when a clickable status (missing, ellipses) is pressed. */
  onSuggest?: () => void
  className?: string
}

/** The status icon with its tooltip; a button for the statuses a reader can fill in. */
export function ReferenceQuoteIcon({ status, title, onSuggest, className }: IconProps) {
  const { Icon, className: tone } = STATUS_STYLE[status]
  const info = REFERENCE_QUOTE_STATUS_INFO[status]
  const clickable = canSuggestText(status) && !!onSuggest
  const label = clickable ? `${info.label}: suggest the full text${title ? ` for ${title}` : ""}` : info.label
  const common = {
    "data-reference-quote-status": status,
    className: cn(
      "reference-quote-status ml-2 inline-flex size-5 shrink-0 translate-y-[2px] items-center justify-center rounded-full align-baseline",
      tone,
      className,
    ),
  }
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        {clickable ? (
          <button
            type="button"
            aria-label={label}
            {...common}
            className={cn(common.className, "cursor-pointer hover:bg-fd-muted focus-visible:ring-2 focus-visible:ring-fd-ring")}
            onClick={(event: MouseEvent) => {
              // Inside a <summary>: pressing the icon must not fold the entry.
              event.preventDefault()
              event.stopPropagation()
              onSuggest?.()
            }}
          >
            <Icon className="size-4" strokeWidth={status === "missing" ? 2.5 : 2} aria-hidden />
          </button>
        ) : (
          <span role="img" aria-label={label} tabIndex={0} {...common}>
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" className="z-[75] max-w-64 text-center">
        <div className="font-medium">{info.label}</div>
        <div className="opacity-80">{info.description}</div>
      </TooltipContent>
    </Tooltip>
  )
}

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The entry's page path and `ref-…` anchor id. */
  page: string
  refId: string
  /** The entry's bibliography line as plain text. */
  title: string
}

type SubmitState = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string }

/** The modal that collects a suggested card text for one entry. */
export function SuggestTextDialog({ open, onOpenChange, page, refId, title }: DialogProps) {
  const [text, setText] = useState("")
  const [website, setWebsite] = useState("")
  const [state, setState] = useState<SubmitState>({ kind: "idle" })
  const fieldId = useId()

  const tooShort = text.trim().length < MIN_SUGGESTION_TEXT_LENGTH
  const sending = state.kind === "sending"

  const close = (next: boolean) => {
    onOpenChange(next)
    if (!next && state.kind === "sent") {
      setText("")
      setState({ kind: "idle" })
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (sending || tooShort) return
    setState({ kind: "sending" })
    try {
      const res = await fetch(REFERENCE_SUGGESTIONS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, refId, title, text, website }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Could not send your suggestion. Try again in a moment.")
      setState({ kind: "sent" })
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Could not send your suggestion." })
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-xl" data-reference-suggestion-dialog>
        {state.kind === "sent" ? (
          <>
            <DialogHeader>
              <DialogTitle>Thank you</DialogTitle>
              <DialogDescription>
                Your suggested text was sent. An admin will review it before it appears on the page.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={() => close(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="grid gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>Suggest the full text</DialogTitle>
              <DialogDescription>
                {title ? <span className="line-clamp-3">{title}</span> : "This source has no card text yet."} Paste the
                quoted passage; no account needed.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-1.5">
              <label htmlFor={`${fieldId}-text`} className="text-sm font-medium">
                Card text
              </label>
              <Textarea
                id={`${fieldId}-text`}
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={MAX_SUGGESTION_TEXT_LENGTH}
                rows={9}
                required
                disabled={sending}
                placeholder="Paste the quoted passage from the source"
                aria-describedby={`${fieldId}-count`}
              />
              <div id={`${fieldId}-count`} className="text-xs text-fd-muted-foreground">
                {text.length.toLocaleString("en-US")} / {MAX_SUGGESTION_TEXT_LENGTH.toLocaleString("en-US")} characters
                {tooShort && text.length > 0 ? ` (at least ${MIN_SUGGESTION_TEXT_LENGTH})` : ""}
              </div>
            </div>

            {/* Honeypot: invisible to people, filled in by form-stuffing bots. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Website
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </label>
            </div>

            {state.kind === "error" && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {state.message}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={sending}>
                Cancel
              </Button>
              <Button type="submit" disabled={sending || tooShort}>
                {sending ? "Sending…" : "Send suggestion"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface StatusProps {
  /** The entry's link, `/docs/…/references#ref-…`. */
  href: string
  status: string
  /** The entry's bibliography line as plain text. */
  title?: string
}

/** The icon, and its dialog, for one entry of a References page. */
export function ReferenceQuoteStatus({ href, status, title = "" }: StatusProps) {
  const [open, setOpen] = useState(false)
  const target = splitReferenceHref(href)
  if (!isReferenceQuoteStatus(status)) return null
  return (
    <>
      <ReferenceQuoteIcon status={status} title={title} onSuggest={target ? () => setOpen(true) : undefined} />
      {target && <SuggestTextDialog open={open} onOpenChange={setOpen} page={target.page} refId={target.refId} title={title} />}
    </>
  )
}

/** The key to the four icons, shown at the top of a References page. */
export function ReferenceQuoteLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "not-prose my-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-fd-border bg-fd-card px-3 py-2 text-xs text-fd-muted-foreground",
        className,
      )}
      role="list"
      aria-label="What the icons beside each reference mean"
    >
      <span className="font-medium text-fd-foreground">Card text:</span>
      {REFERENCE_QUOTE_STATUSES.map((status) => {
        const { Icon, className: tone } = STATUS_STYLE[status]
        return (
          <span key={status} role="listitem" className="inline-flex items-center gap-1.5">
            <Icon className={cn("size-4", tone)} aria-hidden />
            {REFERENCE_QUOTE_STATUS_INFO[status].label}
          </span>
        )
      })}
      <span className="text-fd-muted-foreground">Click a red X or ellipsis to suggest the text.</span>
    </div>
  )
}
