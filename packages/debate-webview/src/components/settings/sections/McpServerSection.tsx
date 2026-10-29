"use client"

import { useCallback, useEffect, useState } from "react"
import { BookOpen, Check, Copy, Eye, EyeOff, KeyRound, Plug, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@debate-ai/ui/primitives/button"
import { Input } from "@debate-ai/ui/primitives/input"

/** The setup guide in the help docs (packages/debate-help-docs, features/ui-navigation/mcp-server.mdx). */
export const MCP_SETUP_DOCS_URL = "/docs/features/ui-navigation/mcp-server"

interface ApiKeySummary {
  id: string
  name: string
  hint: string
  createdAt: string
  expiresAt: string
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        })
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  )
}

/**
 * Settings → MCP server & API: the hosted MCP server's URL, a link to the
 * setup guide, and the account's API keys (create, show and copy, reset, revoke) — the
 * keys an MCP client sends as `Authorization: Bearer <key>`. Talks to
 * `/api/mcp/keys` (apps/debate-web/app/api/mcp/keys/route.ts).
 */
export function McpServerSection({ signedIn }: { signedIn: boolean }) {
  const [endpoint, setEndpoint] = useState("https://debate-ai.com/api/mcp")
  const [keys, setKeys] = useState<ApiKeySummary[] | null>(null)
  const [label, setLabel] = useState("")
  const [created, setCreated] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Keys shown in full, by id (fetched on Show, or returned by a reset).
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  // The key waiting on "Reset? The old key stops working" confirmation.
  const [confirmingReset, setConfirmingReset] = useState<string | null>(null)

  useEffect(() => {
    setEndpoint(`${window.location.origin}/api/mcp`)
  }, [])

  const load = useCallback(async () => {
    const res = await fetch("/api/mcp/keys", { credentials: "same-origin" })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(body.error ?? `Could not load your keys (HTTP ${res.status}).`)
      return
    }
    setKeys(body.keys ?? [])
  }, [])

  useEffect(() => {
    if (signedIn) void load()
  }, [signedIn, load])

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/mcp/keys", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: label }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? `Could not create a key (HTTP ${res.status}).`)
        return
      }
      setCreated(body.key)
      setLabel("")
      await load()
    } finally {
      setBusy(false)
    }
  }

  const toggleShow = async (id: string) => {
    setError(null)
    if (revealed[id]) {
      setRevealed(({ [id]: _hidden, ...rest }) => rest)
      return
    }
    const res = await fetch(`/api/mcp/keys?id=${encodeURIComponent(id)}`, { credentials: "same-origin" })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || typeof body.key !== "string") {
      setError(body.error ?? `Could not show the key (HTTP ${res.status}).`)
      return
    }
    setRevealed((current) => ({ ...current, [id]: body.key }))
  }

  const reset = async (id: string) => {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/mcp/keys?id=${encodeURIComponent(id)}`, { method: "PATCH", credentials: "same-origin" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || typeof body.key !== "string") {
        setError(body.error ?? `Could not reset the key (HTTP ${res.status}).`)
        return
      }
      setRevealed((current) => ({ ...current, [id]: body.key }))
      setConfirmingReset(null)
      if (created) setCreated(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (id: string) => {
    setError(null)
    const res = await fetch(`/api/mcp/keys?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? `Could not revoke the key (HTTP ${res.status}).`)
    }
    await load()
  }

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        "debate-ai": {
          type: "http",
          url: endpoint,
          headers: { Authorization: `Bearer ${created ?? "YOUR_API_KEY"}` },
        },
      },
    },
    null,
    2,
  )

  return (
    <div className="space-y-4 text-sm">
      <section aria-labelledby="mcp-endpoint-heading" className="rounded-lg border border-border p-4 space-y-2">
        <h4 id="mcp-endpoint-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Plug className="h-4 w-4" aria-hidden="true" />
          MCP server
        </h4>
        <p className="text-muted-foreground">
          Connect Claude, ChatGPT, Cursor or any other MCP client to Debate AI to search evidence cards, browse round
          videos and transcripts, and read or update your saved rounds, flows and documents. Add this URL as a remote
          (Streamable HTTP) MCP server:
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md bg-muted px-2 py-1.5">{endpoint}</code>
          <CopyButton value={endpoint} label="Copy MCP server URL" />
        </div>
        <a href={MCP_SETUP_DOCS_URL} className="inline-flex items-center gap-1.5 underline text-foreground">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          Setup guide for Claude, ChatGPT, Cursor and VS Code
        </a>
      </section>

      <section aria-labelledby="mcp-keys-heading" className="rounded-lg border border-border p-4 space-y-3">
        <h4 id="mcp-keys-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          API keys
        </h4>
        <p className="text-muted-foreground">
          Search and the video library work without a key. Tools that touch your account (saved rounds, flows,
          documents, settings) need one: create a key here and send it as{" "}
          <code>Authorization: Bearer &lt;key&gt;</code>. A key acts as you, so keep it private, and reset or revoke it
          if it leaks. Keys also work with the REST API at <a href="/api" className="underline">/api</a>.
        </p>

        {!signedIn ? (
          <p className="text-foreground">
            <a href="/login" className="underline">
              Sign in
            </a>{" "}
            to create an API key.
          </p>
        ) : (
          <>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void create()
              }}
            >
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Key name, e.g. Claude Desktop"
                aria-label="API key name"
                maxLength={60}
                className="flex-1 min-w-[14rem]"
              />
              <Button type="submit" size="sm" disabled={busy}>
                Create API key
              </Button>
            </form>

            {created && (
              <div role="status" className="rounded-md border border-border bg-muted/50 p-3 space-y-2">
                <p className="font-medium text-foreground">Your new key. You can show and copy it again from the list below.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded-md bg-background px-2 py-1.5">{created}</code>
                  <CopyButton value={created} label="Copy API key" />
                </div>
                <p className="text-muted-foreground">
                  Config with this key for Claude Code (<code>.mcp.json</code>), Cursor (<code>mcp.json</code>) and other
                  clients that take a URL and headers:
                </p>
                <div className="flex items-start gap-2">
                  <pre className="flex-1 overflow-x-auto rounded-md bg-background px-2 py-1.5 text-xs">{claudeConfig}</pre>
                  <CopyButton value={claudeConfig} label="Copy MCP config" />
                </div>
              </div>
            )}

            {keys && keys.length > 0 && (
              <ul className="divide-y divide-border rounded-md border border-border">
                {keys.map((key) => (
                  <li key={key.id} className="space-y-2 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{key.name}</div>
                        <div className="text-xs text-muted-foreground">
                          …{key.hint} · created {new Date(key.createdAt).toLocaleDateString()} · expires{" "}
                          {new Date(key.expiresAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void toggleShow(key.id)}
                          aria-label={`${revealed[key.id] ? "Hide" : "Show"} ${key.name}`}
                          aria-pressed={Boolean(revealed[key.id])}
                        >
                          {revealed[key.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {revealed[key.id] ? "Hide" : "Show"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmingReset(key.id)}
                          aria-label={`Reset ${key.name}`}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Reset
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void revoke(key.id)}
                          aria-label={`Revoke ${key.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Revoke
                        </Button>
                      </div>
                    </div>
                    {revealed[key.id] && (
                      <div className="flex items-center gap-2">
                        <code className="flex-1 break-all rounded-md bg-muted px-2 py-1.5 text-xs">{revealed[key.id]}</code>
                        <CopyButton value={revealed[key.id]} label={`Copy ${key.name}`} />
                      </div>
                    )}
                    {confirmingReset === key.id && (
                      <div role="alertdialog" className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 p-2">
                        <span className="flex-1">Reset this key? The old key stops working right away.</span>
                        <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => void reset(key.id)}>
                          Reset key
                        </Button>
                        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmingReset(null)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {keys && keys.length === 0 && !created && <p className="text-muted-foreground">No API keys yet.</p>}
          </>
        )}
        {error && <p className="text-destructive">{error}</p>}
      </section>
    </div>
  )
}
