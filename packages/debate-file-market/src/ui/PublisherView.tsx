"use client"

/**
 * @fileoverview A research publisher's page: who they are (research group,
 * students, seasons, owner), the files they have published with each file's
 * details, and the Subscribe button.
 *
 * Subscribing pays one month from the reader's wallet to the owner's (`POST
 * /api/market/publishers/<slug>/subscribe`), or nothing for a free
 * publisher. While it lasts, each published file has "Save a copy", which
 * puts it in the reader's own files and opens it in the editor. A wallet
 * that doesn't cover the price gets the top-up buttons right there.
 *
 * The owner sees "Edit page" instead, which edits the name, description,
 * research group, students, seasons, website and monthly price in place.
 *
 * @module debate-file-market/ui/PublisherView
 */

import { useCallback, useEffect, useState } from "react"
import { BadgeCheck, Building2, CalendarDays, ExternalLink, FileText, Loader2, Lock, Pencil, Users } from "lucide-react"
import { toast } from "sonner"
import {
  dollarsToCents,
  formatCents,
  formatSubscriptionPrice,
  parseStudentList,
  validateSubscriptionPrice,
  type MarketBoardResponse,
  type PublisherPageResponse,
  type ResearchPublisher,
} from "../index"
import { copyPublishedFile, fetchMarketBoard, fetchPublisherPage, subscribeToPublisher, updatePublisher } from "../client"
import { Button } from "./primitives/button"
import { WalletCard } from "./WalletCard"
import { useTopUpReturn } from "./FileMarketPanel"

export interface PublisherViewProps {
  /** The publisher's slug, from the route. */
  slug: string
  /** The editor URL that opens one of the reader's own files. */
  editorHref: (documentId: number) => string
}

