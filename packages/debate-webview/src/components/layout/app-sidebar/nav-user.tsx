"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Check, ChevronsUpDown, LogIn, LogOut, Monitor, Moon, Palette, Settings, Sun, Users } from "lucide-react"

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
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../../../lib/ui/primitives/sidebar"
import { LoginDialog } from "../LoginDialog"
import { useSession } from "../../../lib/hooks/useSession"
import { useSignOut } from "../../../lib/auth/use-sign-out"
import { accountLabel } from "../../../lib/nav/account-label"
import { settingsHrefForPath } from "../../../lib/qwksearch/settings-paths"
import { cn } from "../../../lib/ui/lib/utils"
import { formatThemeName, themeColors, themeNames, useThemeState } from "../../theme-dropdown"

/**
 * The shared dropdown primitive neither sizes nor spaces its icons (its other
 * callers pass `mr-2 h-4 w-4` per icon), so bare lucide icons rendered at 24px
 * flush against their labels. Every row in this menu takes this instead.
 */
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
 * sidebar-07's account row, on the real session. Signed in, it opens the
 * account menu (settings, notifications, contacts, theme, sign out — the same
 * handler the dock's Settings menu uses); signed out, the row itself is the
 * sign-in button and opens the sign-in dialog in place, so the current page
 * survives.
 */
export function NavUser() {
  const { isMobile } = useSidebar()
  const { user, isAuthenticated, isLoading } = useSession()
  const signOut = useSignOut()
  const pathname = usePathname()
  const [loginOpen, setLoginOpen] = useState(false)

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <div className="size-8 shrink-0 rounded-lg bg-sidebar-accent" />
            <span className="truncate text-muted-foreground">Checking session…</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" tooltip="Sign in" onClick={() => setLoginOpen(true)}>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border">
              <LogIn className="size-4" />
            </div>
            <span className="truncate font-medium">Sign in</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      </SidebarMenu>
    )
  }

  const name = accountLabel({ name: user.name, email: user.email })

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserAvatar image={user.image} name={name} />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                {user.email ? <span className="truncate text-xs">{user.email}</span> : null}
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
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
              <DropdownMenuItem asChild className={ITEM}>
                <Link href="/notifications">
                  <Bell />
                  Notifications
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className={ITEM}>
                <Link href="/contacts">
                  <Users />
                  Contacts
                </Link>
              </DropdownMenuItem>
              <ThemeSubmenu />
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={ITEM} onSelect={() => { void signOut() }}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
