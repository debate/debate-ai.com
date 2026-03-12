"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { Settings, UserCircle2, Moon, Sun, Palette, Pause, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CategoryType } from "@/lib/types/videos"
import { Dock, DockIcon, DockItem, DockLabel } from "@/components/ui/dock"
import { useVideoPlayerStore, sendYouTubeCommand } from "@/lib/state/videoPlayerStore"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { themeNames, themeColors, formatThemeName, useThemeState } from "@/components/theme-dropdown"
import { useCategoryDockState } from "@/components/category-dock-context"
import {
  IconCollectiveMind,
  IconRounds,
  IconRead,
  IconLectures,
  IconRoundsYoutube,
  IconLeaderboard,
} from "@/components/icons"

const NAV_ITEMS = [
  { href: "/cards", label: "Shared", icon: IconCollectiveMind },
  { href: "/debate", label: "Debate", icon: IconRounds },
  { href: "/edit", label: "Docs", icon: IconRead },
  { href: "/videos", label: "Videos", icon: IconRoundsYoutube },
  { href: "/lectures", label: "Lectures", icon: IconLectures },
  { href: "/rank", label: "Rankings", icon: IconLeaderboard },
]

const VIDEO_CATEGORY_ITEMS: { category: CategoryType; label: string; icon: any }[] = []

function SettingsMenu({ side }: { side: "bottom" | "top" }) {
  const themeState = useThemeState()

  return (
    <DropdownMenuContent side={side} align="end" className="w-48">
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
      <DropdownMenuItem>
        <UserCircle2 className="mr-2 h-4 w-4" />
        Profile
      </DropdownMenuItem>
      <DropdownMenuItem>
        <span className="text-muted-foreground">Sign Out</span>
      </DropdownMenuItem>
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
}: {
  dockClassName: string
  side: "bottom" | "top"
  allItems: { key: string; label: string; icon: any; active: boolean; onClick: () => void }[]
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
              <Image src={icon} alt={label} width={24} height={24} className="w-full h-full" />
            </DockIcon>
          </DockItem>
        ))}
        <DropdownMenuTrigger asChild>
          <DockItem className="flex flex-col items-center gap-0.5 rounded-full transition-colors cursor-pointer bg-gray-200 dark:bg-neutral-800">
            <DockLabel>Settings</DockLabel>
            <DockIcon>
              <Settings className="w-5 h-5" />
            </DockIcon>
          </DockItem>
        </DropdownMenuTrigger>
      </Dock>
      <SettingsMenu side={side} />
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

  const mobileItems = playingItem
    ? [...allItems, playingItem]
    : allItems

  return (
    <>
      {/* Desktop: top-left corner */}
      <div className="hidden md:block fixed top-0 left-2 z-50">
        <DockInstance
          dockClassName="h-[52px] shrink-0 !mt-0 !mx-0"
          side="bottom"
          allItems={allItems}
        />
      </div>

      {/* Mobile: fixed bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe">
        <DropdownMenu>
          <Dock direction="middle" className="h-[52px] shrink-0 !mt-0 mx-auto w-max mb-2">
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
                      <Image src={icon} alt={label} width={24} height={24} className="w-full h-full" />
                    )}
                  </DockIcon>
                </DockItem>
              )
            })}
            <DropdownMenuTrigger asChild>
              <DockItem className="flex flex-col items-center gap-0.5 rounded-full transition-colors cursor-pointer bg-gray-200 dark:bg-neutral-800">
                <DockLabel>Settings</DockLabel>
                <DockIcon>
                  <Settings className="w-5 h-5" />
                </DockIcon>
              </DockItem>
            </DropdownMenuTrigger>
          </Dock>
          <SettingsMenu side="top" />
        </DropdownMenu>
      </div>
    </>
  )
}
