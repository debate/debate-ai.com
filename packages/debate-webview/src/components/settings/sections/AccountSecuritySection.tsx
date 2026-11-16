"use client"

/**
 * @fileoverview Settings → Debate Account: passkeys and two-factor
 * authentication (an authenticator app plus backup codes).
 *
 * Both talk to better-auth through `authClient` (lib/auth/client): the
 * `passkey` plugin (`@better-auth/passkey`) and the `twoFactor` plugin. The
 * server side, including how the passkey relying party follows the page's
 * host and how the code is asked for after OAuth / magic-link sign-ins, is in
 * apps/debate-web/lib/auth/security-plugins.ts.
 */

import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Download, KeyRound, ShieldCheck, Trash2 } from "lucide-react"
import { Button } from "../../../ui/primitives/button"
import { Input } from "../../../ui/primitives/input"
import { authClient } from "../../../lib/auth/client"
import { getHostConfig } from "../../../host/config"

/** One row of `passkey.listUserPasskeys`. */
interface PasskeyRow {
  id: string
  name?: string | null
  deviceType?: string
  backedUp?: boolean
  createdAt?: string | Date | null
}

type AuthError = { message?: string; code?: string; status?: number; statusText?: string } | null | undefined

/**
 * A better-auth error as a sentence. Changing a passkey or the second factor
 * needs a sign-in from the last day (the server's fresh-session check), which
 * is the one failure a person can fix themselves.
 */
export function describeAuthError(error: AuthError, fallback: string): string {
  if (!error) return fallback
  if (error.code === "SESSION_NOT_FRESH" || /fresh/i.test(error.message ?? "")) {
    return "For your security, sign out and sign back in, then try this again."
  }
  if (error.code === "INVALID_TWO_FACTOR_CODE" || error.code === "INVALID_CODE") return "That code didn't match. Try the newest one."
  return error.message || error.statusText || fallback
}

/** Whether this page can run a WebAuthn ceremony against the site. */
function usePasskeySupport(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null)
  useEffect(() => {
    // A host on another origin (the browser extension) can't be the
    // site's relying party; it signs in through its own handoff instead.
    const webOrigin = /^https?:/.test(window.location.protocol)
    setSupported(webOrigin && !getHostConfig().signIn && typeof window.PublicKeyCredential !== "undefined")
  }, [])
  return supported
}

/** A starting name for a new passkey, from the browser's platform. */
function defaultPasskeyName(): string {
  if (typeof navigator === "undefined") return "Passkey"
  const ua = navigator.userAgent
  if (/iPhone|iPad/.test(ua)) return "iPhone or iPad"
  if (/Android/.test(ua)) return "Android"
  if (/Mac OS X/.test(ua)) return "Mac"
  if (/Windows/.test(ua)) return "Windows"
  if (/CrOS/.test(ua)) return "Chromebook"
  if (/Linux/.test(ua)) return "Linux"
  return "Passkey"
}

function formatDate(value: PasskeyRow["createdAt"]): string {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString()
}

const CARD = "rounded-lg border border-border p-4 space-y-3"
const HEADING = "flex items-center gap-2 text-sm font-semibold text-foreground"

