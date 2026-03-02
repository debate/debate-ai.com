/**
 * @fileoverview Application sidebar component providing primary navigation.
 * Renders a vertical icon sidebar on desktop and a macOS-style dock on mobile,
 * including links to all major app sections, a theme toggle, and a user menu.
 */

"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { UserCircle2, Settings, Brain } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeDropdown } from "@/components/theme-dropdown"
import { Dock, DockIcon, DockItem, DockLabel } from "@/components/ui/dock"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  {
    href: "/cards",
    desktopLabel: "Shared",
    mobileLabel: "Search",
    icon: (
      <Image
        src="/icons/icon-collective-mind.png"
        alt="Search"
        width={24}
        height={24}
      />
    ),
    mobileIcon: <Brain className="h-6 w-6" />,
  },
  {
    href: "/edit",
    desktopLabel: "Organize",
    mobileLabel: "Organize",
    icon: <Image src="/icons/icon-read.svg" alt="Organize" width={24} height={24} className="h-6 w-6" />,
  },
  {
    href: "/debate",
    desktopLabel: "Debate",
    mobileLabel: "Debate",
    icon: <Image src="/icons/icon-rounds.svg" alt="Debate" width={24} height={24} className="h-6 w-6" />,
  },
  {
    href: "/videos",
    desktopLabel: "Watch",
    mobileLabel: "Watch",
    icon: <Image src="/icons/icon-lectures.svg" alt="Watch" width={24} height={24} className="h-6 w-6" />,
  },
]

/**
 * Primary application navigation sidebar.
 * On desktop (md+) renders a fixed 16-unit wide vertical sidebar.
 * On mobile renders a bottom dock with magnification animation.
 * @returns The sidebar/dock navigation element.
 */
export function AppSidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar - hidden on mobile */}
      <div className="hidden md:flex flex-col w-16 bg-muted/30 border-r border-border items-center py-4 gap-3 justify-between">
        <div className="flex flex-col gap-3">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="w-full">
              <Button
                variant="ghost"
                className={`h-auto w-full flex flex-col gap-1 p-2 ${pathname === item.href
                  ? "shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.2)] bg-gradient-to-b from-white/20 to-transparent dark:from-white/10 border border-white/20"
                  : ""
                  }`}
              >
                {item.icon}
                <span className="text-[10px]">{item.desktopLabel}</span>
              </Button>
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-3 items-center">
          <div className="flex flex-col gap-1 items-center">
            <ThemeDropdown />
            <span className="text-[10px]">Theme</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
                  <AvatarFallback>
                    <UserCircle2 className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-48">
              <DropdownMenuItem>
                <UserCircle2 className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <span className="text-muted-foreground">Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe">
        <Dock className="mx-auto w-max mb-2" magnification={60} distance={120}>
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              <DockItem
                className={cn(
                  "aspect-square rounded-full transition-colors",
                  pathname === item.href ? "bg-primary/20 ring-2 ring-primary" : "bg-gray-200 dark:bg-neutral-800",
                )}
              >
                <DockLabel>{item.mobileLabel}</DockLabel>
                <DockIcon>{item.mobileIcon || item.icon}</DockIcon>
              </DockItem>
            </Link>
          ))}

          <DockItem className="aspect-square rounded-full bg-gray-200 dark:bg-neutral-800">
            <DockLabel>Theme</DockLabel>
            <DockIcon>
              <ThemeDropdown />
            </DockIcon>
          </DockItem>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <DockItem className="aspect-square rounded-full bg-gray-200 dark:bg-neutral-800">
                <DockLabel>Profile</DockLabel>
                <DockIcon>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
                    <AvatarFallback>
                      <UserCircle2 className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                </DockIcon>
              </DockItem>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-48 mb-2">
              <DropdownMenuItem>
                <UserCircle2 className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <span className="text-muted-foreground">Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Dock>
      </div>
    </>
  )
}
