"use client"

/**
 * @fileoverview The first-sign-in welcome notification.
 *
 * A reader who just signed in for the first time on this
 * browser gets one dialog outlining the app's key links —
 * the docs, the practice rounds and the video library — with
 * the NDT 2015 Finals practice debate as the suggested first
 * round to open: a real final round whose speech docs sit
 * beside the video, so every tool (flow, timer, speech docs)
 * is visible in one place.
 *
 * The provider (`FirstLoginWelcomeProvider`) decides when to
 * show it; this is only the content. The link rows are their
 * own component so a test can pin them without a portal.
 *
 * @module components/layout/FirstLoginWelcomeDialog
 */

import Link from "next/link"
import {
  BookOpen,
  Bot,
  PlayCircle,
  Swords,
  Trophy,
  type LucideIcon,
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "../../lib/ui/primitives/dialog"
import { Button } from "../../lib/ui/primitives/button"
import { APP_NAME } from "../../lib/config/site"

export interface WelcomeLink {
  /** In-app path the row follows. */
  href: string
  /** Row title. */
  label: string
  /** One line under the title. */
  description: string
  icon: LucideIcon
  /**
   * Forces a full page load for an in-app-looking URL. `/docs`
   * carries its own stylesheet and navigation, so it is handed
   * to the browser rather than the client router (same rule as
   * `SiteFooter`'s docs row).
   */
  hardNavigate?: boolean
  /** The suggested first stop, rendered highlighted. */
  featured?: boolean
}

/**
 * The key links the notification outlines, in display order.
 *
 * The NDT 2015 Finals row points at the featured round's
 * stable slug (`/debate/<slug>` builds the round for a reader
 * who has never opened it — see `round/featured-rounds.ts`).
 */
export const WELCOME_LINKS: readonly WelcomeLink[] = [
  {
    href: "/docs",
    label: "Explore the docs",
    description: "Guides for every tool, from cutting cards to flowing rounds",
    icon: BookOpen,
    hardNavigate: true,
  },
  {
    href: "/debate",
    label: "Practice debates",
    description: "Flow a round with the smart timer, or open a real one",
    icon: Swords,
  },
  {
    href: "/videos",
    label: "Watch videos",
    description: "NDT, Public Forum and LD rounds plus coaching lectures",
    icon: PlayCircle,
  },
  {
    href: "/debate/2015-ndt/northwestern-mv-michigan-ap",
    label: "NDT 2015 Finals practice debate",
    description:
      "Northwestern MV vs Michigan AP — the final round with its speech docs",
    icon: Trophy,
    featured: true,
  },
  {
    href: "/practice/versus-ai",
    label: "Debate vs AI",
    description: "Argue a full round against an AI opponent, any format",
    icon: Bot,
  },
]

/**
 * The link rows, outside the dialog chrome.
 *
 * @param links - The rows to render. Defaults to {@link WELCOME_LINKS}.
 */
export function WelcomeLinkList({ links = WELCOME_LINKS }: { links?: readonly WelcomeLink[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {links.map(({ href, label, description, icon: Icon, hardNavigate, featured }) => {
        const contents = (
          <>
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-md ${
                featured ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{label}</span>
              <span className="block truncate text-xs text-muted-foreground">{description}</span>
            </span>
          </>
        )
        const className = `flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent/50 ${
          featured ? "border-primary/30 bg-primary/5" : "border-border"
        }`
        // `/docs` needs the real page load; every other row is an
        // in-app route the client router follows in place.
        return hardNavigate ? (
          <li key={href}>
            <a href={href} target="_self" className={className}>
              {contents}
            </a>
          </li>
        ) : (
          <li key={href}>
            <Link href={href} prefetch={false} className={className}>
              {contents}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export interface FirstLoginWelcomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The signed-in reader's display name, for a personal welcome. */
  name?: string | null
}

/**
 * The first-sign-in notification: the key links, with the NDT
 * 2015 Finals practice debate suggested as the first round to
 * open.
 */
export function FirstLoginWelcomeDialog({
  open,
  onOpenChange,
  name,
}: FirstLoginWelcomeDialogProps) {
  const firstName = name?.trim().split(/\s+/)[0]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Welcome to {APP_NAME}
            {firstName ? `, ${firstName}` : ""}
          </DialogTitle>
          <DialogDescription>
            Start here — the key links to get the most out of the app:
          </DialogDescription>
        </DialogHeader>
        <WelcomeLinkList />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" className="w-full sm:w-auto">
              Start exploring
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default FirstLoginWelcomeDialog
