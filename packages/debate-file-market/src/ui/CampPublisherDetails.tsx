"use client"

/**
 * @fileoverview One official camp publisher's details — where the camp is,
 * what it teaches, its dates, cost and deadline, who to contact, its own site
 * and its OpenCaselist openev page — with a Follow button.
 *
 * Rendered inside the info modal the docs sidebar opens from a file's
 * "Published by" line, and as the page `/research/publishers/camp-<code>`.
 *
 * @module debate-file-market/ui/CampPublisherDetails
 */

import { useEffect, useState } from "react"
import { BellPlus, BellRing, CalendarDays, Clock, DollarSign, ExternalLink, Loader2, Mail, MapPin, Phone, Presentation, User } from "lucide-react"
import { toast } from "sonner"
import type { CampPublisher } from "../camp-publishers"
import { fetchPublisherFollow, setPublisherFollow, type PublisherFollowState } from "../client"
import { Button } from "./primitives/button"
import { cn } from "./cn"

/** Follow / Following for one camp publisher (follower count is not shown). */
export function CampFollowButton({ camp, className }: { camp: CampPublisher; className?: string }) {
  const [state, setState] = useState<PublisherFollowState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setState(null)
    fetchPublisherFollow(camp.slug)
      .then((next) => {
        if (!cancelled) setState(next)
      })
      .catch(() => {
        if (!cancelled) setState({ followers: 0, following: false, signedIn: true })
      })
    return () => {
      cancelled = true
    }
  }, [camp.slug])

  const toggle = async () => {
    if (!state) return
    if (!state.signedIn) {
      toast.error("Sign in to follow publishers.")
      return
    }
    setBusy(true)
    try {
      const next = await setPublisherFollow({ slug: camp.slug, name: camp.name }, !state.following)
      setState(next)
      toast.success(next.following ? `Following ${camp.name}.` : `Unfollowed ${camp.name}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the follow.")
    } finally {
      setBusy(false)
    }
  }

  const following = state?.following ?? false
  return (
    <Button
      type="button"
      size="sm"
      variant={following ? "secondary" : "default"}
      className={className}
      disabled={!state || busy}
      onClick={() => void toggle()}
      aria-pressed={following}
    >
      {busy || !state ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : following ? (
        <BellRing className="h-4 w-4" />
      ) : (
        <BellPlus className="h-4 w-4" />
      )}
      {following ? "Following" : "Follow"}
    </Button>
  )
}

function Row({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export interface CampPublisherDetailsProps {
  camp: CampPublisher
  /** Hides the heading when a dialog title already names the camp. */
  hideHeading?: boolean
  className?: string
}

/** Everything known about one official camp publisher, with Follow. */
export function CampPublisherDetails({ camp, hideHeading, className }: CampPublisherDetailsProps) {
  const { contact } = camp
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 text-sm", className)} data-testid="camp-publisher-details">
      {!hideHeading && (
        <div className="flex items-start gap-3">
          <img
            src={`https://www.google.com/s2/favicons?domain=${hostOf(camp.website)}&sz=64`}
            alt=""
            width={32}
            height={32}
            className="mt-0.5 h-8 w-8 shrink-0 rounded"
          />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight">{camp.name}</h2>
            <p className="text-muted-foreground">
              {camp.code} · {camp.host}
            </p>
          </div>
        </div>
      )}

      <p className="text-muted-foreground">{camp.about}</p>

      <dl className="flex flex-col gap-2">
        <Row icon={MapPin} label="Location">
          {camp.location}
        </Row>
        <Row icon={Presentation} label="Events">
          {camp.events}
        </Row>
        <Row icon={CalendarDays} label="Dates">
          {camp.dates}
        </Row>
        <Row icon={DollarSign} label="Cost">
          {camp.cost}
        </Row>
        <Row icon={Clock} label="Deadline">
          {camp.deadline}
        </Row>
        {contact.name && (
          <Row icon={User} label="Contact">
            {contact.name}
          </Row>
        )}
        {contact.email && (
          <Row icon={Mail} label="Email">
            <a href={`mailto:${contact.email}`} className="text-primary underline-offset-2 hover:underline">
              {contact.email}
            </a>
          </Row>
        )}
        {contact.phone && (
          <Row icon={Phone} label="Phone">
            <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="text-primary underline-offset-2 hover:underline">
              {contact.phone}
            </a>
          </Row>
        )}
      </dl>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <CampFollowButton camp={camp} />
        <Button asChild size="sm" variant="outline">
          <a href={camp.website} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" /> Camp website
          </a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={camp.openevUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" /> Openev files
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Details from the camp's own site; check there before applying, as dates and prices change each summer.
      </p>
    </div>
  )
}
