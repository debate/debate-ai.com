"use client"

/**
 * Site-wide command palette — jump to any tool from anywhere in the app
 * with Ctrl/Cmd+Shift+Space, mirroring the same gesture the live Reason
 * Editor already binds for its own command bar (see
 * `docs/features/reason-editor-app-tools-menu.md`).
 *
 * Deliberately disabled on `/reason-editor`: that route mounts CardMirror's
 * page-level engine singleton, which installs its own global
 * `Mod-Shift-Space` handler for its command bar ("searches commands,
 * settings, files, and your quick cards from one box") the moment it
 * boots. Binding a second listener for the same chord there would race
 * that handler rather than complement it — see that doc's "Why not a
 * fourth Ctrl/Cmd-Shift-Space source instead" section. Every other route
 * had no keyboard-driven "jump to a tool" gesture at all.
 */

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "debate-ui/src/primitives/command"
import { TOOL_GROUPS } from "@/lib/tools-registry"

// Routes that mount their own Ctrl/Cmd+Shift+Space command surface.
const ROUTES_WITH_OWN_COMMAND_BAR = new Set(["/reason-editor"])

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const disabled = pathname != null && ROUTES_WITH_OWN_COMMAND_BAR.has(pathname)

  useEffect(() => {
    if (disabled) return
    function onKeyDown(e: KeyboardEvent) {
      const isSpace = e.code === "Space" || e.key === " "
      if (!isSpace || !e.shiftKey || !(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      setOpen((prev) => !prev)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [disabled])

  // Close automatically if the disabled route is reached while open (a
  // navigation from inside the palette itself already closes it, but this
  // also covers back/forward navigation).
  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  const groups = useMemo(() => TOOL_GROUPS, [])

  if (disabled) return null

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a tool… (Ctrl/Cmd+Shift+Space)" />
      <CommandList>
        <CommandEmpty>No tool matches that search.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group.heading} heading={group.heading}>
            {group.tools.map((tool) => (
              <CommandItem
                key={tool.href}
                value={`${tool.label} ${tool.description}`}
                onSelect={() => go(tool.href)}
              >
                <tool.icon className="mr-2 h-4 w-4 shrink-0" />
                {tool.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
