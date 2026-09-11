"use client"

import { useCallback, useEffect, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { Globe, LogIn, LogOut, Monitor, Moon, Palette, Pause, Play, Search, Settings as SettingsIcon, Sun, Swords, UserCircle2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "../../lib/ui/lib/utils"
import { Dock, DockIcon, DockItem, DockLabel } from "../../lib/ui/layout/dock"
import { useAccountNotifications, useContacts } from "debate-team-collaboration"
import {
  useVideoPlayerStore,
  sendYouTubeCommand,
  useCategoryDockState,
  type CategoryType,
} from "debate-videos"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../lib/ui/primitives/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "../../lib/ui/primitives/avatar"
import { themeNames, themeColors, formatThemeName, useThemeState } from "@/components/theme-dropdown"
import { LoginDialog } from "@/components/layout/LoginDialog"
import { authClient } from "@/lib/auth/client"
import { useSession } from "@/lib/hooks/useSession"
import { hasEmbeddedDock } from "@/lib/sidebar-routes"
import { SIDEBAR_MENU_SECTIONS, SITE_LINKS, DEBATE_LINKS } from "@/lib/nav/dock-menu-sections"
import { NAV_ITEMS } from "@/lib/nav/dock-nav-items"
import { useAppFrame } from "@/components/layout/AppFrameProvider"
import { useIsFramedDocument } from "@/lib/layout/use-framed-document"
import { openGlobalCommandPalette } from "@/components/layout/GlobalCommandPalette"
import { IconSettings } from "../../lib/ui/icons"

// No Timer button here on purpose: the round timers live in the rounds
// sidebar, on the selected round (`LiveRoundGroup`, in debate-round's
// `FlowPageSidebar`), where the speech they are timing is in view. A dock
// shortcut to a standalone timer page duplicated that surface without the
// round context, so it was removed.

const VIDEO_CATEGORY_ITEMS: { category: CategoryType; label: string; icon: any }[] = []

/** One rendered dock button, in either the desktop or the mobile instance. */
interface DockNavRenderItem {
  key: string
  label: string
  icon: any
  active: boolean
  /** Set for real destinations, so the button is an anchor you can middle-click. */
  href?: string
  onClick: (event: ReactMouseEvent<HTMLElement>) => void
  /** Warms the destination on hover/focus, before the click lands. */
  onPreload?: () => void
  renderIcon?: () => ReactNode
  isPlayingIndicator?: boolean
}

/**
 * Account block at the foot of the settings menu: who is signed in and how to
 * change that. Signed out it opens the sign-in dialog rather than navigating to
 * `/login`, so the current page survives.
 */
function AccountSection({ onSignIn }: { onSignIn: () => void }) {
  const { user, isAuthenticated, isLoading } = useSession()
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      const { error } = await authClient.signOut()
      if (error) throw new Error(error.message || error.statusText)
      router.refresh()
    } catch (error) {
      console.error("[auth] sign-out failed:", error)
      toast.error("Could not sign out")
    }
  }

  if (isLoading) {
    return (
      <DropdownMenuItem disabled>
        <UserCircle2 className="mr-2 h-4 w-4" />
        <span className="text-muted-foreground">Checking session…</span>
      </DropdownMenuItem>
    )
  }

  if (!isAuthenticated) {
    // No `preventDefault` here — the menu has to close, or it sits on top of
    // the dialog it just opened. Opening on the next tick keeps Radix's
    // focus-restore on close from stealing focus back from the dialog.
    return (
      <DropdownMenuItem onSelect={() => setTimeout(onSignIn, 0)}>
        <LogIn className="mr-2 h-4 w-4" />
        Sign In
      </DropdownMenuItem>
    )
  }

  const displayName = user?.name || user?.email || "Signed in"

  return (
    <>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Avatar className="h-7 w-7">
          {user?.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback className="text-xs">
            {(displayName[0] ?? "?").toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{displayName}</p>
          {user?.email && user.email !== displayName && (
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          )}
        </div>
      </div>
      <DropdownMenuItem onSelect={() => { handleSignOut() }}>
        <LogOut className="mr-2 h-4 w-4" />
        Sign Out
      </DropdownMenuItem>
    </>
  )
}

function SettingsMenu({
  side,
  onSignIn,
}: {
  side: "bottom" | "top"
  onSignIn: () => void
}) {
  const themeState = useThemeState()
  const router = useRouter()

  return (
    <DropdownMenuContent
      side={side}
      align="end"
      // Tall enough (the nav submenus above the account block) to run past a
      // phone viewport, which would otherwise cut the account rows off with
      // no way to reach them.
      className="w-48 max-h-[min(560px,80vh)] overflow-y-auto"
      collisionPadding={8}
      avoidCollisions
    >
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openGlobalCommandPalette() }}>
        <Search className="mr-2 h-4 w-4" />
        Command Palette
        <span className="ml-auto text-xs text-muted-foreground">⌘/Ctrl⇧Space</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {/* The desktop sidebar's own sections, one submenu each. The sidebar is
          md+ only, so on a phone this is the only place its Videos links and
          the glossary/rankings pair below its tree can be reached — see
          `lib/nav/dock-menu-sections.ts`, which derives these from the same
          data the sidebar renders. "Apps" carries the whole feature catalog
          as nested per-category submenus, which is why the menu itself no
          longer has All Features / All Tools / Tools rows of its own. */}
      {SIDEBAR_MENU_SECTIONS.map((section) => (
        <DropdownMenuSub key={section.id}>
          <DropdownMenuSubTrigger>
            <section.icon className="mr-2 h-4 w-4 shrink-0" />
            {section.title}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56 max-h-[min(500px,70vh)] overflow-y-auto" collisionPadding={8} avoidCollisions>
            {section.links.map((link) => (
              <DropdownMenuItem key={link.href} onSelect={(e) => { e.preventDefault(); router.push(link.href) }}>
                {link.title}
              </DropdownMenuItem>
            ))}
            {section.groups && section.groups.length > 0 && <DropdownMenuSeparator />}
            {section.groups?.map((group) => (
              <DropdownMenuSub key={group.id}>
                <DropdownMenuSubTrigger>{group.title}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-64 max-h-[min(500px,70vh)] overflow-y-auto" collisionPadding={8} avoidCollisions>
                  {group.links.map((link) => (
                    <DropdownMenuItem key={link.href} onSelect={(e) => { e.preventDefault(); router.push(link.href) }}>
                      {link.title}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/settings") }}>
        <SettingsIcon className="mr-2 h-4 w-4" />
        Settings
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); themeState.toggleLightDark() }}>
        {themeState.isDark ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
        {themeState.isDark ? "Dark Mode" : "Light Mode"}
      </DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Palette className="mr-2 h-4 w-4" />
          Theme
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-56 max-h-[min(400px,70vh)] overflow-y-auto" collisionPadding={8} avoidCollisions>
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); themeState.setMode("light") }} className={cn("cursor-pointer", themeState.mode === "light" && "bg-accent")}>
            <Sun className="mr-2 h-4 w-4" />
            Light
            {themeState.mode === "light" && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); themeState.setMode("dark") }} className={cn("cursor-pointer", themeState.mode === "dark" && "bg-accent")}>
            <Moon className="mr-2 h-4 w-4" />
            Dark
            {themeState.mode === "dark" && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); themeState.setMode("system") }} className={cn("cursor-pointer", themeState.mode === "system" && "bg-accent")}>
            <Monitor className="mr-2 h-4 w-4" />
            System
            {themeState.mode === "system" && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Color Theme</DropdownMenuLabel>
          <div className="text-xs text-muted-foreground px-2 py-1.5">Current: {formatThemeName(themeState.colorTheme)}</div>
          <DropdownMenuSeparator />
          {themeNames.map((name) => {
            const colors = themeColors[name]
            return (
              <DropdownMenuItem
                key={name}
                onClick={() => themeState.handleThemeChange(name)}
                onMouseEnter={() => themeState.handleThemePreview(name)}
                onMouseLeave={() => themeState.handlePreviewEnd()}
                className={cn("cursor-pointer", themeState.colorTheme === name && "bg-accent")}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: colors.primary }} />
                      <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: colors.secondary }} />
                    </div>
                    <span>{formatThemeName(name)}</span>
                  </div>
                  {themeState.colorTheme === name && <span className="text-xs">✓</span>}
                </div>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Globe className="mr-2 h-4 w-4" />
          Site Links
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-56" collisionPadding={8} avoidCollisions>
          {SITE_LINKS.map((link) => (
            <DropdownMenuItem key={link.text} asChild>
              <a
                href={link.url}
                target={link.url.startsWith("http") ? "_blank" : "_self"}
                rel={link.url.startsWith("http") ? "noopener noreferrer" : undefined}
                className="cursor-pointer"
              >
                <link.icon className="mr-2 h-4 w-4" />
                {link.text}
              </a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Swords className="mr-2 h-4 w-4" />
          Debate Links
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-56" collisionPadding={8} avoidCollisions>
          {DEBATE_LINKS.map((link) => (
            <DropdownMenuItem key={link.text} asChild>
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                <link.icon className="mr-2 h-4 w-4" />
                {link.text}
              </a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <AccountSection onSignIn={onSignIn} />
    </DropdownMenuContent>
  )
}

/**
 * Resting icon size and magnification for the sidebar-hosted dock, chosen so
 * the whole row fits the narrowest sidebar it is rendered in.
 *
 * The sidebar is `md:w-[300px]` with `p-3`, i.e. 276px of usable width. Five
 * nav destinations plus Settings at {@link EMBEDDED_ICON_SIZE}px, with
 * `gap-1.5` (6px) and `p-2` (8px each side), come to 6*34 + 5*6 + 16 = 250px,
 * and one magnified icon adds {@link EMBEDDED_MAGNIFICATION} - 34 = 12px more.
 * That leaves headroom at every breakpoint, and `fluid` wrapping catches any
 * future item so the dock still cannot grow past the column.
 */
const EMBEDDED_ICON_SIZE = 34
const EMBEDDED_MAGNIFICATION = 46

/**
 * Renders a single dock instance with all items inline as direct children.
 * This ensures Dock's cloneElement passes mousex/magnification/distance properly.
 *
 * `embedded` is the sidebar-hosted form. It is the reason the dock is bound to
 * its column rather than sized to its own contents: a content-sized dock is
 * wider than the 300px sidebar it sits in, which either forces the sidebar to
 * scroll sideways or reaches over its border onto the page beside it — the
 * CardMirror editor, on `/reason-editor` and `/doc`.
 */
function DockInstance({
  dockClassName,
  side,
  allItems,
  onSignIn,
  embedded = false,
}: {
  dockClassName: string
  side: "bottom" | "top"
  allItems: DockNavRenderItem[]
  onSignIn: () => void
  embedded?: boolean
}) {
  return (
    <DropdownMenu>
      <Dock
        direction="middle"
        className={dockClassName}
        fluid={embedded}
        iconSize={embedded ? EMBEDDED_ICON_SIZE : undefined}
        magnification={embedded ? EMBEDDED_MAGNIFICATION : undefined}
      >
        {allItems.map(({ key, label, icon, active, href, onClick, onPreload, renderIcon }) => (
          <DockItem
            key={key}
            href={href}
            onClick={onClick}
            onMouseEnter={onPreload}
            onFocus={onPreload}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-full transition-colors cursor-pointer",
              active
                ? "bg-primary/20 ring-2 ring-primary"
                : "bg-gray-200 dark:bg-neutral-800",
            )}
          >
            <DockLabel>{label}</DockLabel>
            <DockIcon>
              {renderIcon ? renderIcon() : (
                <Image src={icon} alt={label} width={24} height={24} className="w-full h-full" unoptimized />
              )}
            </DockIcon>
          </DockItem>
        ))}
        <DropdownMenuTrigger asChild>
          <DockItem aria-label="Settings" className="relative flex flex-col items-center gap-0.5 rounded-full transition-colors cursor-pointer bg-gray-200 dark:bg-neutral-800">
            <DockLabel>Settings</DockLabel>
            <DockIcon>
              <Image src={IconSettings} alt="settings" width={24} height={24} className="w-full h-full" unoptimized />
            </DockIcon>
          </DockItem>
        </DropdownMenuTrigger>
      </Dock>
      <SettingsMenu side={side} onSignIn={onSignIn} />
    </DropdownMenu>
  )
}

/**
 * Unified navigation dock.
 * Desktop (md+): fixed top-left corner, compact width.
 * Mobile: fixed bottom, full-width centered, does not overlap content.
 *
 * Pass `embedded` to render just the dock itself, unpositioned, for use at
 * the top of a page-owned sidebar (e.g. the videos page). In that case the
 * page is responsible for suppressing the fixed top-left dock so it isn't
 * shown twice — see the `/videos` check below.
 */
export function CategoryDock({ embedded = false }: { embedded?: boolean } = {}) {
  const pathname = usePathname()
  const router = useRouter()
  const frame = useAppFrame()
  // A page rendered inside the app frame never draws a dock of its own: the
  // shell's dock sits above the frame, in the top document, and stays put
  // while this page loads and reloads underneath it. That includes the
  // sidebar-hosted instance /videos mounts from its own `<aside>`.
  const framedDocument = useIsFramedDocument()
  const categoryState = useCategoryDockState()
  const { activeVideoId, activeVideoTitle, isMinimized, isPlaying, setMinimized, setIsPlaying } = useVideoPlayerStore()
  // Owned here rather than inside the menu: the dropdown unmounts its content
  // when it closes, which would tear the dialog down with it.
  const [loginOpen, setLoginOpen] = useState(false)
  const { isAuthenticated } = useSession()
  // Called for their app-wide side effects, not for anything this component
  // renders: `useAccountNotifications` is what toasts a notification that
  // arrives while the user is anywhere in the app, and `useContacts`' poll
  // doubles as the presence heartbeat that shows this user as online to their
  // contacts (not only on /contacts). Neither count is shown in the dock any
  // more — the Settings menu is navigation now, and its Notifications and
  // Contacts rows, plus the unread dot that advertised them, are gone.
  useAccountNotifications(isAuthenticated)
  useContacts(isAuthenticated)

  /**
   * Hands the destination to the app frame when there is one, so the click
   * swaps a frame instead of tearing down and rebuilding the whole app —
   * which is what used to leave the dock unresponsive while the next page
   * hydrated. `AppFrameProvider` pushes the URL either way, so the address
   * bar, deep links and the back button behave as before. Falls back to a
   * plain route change wherever the frame isn't mounted (a framed document,
   * or a path the dock doesn't own).
   */
  const navigate = useCallback(
    (href: string) => {
      if (frame?.openInFrame(href)) return
      router.push(href)
    },
    [frame, router],
  )

  const handleNavClick = useCallback(
    (href: string) => (event: ReactMouseEvent<HTMLElement>) => {
      // Leave the modified clicks to the browser: the item is a real anchor
      // now, so ⌘/ctrl-click and middle-click open the page in a new tab.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if ("button" in event && event.button !== 0) return
      event.preventDefault()
      navigate(href)
    },
    [navigate],
  )

  // The active item comes from the frame when one is open: `usePathname()`
  // agrees, but the frame knows first, so the icon lights up on the click
  // rather than a paint later.
  const activePath = frame?.activePath ?? pathname

  const allItems: DockNavRenderItem[] = [
    ...NAV_ITEMS.map(({ href, label, icon }) => ({
      key: href,
      label,
      icon,
      active: activePath === href,
      href,
      onClick: handleNavClick(href),
      onPreload: frame ? () => frame.preloadFrame(href) : undefined,
    })),
    ...(categoryState
      ? VIDEO_CATEGORY_ITEMS.map(({ category, label, icon }) => ({
        key: `cat-${category}`,
        label,
        icon,
        active: categoryState.currentCategory === category,
        onClick: () => categoryState.onCategoryChange(category),
      }))
      : []),
  ]

  // Keyboard shortcuts: Alt+<n> for the nth navigation item
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if Alt key is pressed (and not Ctrl/Meta to avoid conflicts)
      if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        const key = event.key
        const numKey = parseInt(key, 10)

        // One shortcut per dock destination, in dock order
        if (numKey >= 1 && numKey <= NAV_ITEMS.length) {
          event.preventDefault()
          const navItem = NAV_ITEMS[numKey - 1]
          navigate(navItem.href)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  const handleDockPlayPause = () => {
    sendYouTubeCommand(isPlaying ? "pauseVideo" : "playVideo")
    setIsPlaying(!isPlaying)
  }

  // Playing indicator item for mobile dock — shows when a video is active
  const playingItem: DockNavRenderItem | null = activeVideoId
    ? {
      key: "playing",
      label: isPlaying ? "Pause" : "Play",
      icon: null as any,
      active: false,
      isPlayingIndicator: true,
      onClick: handleDockPlayPause,
    }
    : null

  const mobileItems: DockNavRenderItem[] = (playingItem
    ? [...allItems, playingItem]
    : allItems
  )

  if (framedDocument) return null

  if (embedded) {
    return (
      // `contents` so this wrapper adds nothing to the sidebar's flex column;
      // it exists only to carry the marker the pre-paint CSS hides on.
      <div data-app-chrome className="contents">
        <DockInstance
          dockClassName="shrink-0 min-h-[52px]"
          side="bottom"
          allItems={allItems}
          onSignIn={() => setLoginOpen(true)}
          embedded
        />
        <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      </div>
    )
  }

  // The videos page (and, via `AppSidebarShell`, every other page the videos
  // sidebar's tool tree links to) renders its own embedded dock at the top of
  // its sidebar (md+), so the fixed top-left dock would otherwise show twice —
  // but only while this document is the one rendering that page. Once it is in
  // the app frame its sidebar dock is in the frame's document, where it takes
  // itself down, and suppressing here as well would leave no dock at all.
  const suppressDesktopDock = !frame?.framedPath && hasEmbeddedDock(activePath)

  return (
    <>
      {/* Desktop: top-left corner */}
      <div data-app-chrome className={cn("fixed top-0 left-2 z-50", suppressDesktopDock ? "hidden" : "hidden md:block")}>
        <DockInstance
          dockClassName="h-[52px] shrink-0 !mt-0 !mx-0"
          side="bottom"
          allItems={allItems}
          onSignIn={() => setLoginOpen(true)}
        />
      </div>

      {/* Mobile: fixed bottom bar */}
      <div data-app-chrome className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe">
        <DropdownMenu>
          <Dock direction="middle" className="h-[52px] shrink-0 !mt-0 mx-auto w-max mb-2 !gap-1 !p-1">
            {mobileItems.map(({ key, label, icon, active, href, onClick, onPreload, isPlayingIndicator, renderIcon }) => {
              return (
                <DockItem
                  key={key}
                  href={href}
                  onClick={onClick}
                  onMouseEnter={onPreload}
                  onFocus={onPreload}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-full transition-colors cursor-pointer",
                    active
                      ? "bg-primary/20 ring-2 ring-primary"
                      : isPlayingIndicator
                        ? "bg-primary/10 ring-1 ring-primary/50 animate-pulse"
                        : "bg-gray-200 dark:bg-neutral-800",
                  )}
                >
                  <DockLabel>{label}</DockLabel>
                  <DockIcon>
                    {renderIcon ? (
                      renderIcon()
                    ) : isPlayingIndicator ? (
                      isPlaying ? (
                        <Pause className="w-5 h-5 text-primary" />
                      ) : (
                        <Play className="w-5 h-5 text-primary" />
                      )
                    ) : (
                      <Image src={icon} alt={label} width={24} height={24} className="w-full h-full" unoptimized />
                    )}
                  </DockIcon>
                </DockItem>
              )
            })}
            <DropdownMenuTrigger asChild>
              <DockItem className="relative flex flex-col items-center gap-0.5 rounded-full transition-colors cursor-pointer bg-gray-200 dark:bg-neutral-800">
                <DockLabel>Settings</DockLabel>
                <DockIcon>
                  <Image src={IconSettings} alt="settings" width={24} height={24} className="w-full h-full" unoptimized />
                </DockIcon>
              </DockItem>
            </DropdownMenuTrigger>
          </Dock>
          <SettingsMenu side="top" onSignIn={() => setLoginOpen(true)} />
        </DropdownMenu>
      </div>

      {/* One dialog for both docks — only one is visible at a time. */}
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  )
}
