"use client"

import { useEffect, useState } from "react"
import { KeyRound } from "lucide-react"
import {
  OPENROUTER_KEYS_URL,
  clearOwnAiKey,
  getOwnAiKey,
  maskOwnAiKey,
  setOwnAiKey,
  subscribeOwnAiKey,
  type OwnAiKey,
} from "../../lib/ai/own-ai-key"
import { Button } from "../../lib/ui/primitives/button"
import { Input } from "../../lib/ui/primitives/input"

/**
 * "Your own AI key": paste an OpenRouter or Anthropic key so AI requests are
 * billed to it, under the spending limit the user sets with their provider,
 * instead of Debate AI's shared key and daily plan limits. The key stays in
 * this browser (`lib/ai/own-ai-key.ts`). Rendered in Settings → Preferences
 * and inside the dialog that opens when the shared key hits its API limit.
 */
export function OwnAiKeyForm({ onSaved }: { onSaved?: () => void }) {
  const [saved, setSaved] = useState<OwnAiKey | null>(null)
  const [draft, setDraft] = useState("")
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    setSaved(getOwnAiKey())
    return subscribeOwnAiKey(setSaved)
  }, [])

  const save = () => {
    const next = setOwnAiKey(draft)
    setInvalid(!next)
    if (next) {
      setDraft("")
      onSaved?.()
    }
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted-foreground">
        Use your own{" "}
        <a href={OPENROUTER_KEYS_URL} target="_blank" rel="noreferrer" className="underline text-foreground">
          OpenRouter key
        </a>{" "}
        (or an Anthropic key) and set your own spending limit on it. AI requests then go out on your key, so Debate
        AI&apos;s daily AI limits no longer apply. The key stays in this browser and is only sent with AI requests.
      </p>
      {saved ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground">
            Using your {saved.provider === "openrouter" ? "OpenRouter" : "Anthropic"} key{" "}
            <code>{maskOwnAiKey(saved.key)}</code>
          </span>
          <Button type="button" variant="outline" size="sm" onClick={clearOwnAiKey}>
            Remove
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setInvalid(false)
            }}
            placeholder="sk-or-v1-… or sk-ant-…"
            aria-label="Your OpenRouter or Anthropic API key"
            aria-invalid={invalid || undefined}
            className="flex-1 min-w-[14rem]"
          />
          <Button type="submit" size="sm" disabled={!draft.trim()}>
            Save key
          </Button>
        </form>
      )}
      {invalid && (
        <p className="text-destructive">That doesn&apos;t look like an OpenRouter (sk-or-…) or Anthropic (sk-ant-…) key.</p>
      )}
    </div>
  )
}

export function OwnAiKeySection() {
  return (
    <section id="own-ai-key" aria-labelledby="own-ai-key-heading" className="mb-4 rounded-lg border border-border p-4">
      <h4 id="own-ai-key-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        Your own AI key
      </h4>
      <OwnAiKeyForm />
    </section>
  )
}
