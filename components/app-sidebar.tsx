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

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar - hidden on mobile */}
      <div className="hidden md:flex flex-col w-16 bg-muted/30 border-r border-border items-center py-4 gap-3 justify-between">
        <div className="flex flex-col gap-3">
          <Link href="/cards" className="w-full">
            <Button
              variant="ghost"
              className={`h-auto w-full flex flex-col gap-1 p-2 ${pathname === "/cards"
                ? "shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.2)] bg-gradient-to-b from-white/20 to-transparent dark:from-white/10 border border-white/20"
                : ""
                }`}
            >
              <Image
                src="/icons/icon-collective-mind.png"
                alt="Search"
                width={24}
                height={24}
              />
              <span className="text-[10px]">Shared</span>
            </Button>
          </Link>

          <Link href="/edit" className="w-full">
            <Button
              variant="ghost"
              className={`h-auto w-full flex flex-col gap-1 p-2 ${pathname === "/edit"
                ? "shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.2)] bg-gradient-to-b from-white/20 to-transparent dark:from-white/10 border border-white/20"
                : ""
                }`}
            >
              <Image src="/icons/icon-read.svg" alt="Organize" width={24} height={24} className="h-6 w-6" />
              <span className="text-[10px]">Organize</span>
            </Button>
          </Link>

          <Link href="/debate" className="w-full">
            <Button
              variant="ghost"
              className={`h-auto w-full flex flex-col gap-1 p-2 ${pathname === "/debate"
                ? "shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.2)] bg-gradient-to-b from-white/20 to-transparent dark:from-white/10 border border-white/20"
                : ""
                }`}
            >
              <Image src="/icons/icon-rounds.svg" alt="Debate" width={24} height={24} className="h-6 w-6" />
              <span className="text-[10px]">Debate</span>
            </Button>
          </Link>

          <Link href="/videos" className="w-full">
            <Button
              variant="ghost"
              className={`h-auto w-full flex flex-col gap-1 p-2 ${pathname === "/videos"
                ? "shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.2)] bg-gradient-to-b from-white/20 to-transparent dark:from-white/10 border border-white/20"
                : ""
                }`}
            >
              <Image src="/icons/icon-lectures.svg" alt="Watch" width={24} height={24} className="h-6 w-6" />
              <span className="text-[10px]">Watch</span>
            </Button>
          </Link>
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
          <Link href="/cards">
            <DockItem
              className={cn(
                "aspect-square rounded-full transition-colors",
                pathname === "/cards" ? "bg-primary/20 ring-2 ring-primary" : "bg-gray-200 dark:bg-neutral-800",
              )}
            >
              <DockLabel>Search</DockLabel>
              <DockIcon>
                <Brain className="h-6 w-6" />
              </DockIcon>
            </DockItem>
          </Link>

          <Link href="/edit">
            <DockItem
              className={cn(
                "aspect-square rounded-full transition-colors",
                pathname === "/edit" ? "bg-primary/20 ring-2 ring-primary" : "bg-gray-200 dark:bg-neutral-800",
              )}
            >
              <DockLabel>Organize</DockLabel>
              <DockIcon>
                <Image src="/icons/icon-read.svg" alt="Organize" width={24} height={24} className="h-6 w-6" />
              </DockIcon>
            </DockItem>
          </Link>

          <Link href="/debate">
            <DockItem
              className={cn(
                "aspect-square rounded-full transition-colors",
                pathname === "/debate" ? "bg-primary/20 ring-2 ring-primary" : "bg-gray-200 dark:bg-neutral-800",
              )}
            >
              <DockLabel>Debate</DockLabel>
              <DockIcon>
                <Image src="/icons/icon-rounds.svg" alt="Debate" width={24} height={24} className="h-6 w-6" />
              </DockIcon>
            </DockItem>
          </Link>

          <Link href="/videos">
            <DockItem
              className={cn(
                "aspect-square rounded-full transition-colors",
                pathname === "/videos" ? "bg-primary/20 ring-2 ring-primary" : "bg-gray-200 dark:bg-neutral-800",
              )}
            >
              <DockLabel>Watch</DockLabel>
              <DockIcon>
                <Image src="/icons/icon-lectures.svg" alt="Watch" width={24} height={24} className="h-6 w-6" />
              </DockIcon>
            </DockItem>
          </Link>

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