function formatDate(value: string): string {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

const FIELD =
  "w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function PublisherEditor({
  publisher,
  onSaved,
  onCancel,
}: {
  publisher: ResearchPublisher
  onSaved: (publisher: ResearchPublisher) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(publisher.name)
  const [description, setDescription] = useState(publisher.description)
  const [researchGroup, setResearchGroup] = useState(publisher.researchGroup)
  const [students, setStudents] = useState(publisher.students.join("\n"))
  const [years, setYears] = useState(publisher.years)
  const [website, setWebsite] = useState(publisher.website)
  const [price, setPrice] = useState((publisher.priceCents / 100).toFixed(2))
  const [busy, setBusy] = useState(false)
  const priceCheck = validateSubscriptionPrice(dollarsToCents(price))

  const save = async () => {
    if (!priceCheck.ok) return
    setBusy(true)
    try {
      const saved = await updatePublisher(publisher.slug, {
        name,
        description,
        researchGroup,
        students: parseStudentList(students),
        years,
        website,
        priceCents: priceCheck.value,
      })
      toast.success("Saved your publisher page.")
      onSaved(saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that publisher.")
    } finally {
      setBusy(false)
    }
  }

  const row = (label: string, input: React.ReactNode, hint?: string) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {input}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  )

  return (
    <div className="flex flex-col gap-3" data-testid="publisher-editor">
      {row("Name", <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} />)}
      {row("Research group", <input className={FIELD} value={researchGroup} onChange={(e) => setResearchGroup(e.target.value)} />)}
      {row(
        "Students",
        <textarea className={`${FIELD} min-h-20`} value={students} onChange={(e) => setStudents(e.target.value)} />,
        "One name per line, or separated by commas.",
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {row("Years", <input className={FIELD} value={years} onChange={(e) => setYears(e.target.value)} placeholder="2024–2026" />)}
        {row(
          "Monthly price (USD)",
          <input
            className={FIELD}
            inputMode="decimal"
            value={price}
            aria-invalid={!priceCheck.ok}
            onChange={(e) => setPrice(e.target.value)}
          />,
          priceCheck.ok ? "0 makes subscribing free." : priceCheck.error,
        )}
      </div>
      {row("Website", <input className={FIELD} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />)}
      {row(
        "About",
        <textarea className={`${FIELD} min-h-24`} value={description} onChange={(e) => setDescription(e.target.value)} />,
      )}
      <div className="flex gap-2">
        <Button type="button" disabled={busy || !name.trim() || !priceCheck.ok} onClick={() => void save()}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

export function PublisherView({ slug, editorHref }: PublisherViewProps) {
  const [page, setPage] = useState<PublisherPageResponse | null>(null)
  const [board, setBoard] = useState<MarketBoardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copying, setCopying] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)

  const load = useCallback(() => {
    fetchPublisherPage(slug)
      .then(setPage)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load that publisher."))
    fetchMarketBoard()
      .then(setBoard)
      .catch(() => {})
  }, [slug])

  useEffect(load, [load])
  useTopUpReturn(load)

  const subscribe = async () => {
    setBusy(true)
    try {
      const next = await subscribeToPublisher(slug)
      setPage(next)
      if (next.wallet) setBoard((prev) => (prev ? { ...prev, wallet: next.wallet } : prev))
      toast.success(`Subscribed to ${next.publisher.name}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not subscribe.")
      load()
    } finally {
      setBusy(false)
    }
  }

  const saveCopy = async (documentId: number) => {
    setCopying(documentId)
    try {
      const { documentId: copy } = await copyPublishedFile(slug, documentId)
      // A full load, so the editor's file list includes the copy just made.
      window.location.assign(editorHref(copy))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save a copy of that file.")
      setCopying(null)
    }
  }

  if (!page) {
    return error ? (
      <p className="text-sm text-destructive">{error}</p>
    ) : (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const { publisher, files, subscription, isOwner } = page
  const wallet = page.wallet
  const subscribed = subscription?.active === true
  const unlocked = isOwner || subscribed
  const short = wallet !== null && publisher.priceCents > 0 && wallet.balanceCents < publisher.priceCents

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
          {editing ? (
            <PublisherEditor
              publisher={publisher}
              onCancel={() => setEditing(false)}
              onSaved={(saved) => {
                setPage((prev) => (prev ? { ...prev, publisher: saved } : prev))
                setEditing(false)
              }}
            />
          ) : (
            <>
              <header className="flex flex-wrap items-start gap-3">
                <Building2 className="mt-1 h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold leading-tight">{publisher.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[publisher.researchGroup, publisher.years, `run by ${publisher.owner.name}`].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {publisher.subscribers} {publisher.subscribers === 1 ? "subscriber" : "subscribers"} ·{" "}
                    {files.length} {files.length === 1 ? "file" : "files"}
                  </p>
                </div>
                <span className="text-lg font-semibold tabular-nums">{formatSubscriptionPrice(publisher.priceCents)}</span>
              </header>

              {publisher.description && <p className="whitespace-pre-line text-sm">{publisher.description}</p>}

              {publisher.students.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Users className="h-4 w-4" /> Students
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {publisher.students.map((student) => (
                      <li key={student} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {student}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {isOwner ? (
                  <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                    <Pencil className="h-4 w-4" /> Edit page
                  </Button>
                ) : subscribed ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-primary">
                    <BadgeCheck className="h-4 w-4" /> Subscribed until {formatDate(subscription!.expiresAt)}
                  </span>
                ) : (
                  <Button type="button" disabled={busy || wallet === null || short} onClick={() => void subscribe()}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                    {subscription ? "Renew" : "Subscribe"}
                    {publisher.priceCents > 0 ? ` for ${formatCents(publisher.priceCents)} / month` : " for free"}
                  </Button>
                )}
                {!isOwner && wallet === null && (
                  <span className="text-xs text-muted-foreground">Sign in with an account to subscribe.</span>
                )}
                {!isOwner && !subscribed && short && (
                  <span className="text-xs text-muted-foreground">
                    Your wallet has {formatCents(wallet!.balanceCents)}. Add money to subscribe.
                  </span>
                )}
                {publisher.website && (
                  <a
                    href={publisher.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Website <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </>
          )}
        </section>

        <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <FileText className="h-4 w-4" /> Published research
          </h3>
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isOwner
                ? "Nothing yet. Open one of your files, choose Edit details in the sidebar, and publish it under this publisher."
                : "No files published yet."}
            </p>
          ) : (
            <ul className="divide-y">
              {files.map((file) => (
                <li key={file.documentId} className="flex flex-wrap items-start gap-3 py-3" data-testid="published-file">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-tight">{file.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[
                        file.author ? `By ${file.author}` : "",
                        file.researchGroup,
                        file.quoteCount ? `${file.quoteCount} cards` : "",
                        file.pageCount ? `${file.pageCount} pp.` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {file.students.length > 0 && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" /> {file.students.join(", ")}
                      </p>
                    )}
                    {(file.years || file.publishedOn) && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        {[file.years, file.publishedOn ? formatDate(file.publishedOn) : ""].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {file.summary && <p className="mt-1 text-sm">{file.summary}</p>}
                  </div>
                  {unlocked ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={copying !== null}
                      onClick={() => void saveCopy(file.documentId)}
                    >
                      {copying === file.documentId ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      Save a copy
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" /> Subscribers
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <div>
        {board && !isOwner && publisher.priceCents > 0 && (
          <WalletCard wallet={board.wallet} topUps={board.topUps} topUpsEnabled={board.topUpsEnabled} />
        )}
      </div>
    </div>
  )
}
