"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, Check, CheckCheck, ChevronsUpDown, Globe, X, LogIn, LogOut, Monitor, Moon, Palette, Settings, Sun } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "../../../lib/ui/primitives/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../../lib/ui/primitives/dropdown-menu"
import { useIsMobile } from "../../../lib/hooks/use-mobile"
import { LoginDialog } from "../LoginDialog"
import { useSession } from "../../../lib/hooks/useSession"
import { useSignOut } from "../../../lib/auth/use-sign-out"
import { accountLabel } from "../../../lib/nav/account-label"
import { settingsHrefForPath } from "../../../lib/qwksearch/settings-paths"
import { cn } from "../../../lib/ui/lib/utils"
import { formatThemeName, themeColors, themeNames, useThemeState } from "../../theme-dropdown"
import { SITE_LINKS } from "../../../lib/nav/dock-menu-sections"
import { useAccountNotifications, type UseAccountNotificationsResult } from "@debate/team-collaboration"
import { AddMembersDialog, CreateOrganizationDialog, OrganizationSubmenu } from "./organization-menu"

/**
 * The shared dropdown primitive neither sizes nor spaces its icons (its other
 * callers pass `mr-2 h-4 w-4` per icon), so bare lucide icons rendered at 24px
 * flush against their labels. Every row in this menu takes this instead.
 */
/** The account row at the sidebar's foot, beside its hide button. */
const ROW =
  "flex h-12 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"

const ITEM = "cursor-pointer gap-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"

const MODES = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const

/**
 * The account menu's Theme submenu: light/dark/system, then the colour themes
 * with their swatches — the same `useThemeState` the dock's Settings menu
 * drives, so a pick here syncs to the account the same way.
 */
