"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { Activity, Bell, Book, BookMarked, Calendar, Code2, FileText, Globe, LayoutGrid, LogIn, LogOut, MessageCircle, MessageSquare, Monitor, Moon, Palette, Pause, Play, Scale, Settings as SettingsIcon, Shield, Sun, Swords, Trophy, UserCircle2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "debate-ui/src/lib/utils"
import { Dock, DockIcon, DockItem, DockLabel } from "debate-ui/src/layout/dock"
import { useAccountNotifications } from "debate-round"
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
} from "debate-ui/src/primitives/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "debate-ui/src/primitives/avatar"
import { themeNames, themeColors, formatThemeName, useThemeState } from "@/components/theme-dropdown"
import { LoginDialog } from "@/components/layout/LoginDialog"
import { authClient } from "@/lib/auth/client"
import { useSession } from "@/lib/hooks/useSession"
import { TOOL_GROUPS } from "@/app/tools/tool-groups"
import {
  IconCollectiveMind,
  IconFlowFlower,
  IconRead,
  IconSettings,
  IconRoundsYoutube,
  IconTools
} from "debate-ui/src/icons"

// Same destinations as packages/debate-ui/src/layout/footer.tsx, split into
// the two Settings-menu submenus below so they're reachable without
// scrolling to the page footer.
const SITE_LINKS = [
  { url: "https://github.com/debate", text: "Github", icon: Code2 },
  { url: "https://discord.gg/5PFjqgtkK", text: "Support", icon: MessageCircle },
  { url: "https://stats.uptimerobot.com/V3HfCBM9de", text: "Status", icon: Activity },
  { url: "/legal/privacy", text: "Privacy", icon: Shield },
  { url: "https://docs.google.com/document/d/1hq7-DE6ls2ryVtOttxR4BNpRdP7xUbBr0M3SMYefek8/edit", text: "Rules", icon: FileText },
]

const DEBATE_LINKS = [
  { url: "https://www.reddit.com/r/Debate+PublicForumDebate+lincolndouglas+policydebate/", text: "Debate Reddit", icon: MessageSquare },
  { url: "https://www.tabroom.com/index/index.mhtml", text: "Tournaments", icon: Calendar },
  { url: "https://www.debate.land", text: "Rankings", icon: Trophy },
  { url: "https://opencaselist.com", text: "Research", icon: BookMarked },
  { url: "https://debaterhub.com", text: "DebaterHub", icon: Scale },
  { url: "https://debate101.org/#hub", text: "Resource Links", icon: Book },
]

const NAV_ITEMS = [
  { href: "/videos", label: "Videos", icon: IconRoundsYoutube },
  { href: "/cards", label: "Shared", icon: IconCollectiveMind },
  { href: "/debate", label: "Debate", icon: IconFlowFlower },
  { href: "/doc", label: "Docs", icon: IconRead },
  { href: "/tools", label: "Tools", icon: IconTools },
]

