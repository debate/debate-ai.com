"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { LogIn, LogOut, UserCircle2, Moon, Sun, Palette, Pause, Play, Trophy, Inbox, Award, Library, NotebookPen, History, Gavel, Users, Dumbbell, ClipboardList, GraduationCap, Scale, FileText, Swords, MessageSquareText, Type, ListTree, Bot, Lightbulb, PlayCircle, TrendingUp, BarChart3, Users2, School, FolderTree, ThumbsUp, Medal, Target, BookOpen, PieChart, Presentation, ListChecks, Flame, CheckSquare, Landmark, MapPin, Sparkles, Bell, ListOrdered, Compass, Star, FileStack } from "lucide-react"
import { toast } from "sonner"
import { cn } from "debate-ui/src/lib/utils"
import { Dock, DockIcon, DockItem, DockLabel } from "debate-ui/src/layout/dock"
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
import {
  IconCollectiveMind,
  IconFlowFlower,
  IconRead,
  IconBook,
  IconLectures,
  IconSettings,
  IconRoundsYoutube
} from "debate-ui/src/icons"

const NAV_ITEMS = [
  { href: "/videos", label: "Videos", icon: IconRoundsYoutube },
  { href: "/cards", label: "Shared", icon: IconCollectiveMind },
  { href: "/debate", label: "Debate", icon: IconFlowFlower },
  { href: "/doc", label: "Docs", icon: IconRead },
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

function SettingsMenu({ side, onSignIn }: { side: "bottom" | "top"; onSignIn: () => void }) {
  const themeState = useThemeState()
  const router = useRouter()

  return (
    <DropdownMenuContent side={side} align="end" className="w-48">
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/reason-editor") }}>
        <Image src={IconBook} alt="" width={16} height={16} className="mr-2 h-4 w-4" unoptimized />
        Reason Editor
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/speech-documents") }}>
        <FileStack className="mr-2 h-4 w-4" />
        Speech Documents
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/doc") }}>
        <Image src={IconRead} alt="" width={16} height={16} className="mr-2 h-4 w-4" unoptimized />
        Debate Docs
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/research") }}>
        <Library className="mr-2 h-4 w-4" />
        Research Workspace
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/coach") }}>
        <GraduationCap className="mr-2 h-4 w-4" />
        Coach Workspace
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/rank") }}>
        <ListOrdered className="mr-2 h-4 w-4" />
        Rankings
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/leaderboard") }}>
        <Trophy className="mr-2 h-4 w-4" />
        Leaderboard
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/contributions") }}>
        <ThumbsUp className="mr-2 h-4 w-4" />
        Contributions Feed
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/awards") }}>
        <Medal className="mr-2 h-4 w-4" />
        Contributor Awards
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/best-card") }}>
        <Sparkles className="mr-2 h-4 w-4" />
        Daily Best Card
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/inbox") }}>
        <Inbox className="mr-2 h-4 w-4" />
        Task Inbox
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/progress") }}>
        <Award className="mr-2 h-4 w-4" />
        Progress
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/library") }}>
        <Library className="mr-2 h-4 w-4" />
        Evidence Library
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/scoring") }}>
        <Star className="mr-2 h-4 w-4" />
        LLM Card Scoring
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/prep-notes") }}>
        <NotebookPen className="mr-2 h-4 w-4" />
        Prep Notes
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/notifications") }}>
        <Bell className="mr-2 h-4 w-4" />
        Notifications
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/revisions") }}>
        <History className="mr-2 h-4 w-4" />
        Revision Incentives
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/judges") }}>
        <Gavel className="mr-2 h-4 w-4" />
        Judge Profiles
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/opponents") }}>
        <Users className="mr-2 h-4 w-4" />
        Opponent Team Profiles
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/drills") }}>
        <Dumbbell className="mr-2 h-4 w-4" />
        Practice Drills
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/briefings") }}>
        <ClipboardList className="mr-2 h-4 w-4" />
        Pre-Round Briefings
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/strategy") }}>
        <Compass className="mr-2 h-4 w-4" />
        Scout-to-Strategy
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/coaching") }}>
        <GraduationCap className="mr-2 h-4 w-4" />
        AI Coach Mode
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/paradigms") }}>
        <Scale className="mr-2 h-4 w-4" />
        Judge Paradigm Picker
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/judge-decision") }}>
        <Landmark className="mr-2 h-4 w-4" />
        AI Judge Decision
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/summaries") }}>
        <FileText className="mr-2 h-4 w-4" />
        Speech Transcript Summaries
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/practice-opponent") }}>
        <Swords className="mr-2 h-4 w-4" />
        Opponent Persona Picker
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/reviews") }}>
        <MessageSquareText className="mr-2 h-4 w-4" />
        Review Queue
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/word-count") }}>
        <Type className="mr-2 h-4 w-4" />
        Word-Count Speeches
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/outline") }}>
        <ListTree className="mr-2 h-4 w-4" />
        Argument Tree Outline
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/versus-ai") }}>
        <Bot className="mr-2 h-4 w-4" />
        Online Debate Versus AI
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/brainstorm") }}>
        <Lightbulb className="mr-2 h-4 w-4" />
        Team Brainstorm Assist
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/collaboration") }}>
        <Users2 className="mr-2 h-4 w-4" />
        Team Collaboration Mode
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/practice-round") }}>
        <PlayCircle className="mr-2 h-4 w-4" />
        Practice Round Simulator
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/standings") }}>
        <TrendingUp className="mr-2 h-4 w-4" />
        CX NDCA Standings
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/outcomes") }}>
        <BarChart3 className="mr-2 h-4 w-4" />
        AI Response-Outcome Charts
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/coaching-programs") }}>
        <School className="mr-2 h-4 w-4" />
        Coaching Programs
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/argument-library") }}>
        <FolderTree className="mr-2 h-4 w-4" />
        Argument Library
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/group-challenges") }}>
        <Target className="mr-2 h-4 w-4" />
        Group Challenges
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/coach-materials") }}>
        <BookOpen className="mr-2 h-4 w-4" />
        Coach Materials
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/coverage") }}>
        <PieChart className="mr-2 h-4 w-4" />
        Topic Coverage Dashboard
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/prep-room") }}>
        <Presentation className="mr-2 h-4 w-4" />
        Collaboration Prep Room
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/progress-tracking") }}>
        <ListChecks className="mr-2 h-4 w-4" />
        Research Progress
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/streaks") }}>
        <Flame className="mr-2 h-4 w-4" />
        Quest Streaks
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/cards/quests") }}>
        <CheckSquare className="mr-2 h-4 w-4" />
        Daily Quests
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push("/annotations") }}>
        <MapPin className="mr-2 h-4 w-4" />
        Flow Annotations
      </DropdownMenuItem>
      <DropdownMenuSeparator />
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
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); themeState.toggleLightDark() }}>
            {themeState.isDark ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
            {themeState.isDark ? "Switch to Light" : "Switch to Dark"}
          </DropdownMenuItem>
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
}: {
  dockClassName: string
  side: "bottom" | "top"
  allItems: { key: string; label: string; icon: any; active: boolean; onClick: () => void }[]
  onSignIn: () => void
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
          <DockItem className="flex flex-col items-center gap-0.5 rounded-full transition-colors cursor-pointer bg-gray-200 dark:bg-neutral-800">
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
 */
export function CategoryDock() {
  const pathname = usePathname()
  const router = useRouter()
  const categoryState = useCategoryDockState()
  const { activeVideoId, activeVideoTitle, isMinimized, isPlaying, setMinimized, setIsPlaying } = useVideoPlayerStore()
  // Owned here rather than inside the menu: the dropdown unmounts its content
  // when it closes, which would tear the dialog down with it.
  const [loginOpen, setLoginOpen] = useState(false)

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
              <DockItem className="flex flex-col items-center gap-0.5 rounded-full transition-colors cursor-pointer bg-gray-200 dark:bg-neutral-800">
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