function ThemeSubmenu() {
  const theme = useThemeState()

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={ITEM}>
        <Palette />
        Theme
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-[min(28rem,var(--radix-dropdown-menu-content-available-height))] w-56 overflow-y-auto rounded-lg">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Mode</DropdownMenuLabel>
        {MODES.map(({ value, label, Icon }) => (
          <DropdownMenuItem
            key={value}
            className={ITEM}
            onSelect={(e) => { e.preventDefault(); theme.setMode(value) }}
          >
            <Icon />
            {label}
            {theme.mounted && theme.mode === value ? <Check className="ml-auto !text-foreground" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Colour</DropdownMenuLabel>
        {themeNames.map((name) => {
          const colors = themeColors[name]
          const active = theme.colorTheme === name
          return (
            <DropdownMenuItem
              key={name}
              className={cn(ITEM, active && "bg-accent/60")}
              onSelect={(e) => { e.preventDefault(); theme.handleThemeChange(name) }}
              onMouseEnter={() => theme.handleThemePreview(name)}
              onMouseLeave={() => theme.handlePreviewEnd()}
            >
              <span className="flex shrink-0 -space-x-1" aria-hidden>
                <span className="size-3.5 rounded-full border border-border" style={{ backgroundColor: colors?.primary }} />
                <span className="size-3.5 rounded-full border border-border" style={{ backgroundColor: colors?.secondary }} />
              </span>
              <span className="truncate">{formatThemeName(name)}</span>
              {active ? <Check className="ml-auto !text-foreground" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

/**
 * The account menu's Site links submenu — Docs, GitHub, Support, Privacy and
 * the rest of `footer-links.ts`, which used to sit as a row of links above
 * this account row. Same rule as the dock's Site Links: an outside site opens
 * in a new tab, `/docs` takes a full page load (`hardNavigate`), and every
 * other entry is an app route pushed through the router so the app stays up.
 */
function SiteLinkItems() {
  const router = useRouter()

  return (
    <>
      {SITE_LINKS.map((link) => {
        const isExternal = link.url.startsWith("http")
        return isExternal || link.hardNavigate ? (
          <DropdownMenuItem key={link.text} asChild className={ITEM}>
            <a
              href={link.url}
              target={isExternal ? "_blank" : "_self"}
              rel={isExternal ? "noopener noreferrer" : undefined}
            >
              <link.icon />
              {link.text}
            </a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem key={link.text} className={ITEM} onSelect={() => router.push(link.url)}>
            <link.icon />
            {link.text}
          </DropdownMenuItem>
        )
      })}
    </>
  )
}

/** "9+" past nine, so the badge stays one small pill. */
function badgeText(count: number) {
  return count > 9 ? "9+" : String(count)
}

function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      className={cn(
        "inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground",
        className,
      )}
    >
      {badgeText(count)}
    </span>
  )
}

/**
 * The account menu's Notifications submenu: every unread notification (the
 * same `/api/notifications` data the `/notifications` page shows), each
 * opening its link and clearing itself, with an X to clear it without
 * opening it, then Clear all and a link to the full page. "Clear" is the
 * page's mark-as-read; nothing is deleted.
 */
function NotificationsSubmenu({ feed }: { feed: UseAccountNotificationsResult }) {
  const router = useRouter()
  const unread = feed.notifications.filter((n) => !n.readAt)

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={ITEM}>
        <Bell />
        Notifications
        <UnreadBadge count={feed.unreadCount} className="ml-auto" />
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-[min(28rem,var(--radix-dropdown-menu-content-available-height))] w-72 overflow-y-auto rounded-lg">
        {unread.length === 0 ? (
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            You&apos;re all caught up.
          </DropdownMenuLabel>
        ) : (
          unread.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="cursor-pointer items-start gap-2"
              onSelect={() => {
                void feed.markRead(n.id)
                if (n.link) router.push(n.link)
              }}
            >
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="line-clamp-2 text-sm">{n.title}</span>
                {n.body ? <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span> : null}
              </div>
              <button
                type="button"
                aria-label="Clear notification"
                title="Clear"
                className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  void feed.markRead(n.id)
                }}
              >
                <X className="size-3.5" />
              </button>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        {unread.length > 0 ? (
          <DropdownMenuItem
            className={ITEM}
            onSelect={(e) => { e.preventDefault(); void feed.markAllRead() }}
          >
            <CheckCheck />
            Clear all
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild className={ITEM}>
          <Link href="/notifications">
            <Bell />
            All notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function SiteLinksSubmenu() {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={ITEM}>
        <Globe />
        Site links
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-48 rounded-lg">
        <SiteLinkItems />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function UserAvatar({ image, name }: { image?: string | null; name: string }) {
  return (
    <Avatar className="h-8 w-8 rounded-lg">
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback className="rounded-lg text-xs">
        {(name[0] ?? "?").toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

/**
 * The sidebar's account row, on the real session. Signed in, it shows the
 * name and avatar only (never the email address, which is on screen whenever
 * the sidebar is) and opens the account menu: settings, notifications,
 * organizations, theme, site links and sign out (the same handler
 * the dock's Settings menu uses). Signed out, the row itself is the sign-in
 * button and opens the sign-in dialog in place, so the current page survives,
 * with the site links in a small menu beside it.
 */
export function NavUser() {
  const isMobile = useIsMobile()
  const { session, user, isAuthenticated, isLoading } = useSession()
  const signOut = useSignOut()
  const pathname = usePathname()
  const [loginOpen, setLoginOpen] = useState(false)
  const [createOrgOpen, setCreateOrgOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  // The dock's instance is the one that toasts; this one only feeds the badge
  // and the submenu.
  const notifications = useAccountNotifications(isAuthenticated, { toastOnArrival: false })

  if (isLoading) {
    return (
      <button type="button" className={ROW} disabled>
        <div className="size-8 shrink-0 rounded-lg bg-accent" />
        <span className="truncate text-muted-foreground">Checking session…</span>
      </button>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center gap-1">
        <button type="button" className={ROW} onClick={() => setLoginOpen(true)}>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border">
            <LogIn className="size-4" />
          </div>
          <span className="truncate font-medium">Sign in</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Site links"
              title="Site links"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Globe className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48 rounded-lg" side={isMobile ? "bottom" : "right"} align="end">
            <SiteLinkItems />
          </DropdownMenuContent>
        </DropdownMenu>
        <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      </div>
    )
  }

  const name = accountLabel({ name: user.name, email: user.email })
  const activeOrganizationId =
    (session?.session as { activeOrganizationId?: string | null } | undefined)?.activeOrganizationId ?? null

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(ROW, "data-[state=open]:bg-accent")}>
          <span className="relative shrink-0">
            <UserAvatar image={user.image} name={name} />
            <UnreadBadge
              count={notifications.unreadCount}
              className="absolute -right-1.5 -top-1.5 ring-2 ring-background"
            />
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">{name}</span>
          {notifications.unreadCount > 0 ? (
            <span className="sr-only">{`${notifications.unreadCount} unread notifications`}</span>
          ) : null}
          <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
        side={isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <UserAvatar image={user.image} name={name} />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name}</span>
              {user.email ? <span className="truncate text-xs">{user.email}</span> : null}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className={ITEM}>
            <Link href={settingsHrefForPath(pathname)}>
              <Settings />
              Settings
            </Link>
          </DropdownMenuItem>
          <NotificationsSubmenu feed={notifications} />
          <OrganizationSubmenu
            itemClassName={ITEM}
            activeOrganizationId={activeOrganizationId}
            onCreate={() => setCreateOrgOpen(true)}
            onAddMembers={() => setMembersOpen(true)}
          />
          <ThemeSubmenu />
          <SiteLinksSubmenu />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={ITEM} onSelect={() => { void signOut() }}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <CreateOrganizationDialog open={createOrgOpen} onOpenChange={setCreateOrgOpen} />
    <AddMembersDialog open={membersOpen} onOpenChange={setMembersOpen} />
    </>
  )
}
