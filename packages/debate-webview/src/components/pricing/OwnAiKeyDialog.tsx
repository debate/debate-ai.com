"use client"

import { useEffect, useState } from "react"
import { attachOwnAiKey, subscribeToAiKeyNeeded } from "../../lib/ai/own-ai-key"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../lib/ui/primitives/dialog"
import { OwnAiKeyForm } from "../settings/OwnAiKeySection"

/**
 * Installs the fetch wrapper that sends the user's own AI key with AI
 * requests (`lib/ai/own-ai-key.ts`), and opens when an AI route reports that
 * Debate AI's shared key has hit its API limit, offering to paste one.
 * Mounted once by `AppShell`, next to `PlanLimitDialog`.
 */
export function OwnAiKeyDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const detach = attachOwnAiKey()
    const unsubscribe = subscribeToAiKeyNeeded(() => setOpen(true))
    return () => {
      unsubscribe()
      detach()
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AI limit reached</DialogTitle>
          <DialogDescription>
            Debate AI&apos;s shared AI key has hit its API limit for now. Add your own key to keep going — then try
            again.
          </DialogDescription>
        </DialogHeader>
        <OwnAiKeyForm onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