const VIDEO_CATEGORY_ITEMS: { category: CategoryType; label: string; icon: any }[] = []

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
  unreadNotifications,
}: {
  side: "bottom" | "top"
  onSignIn: () => void
  unreadNotifications: number
}) {
  const themeState = useThemeState()
  const router = useRouter()

  return (
    <DropdownMenuContent side={side} align="end" className="w-48">
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/features") }}>
        <LayoutGrid className="mr-2 h-4 w-4" />
        All Features
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/tools") }}>
        <Image src={IconTools} alt="" width={16} height={16} className="mr-2 h-4 w-4" unoptimized />
        All Tools
      </DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Image src={IconTools} alt="" width={16} height={16} className="mr-2 h-4 w-4" unoptimized />
          Tools
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-56 max-h-[min(500px,70vh)] overflow-y-auto" collisionPadding={8} avoidCollisions>
          {TOOL_GROUPS.map((group) => (
            <DropdownMenuSub key={group.heading}>
              <DropdownMenuSubTrigger>{group.heading}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64 max-h-[min(500px,70vh)] overflow-y-auto" collisionPadding={8} avoidCollisions>
                {group.tools.map((tool) => (
                  <DropdownMenuItem key={tool.href} onSelect={(e) => { e.preventDefault(); router.push(tool.href) }}>
                    <tool.icon className="mr-2 h-4 w-4 shrink-0" />
                    {tool.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/notifications") }}>
        <Bell className="mr-2 h-4 w-4" />
        <span className="flex-1">Notifications</span>
        {unreadNotifications > 0 && (
          <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
            New
          </span>
        )}
      </DropdownMenuItem>
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
 * Renders a single dock instance with all items inline as direct children.
 * This ensures Dock's cloneElement passes mousex/magnification/distance properly.
 */
function DockInstance({
  dockClassName,
  side,
  allItems,
  onSignIn,
  unreadNotifications,
}: {
  dockClassName: string
  side: "bottom" | "top"
  allItems: { key: string; label: string; icon: any; active: boolean; onClick: () => void }[]
  onSignIn: () => void
  unreadNotifications: number
}) {
  return (
    <DropdownMenu>
      <Dock direction="middle" className={dockClassName}>
        {allItems.map(({ key, label, icon, active, onClick }) => (
          <DockItem
            key={key}
            onClick={onClick}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-full transition-colors cursor-pointer",
              active
                ? "bg-primary/20 ring-2 ring-primary"
                : "bg-gray-200 dark:bg-neutral-800",
            )}
          >
            <DockLabel>{label}</DockLabel>
            <DockIcon>
              <Image src={icon} alt={label} width={24} height={24} className="w-full h-full" unoptimized />
            </DockIcon>
          </DockItem>
        ))}
        <DropdownMenuTrigger asChild>
          <DockItem className="relative flex flex-col items-center gap-0.5 rounded-full transition-colors cursor-pointer bg-gray-200 dark:bg-neutral-800">
            <DockLabel>Settings</DockLabel>
            <DockIcon>
              <Image src={IconSettings} alt="settings" width={24} height={24} className="w-full h-full" unoptimized />
            </DockIcon>
            {unreadNotifications > 0 && (
              <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
            )}
          </DockItem>
        </DropdownMenuTrigger>
      </Dock>
      <SettingsMenu side={side} onSignIn={onSignIn} unreadNotifications={unreadNotifications} />
    </DropdownMenu>
  )
}

/**
 * Unified navigation dock.
 * Desktop (md+): fixed top-left corner, compact width.
 * Mobile: fixed bottom, full-width centered, does not overlap content.
 */
export function CategoryDock() {
  const pathname = usePathname()
  const router = useRouter()
  const categoryState = useCategoryDockState()
  const { activeVideoId, activeVideoTitle, isMinimized, isPlaying, setMinimized, setIsPlaying } = useVideoPlayerStore()
  // Owned here rather than inside the menu: the dropdown unmounts its content
  // when it closes, which would tear the dialog down with it.
  const [loginOpen, setLoginOpen] = useState(false)
  const { isAuthenticated } = useSession()
  const { unreadCount } = useAccountNotifications(isAuthenticated)

  const allItems = [
    ...NAV_ITEMS.map(({ href, label, icon }) => ({
      key: href,
      label,
      icon,
      active: pathname === href,
      onClick: () => router.push(href),
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

  // Keyboard shortcuts: Alt+1 through Alt+6 for navigation items
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if Alt key is pressed (and not Ctrl/Meta to avoid conflicts)
      if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        const key = event.key
        const numKey = parseInt(key, 10)

        // Alt+1 through Alt+6 for the first 6 nav items
        if (numKey >= 1 && numKey <= NAV_ITEMS.length) {
          event.preventDefault()
          const navItem = NAV_ITEMS[numKey - 1]
          router.push(navItem.href)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router])

  const handleDockPlayPause = () => {
    sendYouTubeCommand(isPlaying ? "pauseVideo" : "playVideo")
    setIsPlaying(!isPlaying)
  }

  // Playing indicator item for mobile dock — shows when a video is active
  const playingItem = activeVideoId
    ? {
      key: "playing",
      label: isPlaying ? "Pause" : "Play",
      icon: null as any,
      active: false,
      isPlayingIndicator: true,
      onClick: handleDockPlayPause,
    }
    : null

  const mobileItems = (playingItem
    ? [...allItems, playingItem]
    : allItems
  )

  return (
    <>
      {/* Desktop: top-left corner */}
      <div className="hidden md:block fixed top-0 left-2 z-50">
        <DockInstance
          dockClassName="h-[52px] shrink-0 !mt-0 !mx-0"
          side="bottom"
          allItems={allItems}
          onSignIn={() => setLoginOpen(true)}
          unreadNotifications={unreadCount}
        />
      </div>

      {/* Mobile: fixed bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe">
        <DropdownMenu>
          <Dock direction="middle" className="h-[52px] shrink-0 !mt-0 mx-auto w-max mb-2 !gap-1 !p-1">
            {mobileItems.map(({ key, label, icon, active, onClick, ...rest }) => {
              const isPlayingIndicator = (rest as any).isPlayingIndicator
              return (
                <DockItem
                  key={key}
                  onClick={onClick}
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
                    {isPlayingIndicator ? (
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
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
                )}
              </DockItem>
            </DropdownMenuTrigger>
          </Dock>
          <SettingsMenu side="top" onSignIn={() => setLoginOpen(true)} unreadNotifications={unreadCount} />
        </DropdownMenu>
      </div>

      {/* One dialog for both docks — only one is visible at a time. */}
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  )
}