/** Add, list and remove the account's passkeys. */
export function PasskeysSection({ signedIn }: { signedIn: boolean }) {
  const supported = usePasskeySupport()
  const [passkeys, setPasskeys] = useState<PasskeyRow[] | null>(null)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await authClient.passkey.listUserPasskeys()
    if (error) {
      setError(describeAuthError(error, "Could not load your passkeys."))
      return
    }
    setPasskeys((data ?? []) as PasskeyRow[])
  }, [])

  useEffect(() => {
    setName(defaultPasskeyName())
    if (signedIn) void load()
  }, [signedIn, load])

  const add = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await authClient.passkey.addPasskey({ name: name.trim() || defaultPasskeyName() })
      if (result?.error) {
        // Closing the browser's prompt is a choice, not a failure.
        if (/cancel|abort|not allowed/i.test(result.error.message ?? "")) return
        setError(describeAuthError(result.error, "Could not create the passkey."))
        return
      }
      setNotice("Passkey added. You can use it to sign in on this device.")
      await load()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    setError(null)
    setNotice(null)
    const { error } = await authClient.passkey.deletePasskey({ id })
    if (error) setError(describeAuthError(error, "Could not remove the passkey."))
    await load()
  }

  return (
    <section aria-labelledby="account-passkeys-heading" className={CARD}>
      <h4 id="account-passkeys-heading" className={HEADING}>
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        Passkeys
      </h4>
      <p className="text-muted-foreground">
        Sign in with your fingerprint, face, screen lock or a security key instead of an email link. The private key
        stays on your device or password manager; Debate AI only stores its public half.
      </p>

      {!signedIn ? (
        <p className="text-foreground">
          <a href="/login" className="underline">
            Sign in
          </a>{" "}
          to add a passkey.
        </p>
      ) : supported === false ? (
        <p className="text-muted-foreground">
          This browser or app can&apos;t create passkeys. Open debate-ai.com in Chrome, Safari, Edge or Firefox to add
          one.
        </p>
      ) : (
        <>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void add()
            }}
          >
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name, e.g. MacBook"
              aria-label="Passkey name"
              maxLength={60}
              className="flex-1 min-w-[10rem]"
            />
            <Button type="submit" size="sm" disabled={busy || supported === null}>
              {busy ? "Waiting for your device…" : "Add passkey"}
            </Button>
          </form>

          {passkeys === null ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : passkeys.length === 0 ? (
            <p className="text-muted-foreground">No passkeys yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {passkeys.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{row.name || "Passkey"}</p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        formatDate(row.createdAt) && `Added ${formatDate(row.createdAt)}`,
                        row.backedUp ? "Synced" : row.deviceType === "singleDevice" ? "This device only" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Remove passkey ${row.name || ""}`.trim()}
                    onClick={() => void remove(row.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {notice && <p className="text-foreground">{notice}</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}

/** The base32 secret inside an `otpauth://` URI, for typing into an app by hand. */
export function totpSecretOf(totpURI: string): string | null {
  try {
    return new URL(totpURI).searchParams.get("secret")
  } catch {
    return null
  }
}

/** The TOTP URI as an inline SVG QR code (uqr is small and dependency-free). */
function TotpQrCode({ uri }: { uri: string }) {
  const [svg, setSvg] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void import("uqr").then(({ renderSVG }) => {
      if (!cancelled) setSvg(renderSVG(uri, { border: 2, pixelSize: 5 }))
    })
    return () => {
      cancelled = true
    }
  }, [uri])
  if (!svg) return <div className="h-40 w-40 rounded-md bg-muted" aria-hidden="true" />
  return (
    <div
      role="img"
      aria-label="QR code for your authenticator app"
      className="h-40 w-40 overflow-hidden rounded-md bg-white p-1 [&_svg]:h-full [&_svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

/** Backup codes, with copy and download. */
function BackupCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false)
  const text = codes.join("\n")
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground">
        Save these backup codes somewhere safe. Each one signs you in once if you lose your authenticator app. They
        won&apos;t be shown again.
      </p>
      <ul className="grid grid-cols-2 gap-1 rounded-md bg-muted p-3 font-mono text-xs sm:grid-cols-3">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            })
          }}
        >
          {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
          Copy
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([`Debate AI backup codes\n\n${text}\n`], { type: "text/plain" }))
            const link = document.createElement("a")
            link.href = url
            link.download = "debate-ai-backup-codes.txt"
            link.click()
            URL.revokeObjectURL(url)
          }}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Download
        </Button>
      </div>
    </div>
  )
}

