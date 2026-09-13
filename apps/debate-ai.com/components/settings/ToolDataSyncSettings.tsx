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
import { useEffect, useState } from "react"
import { Bell, BellOff, Check, CloudOff, RefreshCw, Cloud } from "lucide-react"
import { Button } from "../../lib/ui/primitives/button"
import { TOOL_RECORD_COLLECTIONS } from "debate-data-sync/src/state/toolRecordCollections"
import { useToolRecordSync } from "@/lib/hooks/useToolRecordSync"
import { isSignInPromptOptedOut, setSignInPromptOptedOut } from "@/lib/sign-in-prompt-preference"

/**
 * One row per tool rather than per collection: two collections back the
 * Opponent Team Profiles page (the profiles and the rounds they aggregate)
 * and two back Judge Profiles, and "Opponent round records" is not a tool a
 * reader would go looking for.
 */
const SYNCED_TOOLS = TOOL_RECORD_COLLECTIONS.reduce<{ href: string; label: string; keys: string[] }[]>(
  (tools, collection) => {
    const existing = tools.find((tool) => tool.href === collection.href)
    if (existing) {
      existing.keys.push(collection.key)
      return tools
    }
    tools.push({ href: collection.href, label: collection.label, keys: [collection.key] })
    return tools
  },
  [],
)

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

      <ul className="flex flex-col gap-1.5">
        {SYNCED_TOOLS.map((tool) => {
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
