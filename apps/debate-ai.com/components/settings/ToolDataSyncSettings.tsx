"use client"

/**
 * @fileoverview "Tool data" section on `/settings` — the visible half of the
 * shared tool-record sync (`lib/hooks/useToolRecordSync.ts`).
 *
 * The sync itself is silent by design: every tool keeps reading and writing
 * its own `localStorage` store, and the account is a mirror kept up behind
 * it. That leaves one question a user can't otherwise answer — *is* my work
 * being kept, and for which tools — which is what this section is. It lists
 * every synced tool with a link to it, says plainly whether this browser is
 * syncing or working locally, and offers a "Sync now" button for the case
 * where a merge failed or a second device has since saved something.
 *
 * Grouped with the other account-linked sections (`FavoriteToolsSettings`,
 * `UserSettingsPanel`) on the Account tab, and written to the same
 * "signed out is a normal state, not an error" rule they follow.
 *
 * @module components/settings/ToolDataSyncSettings
 */

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Bell, BellOff, Check, CloudOff, RefreshCw, Cloud, Search } from "lucide-react"
import { Button } from "../../lib/ui/primitives/button"
import { Input } from "../../lib/ui/primitives/input"
import {
  TOOL_RECORD_COLLECTIONS,
  TOOL_RECORD_SECTIONS,
  type ToolRecordSection,
} from "debate-data-sync/src/state/toolRecordCollections"
import { useToolRecordSync } from "@/lib/hooks/useToolRecordSync"
import { isSignInPromptOptedOut, setSignInPromptOptedOut } from "@/lib/sign-in-prompt-preference"
import { filterSyncedToolSections } from "@/lib/settings/filter-synced-tool-sections"

interface SyncedTool {
  href: string
  label: string
  keys: string[]
}

/**
 * One row per tool rather than per collection: two collections back the
 * Opponent Team Profiles page (the profiles and the rounds they aggregate)
 * and two back Judge Profiles, and "Opponent round records" is not a tool a
 * reader would go looking for. Grouped by section and in
 * {@link TOOL_RECORD_SECTIONS} order so a list that has grown past fifty
 * tools reads as the sidebar's own sections rather than one long scroll.
 */
const SYNCED_TOOL_SECTIONS: { section: ToolRecordSection; tools: SyncedTool[] }[] = TOOL_RECORD_SECTIONS.map(
  (section) => {
    const tools: SyncedTool[] = []
    for (const collection of TOOL_RECORD_COLLECTIONS) {
      if (collection.section !== section) continue
      const existing = tools.find((tool) => tool.href === collection.href)
      if (existing) {
        existing.keys.push(collection.key)
        continue
      }
      tools.push({ href: collection.href, label: collection.label, keys: [collection.key] })
    }
    return { section, tools }
  },
).filter((group) => group.tools.length > 0)

export function ToolDataSyncSettings() {
  const { enabled, reconciled, results, resync } = useToolRecordSync()

  // Read after mount, not during render: the opt-out lives in localStorage,
  // which a server render can't see, so starting from its default (asking)
  // avoids a hydration mismatch.
  const [promptsOptedOut, setPromptsOptedOut] = useState(false)
  useEffect(() => {
    setPromptsOptedOut(isSignInPromptOptedOut())
  }, [])

  const failedKeys = new Set(results.filter((result) => result.error).map((result) => result.collection))

  const [query, setQuery] = useState("")
  const visibleSections = useMemo(
    () => filterSyncedToolSections(SYNCED_TOOL_SECTIONS, query),
    [query],
  )

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 pb-6">
      <div className="flex items-center gap-1.5 mb-1">
        {enabled ? (
          <Cloud className="h-4 w-4 text-sky-500" />
        ) : (
          <CloudOff className="h-4 w-4 text-muted-foreground" />
        )}
        <h2 className="text-base font-semibold">Tool data</h2>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        {enabled
          ? "What you save in these tools is stored on your account, so it follows you to another device. Everything still works offline — this browser keeps its own copy either way."
          : "These tools save to this browser only. Sign in and your saved work is kept on your account instead, and follows you to another device."}
      </p>

      {!enabled && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
          <p className="text-sm text-muted-foreground">
            {promptsOptedOut
              ? "You won't be asked to sign in when you save in a tool."
              : "You'll occasionally be asked to sign in when you save in a tool."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              const next = !promptsOptedOut
              setSignInPromptOptedOut(next)
              setPromptsOptedOut(next)
            }}
          >
            {promptsOptedOut ? (
              <>
                <Bell className="h-4 w-4" />
                Ask me
              </>
            ) : (
              <>
                <BellOff className="h-4 w-4" />
                Stop asking
              </>
            )}
          </Button>
        </div>
      )}

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tool data…"
          className="pl-8"
          aria-label="Search tool data"
        />
      </div>

      {visibleSections.length === 0 && (
        <p className="px-1 py-4 text-sm text-muted-foreground">No tools match "{query.trim()}".</p>
      )}

      <div className="flex flex-col gap-4">
        {visibleSections.map((group) => (
          <div key={group.section}>
            <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.section}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {group.tools.map((tool) => {
                const failed = tool.keys.some((key) => failedKeys.has(key))
                return (
                  <li
                    key={tool.href}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <Link
                      href={tool.href}
                      className="flex-1 min-w-0 truncate text-sm font-medium text-foreground hover:underline"
                    >
                      {tool.label}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {!enabled ? (
                        "This browser"
                      ) : failed ? (
                        "Not synced"
                      ) : reconciled ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3.5 w-3.5" />
                          Synced
                        </span>
                      ) : (
                        "Syncing…"
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      {enabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={resync}
          disabled={!reconciled}
        >
          <RefreshCw className={`h-4 w-4 ${reconciled ? "" : "animate-spin"}`} />
          {reconciled ? "Sync now" : "Syncing…"}
        </Button>
      )}
    </div>
  )
}