/** Turn authenticator-app 2FA on or off, and make new backup codes. */
export function TwoFactorSection({ signedIn, enabled: enabledFromSession }: { signedIn: boolean; enabled: boolean }) {
  const [enabled, setEnabled] = useState(enabledFromSession)
  // Set while the authenticator app is being added, until a code verifies.
  const [setup, setSetup] = useState<{ totpURI: string; backupCodes: string[] } | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [code, setCode] = useState("")
  const [confirmingDisable, setConfirmingDisable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setEnabled(enabledFromSession), [enabledFromSession])

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  const start = () =>
    run(async () => {
      const { data, error } = await authClient.twoFactor.enable({})
      if (error || !data || !("totpURI" in data)) {
        setError(describeAuthError(error, "Could not start two-factor setup."))
        return
      }
      setSetup({ totpURI: data.totpURI, backupCodes: data.backupCodes })
      setBackupCodes(null)
      setCode("")
    })

  const verify = () =>
    run(async () => {
      const { error } = await authClient.twoFactor.verifyTotp({ code: code.trim() })
      if (error) {
        setError(describeAuthError(error, "That code didn't work."))
        return
      }
      setBackupCodes(setup?.backupCodes ?? null)
      setSetup(null)
      setCode("")
      setEnabled(true)
    })

  const disable = () =>
    run(async () => {
      const { error } = await authClient.twoFactor.disable({})
      if (error) {
        setError(describeAuthError(error, "Could not turn off two-factor authentication."))
        return
      }
      setEnabled(false)
      setConfirmingDisable(false)
      setBackupCodes(null)
    })

  const regenerate = () =>
    run(async () => {
      const { data, error } = await authClient.twoFactor.generateBackupCodes({})
      if (error || !data) {
        setError(describeAuthError(error, "Could not make new backup codes."))
        return
      }
      setBackupCodes(data.backupCodes)
    })

  const secret = setup ? totpSecretOf(setup.totpURI) : null

  return (
    <section aria-labelledby="account-2fa-heading" className={CARD}>
      <h4 id="account-2fa-heading" className={HEADING}>
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        Two-factor authentication
        {signedIn && (
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${
              enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {enabled ? "On" : "Off"}
          </span>
        )}
      </h4>
      <p className="text-muted-foreground">
        After you sign in with Google, Discord, LinkedIn or an email link, also ask for a 6-digit code from an
        authenticator app (Google Authenticator, 1Password, Authy, Microsoft Authenticator…). Passkey sign-in already
        counts as two factors, so it skips the code.
      </p>

      {!signedIn ? (
        <p className="text-foreground">
          <a href="/login" className="underline">
            Sign in
          </a>{" "}
          to turn on two-factor authentication.
        </p>
      ) : setup ? (
        <div className="space-y-3">
          <p className="text-foreground">
            1. Scan this QR code with your authenticator app
            {secret ? (
              <>
                , or enter the key <code className="break-all rounded bg-muted px-1">{secret}</code>
              </>
            ) : null}
            .
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <TotpQrCode uri={setup.totpURI} />
            <a href={setup.totpURI} className="underline">
              Open in an authenticator app on this device
            </a>
          </div>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void verify()
            }}
          >
            <label htmlFor="account-2fa-code" className="text-foreground">
              2. Enter the 6-digit code it shows:
            </label>
            <Input
              id="account-2fa-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="w-28"
            />
            <Button type="submit" size="sm" disabled={busy || code.length !== 6}>
              Verify and turn on
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSetup(null)} disabled={busy}>
              Cancel
            </Button>
          </form>
        </div>
      ) : enabled ? (
        <div className="space-y-3">
          {backupCodes && <BackupCodes codes={backupCodes} />}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void regenerate()} disabled={busy}>
              New backup codes
            </Button>
            {confirmingDisable ? (
              <>
                <Button type="button" size="sm" variant="destructive" onClick={() => void disable()} disabled={busy}>
                  Yes, turn off
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingDisable(false)}>
                  Keep it on
                </Button>
              </>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={() => setConfirmingDisable(true)} disabled={busy}>
                Turn off
              </Button>
            )}
          </div>
          {backupCodes === null && (
            <p className="text-xs text-muted-foreground">
              Making new backup codes replaces the old ones.
            </p>
          )}
        </div>
      ) : (
        <Button type="button" size="sm" onClick={() => void start()} disabled={busy}>
          Set up an authenticator app
        </Button>
      )}

      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
