"use client"

/**
 * @fileoverview The sign-in controls themselves — social buttons plus the
 * magic-link form — with no page chrome around them.
 *
 * Kept separate from the page so the same controls can be shown full screen at
 * `/login` and inside the settings-menu dialog without the two drifting apart.
 */

import { useEffect, useState } from "react"
import { Mail, Sparkles } from "lucide-react"
import { SiGoogle, SiDiscord } from "@icons-pack/react-simple-icons"
import { FaLinkedin } from "react-icons/fa"
import { toast } from "sonner"

import { Button } from "../../lib/ui/primitives/button"
import { Input } from "../../lib/ui/primitives/input"
import { Label } from "../../lib/ui/primitives/label"
import { authClient } from "@/lib/auth/client"
import { fetchDemoAccountStatus, signInAsDemoAccount } from "debate-round"
import { useAuthProviders } from "@/lib/hooks/useAuthProviders"
import { isNativeWrapper, openInSystemBrowser } from "@/lib/native/tauri"

/** Social providers this form knows how to render, in display order. */
const SOCIAL_PROVIDERS = ["google", "discord", "linkedin"] as const

type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

const PROVIDER_LABELS: Record<SocialProvider, string> = {
  google: "Google",
  discord: "Discord",
  linkedin: "LinkedIn",
}

function ProviderIcon({ provider }: { provider: SocialProvider }) {
  switch (provider) {
    case "google":
      return <SiGoogle className="w-4 h-4" />
    case "discord":
      return <SiDiscord className="w-4 h-4" />
    case "linkedin":
      return <FaLinkedin className="w-4 h-4" />
  }
}

/** One OAuth button. `callbackURL` is where the provider returns the user. */
function SocialSignIn({
  provider,
  callbackURL,
}: {
  provider: SocialProvider
  callbackURL: string
}) {
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = async () => {
    setIsLoading(true)
    try {
      // better-auth resolves with `{ error }` rather than throwing, so a failed
      // sign-in only surfaces if the result is inspected. On success the call
      // redirects and this component unmounts mid-flight.
      const { error } = await authClient.signIn.social({ provider, callbackURL })
      if (error) throw new Error(error.message || error.statusText)
    } catch (error) {
      console.error(`[auth] ${provider} sign-in failed:`, error)
      toast.error(`Could not sign in with ${PROVIDER_LABELS[provider]}`)
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
      <ProviderIcon provider={provider} />
      Continue with {PROVIDER_LABELS[provider]}
    </Button>
  )
}

/** Email form that sends a one-time sign-in link. */
function MagicLinkSignIn({ callbackURL }: { callbackURL: string }) {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { error } = await authClient.signIn.magicLink({ email, callbackURL })
      if (error) throw new Error(error.message || error.statusText)
      setEmailSent(true)
      toast.success("Magic link sent — check your email.")
    } catch (error) {
      console.error("[auth] magic link failed:", error)
      toast.error("Could not send the magic link. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Check your email</h3>
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent a magic link to <strong>{email}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Click the link in the email to sign in.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            setEmailSent(false)
            setEmail("")
          }}
          className="mt-2"
        >
          Use a different email
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSendLink} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="magic-email">Email</Label>
        <Input
          id="magic-email"
          type="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Sending..." : "Send Magic Link"}
      </Button>
    </form>
  )
}

/**
 * "Try the demo account" — signs in as the shared, pre-seeded demo user
 * (see docs/features/user-library.md). Rendered only when `GET /api/demo`
 * reports the feature enabled for this deployment.
 */
function DemoAccountSignIn({ callbackURL }: { callbackURL: string }) {
  const [enabled, setEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchDemoAccountStatus().then((status) => {
      if (!cancelled) setEnabled(status.enabled)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!enabled) return null

  const handleDemo = async () => {
    setIsLoading(true)
    try {
      await signInAsDemoAccount()
      toast.success("Signed in as the demo account.")
      // A full navigation (rather than a client-side push) so every
      // session-aware component re-reads the fresh cookie.
      window.location.href = callbackURL === "/" ? "/library" : callbackURL
    } catch (error) {
      console.error("[auth] demo sign-in failed:", error)
      toast.error((error as Error).message || "Could not sign in to the demo account.")
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or just look around</span>
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        className="w-full flex items-center justify-center gap-2"
        onClick={handleDemo}
        disabled={isLoading}
        data-testid="demo-sign-in"
      >
        <Sparkles className="w-4 h-4" />
        {isLoading ? "Opening the demo…" : "Try the demo account"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        A shared account pre-loaded with sample documents, flows, and shared files. Anything you add is visible to other demo visitors.
      </p>
    </div>
  )
}

export interface LoginFormProps {
  /** Where to land after a successful sign-in. Defaults to the home page. */
  callbackURL?: string
}

/**
 * Sign-in controls for every provider this deployment has credentials for,
 * plus the magic-link fallback that always works.
 *
 * Buttons follow the server's answer: rendering a provider without credentials
 * only produces a redirect that dead-ends at the callback.
 */
export function LoginForm({ callbackURL = "/" }: LoginFormProps) {
  const { providers, isLoading, hasSocialProviders } = useAuthProviders()
  const [isNative, setIsNative] = useState(false)

  useEffect(() => {
    setIsNative(isNativeWrapper())
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="animate-pulse text-sm text-muted-foreground">Loading…</span>
      </div>
    )
  }

  // Google (and most OAuth providers) refuse to run their login flow inside
  // an embedded webview, so inside the native-wrapper shell every sign-in
  // method routes through the system browser instead of the buttons below.
  // The browser tab lands on this same page (without the native handoff) and
  // completes normally there; /auth/native-complete then hands the resulting
  // session back to this window. See packages/native-wrapper/docs/OAUTH.md.
  if (isNative) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">
          For your security, sign-in opens in your default browser.
        </p>
        <Button
          className="w-full"
          onClick={async () => {
            const target = `${window.location.origin}/login?callbackURL=${encodeURIComponent(
              "/auth/native-complete",
            )}`
            const opened = await openInSystemBrowser(target)
            if (!opened) window.location.href = target
          }}
        >
          Continue in your browser
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {hasSocialProviders && (
        <>
          {SOCIAL_PROVIDERS.filter((provider) => providers.includes(provider)).map(
            (provider) => (
              <SocialSignIn key={provider} provider={provider} callbackURL={callbackURL} />
            ),
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>
        </>
      )}

      <MagicLinkSignIn callbackURL={callbackURL} />

      <DemoAccountSignIn callbackURL={callbackURL} />

      {!hasSocialProviders && (
        <p className="text-center text-xs text-muted-foreground">
          Social sign-in is not configured for this deployment.
        </p>
      )}
    </div>
  )
}

export default LoginForm
