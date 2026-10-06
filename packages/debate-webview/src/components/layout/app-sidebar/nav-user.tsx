"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, ChevronsUpDown, LogIn, LogOut, Settings, Users } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "../../../lib/ui/primitives/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
 * account menu (settings, notifications, contacts, sign out — the same
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
              <ChevronsUpDown className="ml-auto size-4" />
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
              <DropdownMenuItem asChild>
                <Link href={settingsHrefForPath(pathname)}>
                  <Settings />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/notifications">
                  <Bell />
                  Notifications
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/contacts">
                  <Users />
                  Contacts
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => { void signOut() }}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
