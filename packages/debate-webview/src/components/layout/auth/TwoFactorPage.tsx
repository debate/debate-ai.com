"use client"

/**
 * @fileoverview The second step of a sign-in for an account with two-factor
 * authentication on (`/login/two-factor`).
 *
 * The server sends a sign-in here after Google / Discord / LinkedIn, a magic
 * link or One Tap when the account has 2FA on and this browser isn't a
 * trusted device (apps/debate-web/lib/auth/security-plugins.ts). It holds a
 * short-lived pending-sign-in cookie; `twoFactor.verifyTotp` or
 * `verifyBackupCode` spends it and sets the real session cookie.
 */

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { Button } from "../../../ui/primitives/button"
import { Card, CardContent, CardHeader } from "../../../ui/primitives/card"
import { Input } from "../../../ui/primitives/input"
import { Label } from "../../../ui/primitives/label"
import { DebateAiLogo } from "@debate-ai/icons/brand"
import { APP_LOGO_HEIGHT, APP_LOGO_WIDTH, APP_NAME } from "../../../lib/config/site"
import { authClient } from "../../../lib/auth/client"
import { safeCallbackURL } from "../../../lib/auth/safe-callback"

export default function TwoFactorPage() {
  const searchParams = useSearchParams()
  const callbackURL = safeCallbackURL(searchParams.get("callbackURL"))
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [code, setCode] = useState("")
  const [trustDevice, setTrustDevice] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { error } = useBackupCode
        ? await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice })
        : await authClient.twoFactor.verifyTotp({ code: code.trim(), trustDevice })
      if (error) {
        const expired = /cookie|expired/i.test(`${error.code ?? ""} ${error.message ?? ""}`)
        setError(
          expired
            ? "This sign-in timed out. Go back and sign in again."
            : useBackupCode
              ? "That backup code didn't work. Each code works only once."
              : "That code didn't match. Try the newest one from your app.",
        )
        return
      }
      window.location.href = callbackURL
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center gap-4">
          <Image
            src={DebateAiLogo}
            alt={APP_NAME}
            width={APP_LOGO_WIDTH}
            height={APP_LOGO_HEIGHT}
            className="h-auto w-full max-w-[260px]"
            priority
            unoptimized
          />
          <p className="text-sm text-muted-foreground">
            {useBackupCode ? "Enter one of your backup codes" : "Enter the 6-digit code from your authenticator app"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="two-factor-code">{useBackupCode ? "Backup code" : "Code"}</Label>
              <Input
                id="two-factor-code"
                value={code}
                onChange={(event) =>
                  setCode(useBackupCode ? event.target.value : event.target.value.replace(/[^0-9]/g, "").slice(0, 6))
                }
                inputMode={useBackupCode ? "text" : "numeric"}
                autoComplete="one-time-code"
                autoFocus
                required
                disabled={busy}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={trustDevice} onChange={(event) => setTrustDevice(event.target.checked)} />
              Don&apos;t ask again on this device for 30 days
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy || (!useBackupCode && code.length !== 6)}>
              {busy ? "Checking…" : "Verify"}
            </Button>
          </form>
          <div className="mt-4 flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => {
                setUseBackupCode((value) => !value)
                setCode("")
                setError(null)
              }}
            >
              {useBackupCode ? "Use your authenticator app instead" : "Lost your app? Use a backup code"}
            </button>
            <Link href={`/login?callbackURL=${encodeURIComponent(callbackURL)}`} className="underline hover:text-foreground">
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
