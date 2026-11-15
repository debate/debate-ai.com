"use client"

/**
 * @fileoverview "Sign in with a passkey" on the sign-in form. Shown only where
 * the page can run a WebAuthn ceremony against the site; a person adds their
 * passkey first in Settings → Debate Account (AccountSecuritySection).
 */

import { useEffect, useState } from "react"
import { KeyRound } from "lucide-react"
import { toast } from "sonner"

import { Button } from "../../../ui/primitives/button"
import { authClient } from "../../../lib/auth/client"
import { safeCallbackURL } from "../../../lib/auth/safe-callback"

export function PasskeySignIn({ callbackURL }: { callbackURL: string }) {
  const [supported, setSupported] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setSupported(typeof window.PublicKeyCredential !== "undefined")
  }, [])

  if (!supported) return null

  const handleSignIn = async () => {
    setIsLoading(true)
    try {
      const result = await authClient.signIn.passkey()
      if (result?.error) {
        // Closing the browser's prompt is a choice, not a failure.
        if (!/cancel|abort|not allowed/i.test(result.error.message ?? "")) {
          toast.error(result.error.message || "Could not sign in with a passkey.")
        }
        setIsLoading(false)
        return
      }
      // A full load, so every provider re-reads the new session cookie.
      window.location.href = safeCallbackURL(callbackURL)
    } catch (error) {
      console.error("[auth] passkey sign-in failed:", error)
      toast.error("Could not sign in with a passkey.")
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      className="w-full flex items-center justify-center gap-2"
      onClick={handleSignIn}
      disabled={isLoading}
    >
      <KeyRound className="w-4 h-4" />
      {isLoading ? "Waiting for your passkey…" : "Sign in with a passkey"}
    </Button>
  )
}

export default PasskeySignIn
