"use client"

/**
 * @fileoverview The sign-in controls themselves — social buttons plus the
 * magic-link form — with no page chrome around them.
 *
 * Kept separate from the page so the same controls can be shown full screen at
 * `/login` and inside the settings-menu dialog without the two drifting apart.
 */

import { useState } from "react"
import { Mail } from "lucide-react"
import { SiGoogle, SiDiscord } from "@icons-pack/react-simple-icons"
import { FaLinkedin } from "react-icons/fa"
import { toast } from "sonner"

import { Button } from "@/components/debate-ui/primitives/button"
import { Input } from "@/components/debate-ui/primitives/input"
import { Label } from "@/components/debate-ui/primitives/label"
import { authClient } from "@/lib/auth/client"
import { useAuthProviders } from "@/lib/hooks/useAuthProviders"

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="animate-pulse text-sm text-muted-foreground">Loading…</span>
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

      {!hasSocialProviders && (
        <p className="text-center text-xs text-muted-foreground">
          Social sign-in is not configured for this deployment.
        </p>
      )}
    </div>
  )
}

export default LoginForm
