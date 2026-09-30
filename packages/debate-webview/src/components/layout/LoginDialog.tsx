"use client"

/**
 * @fileoverview Sign-in dialog opened from the settings menu.
 *
 * Same controls as `/login`, without losing the page the user is on — a debater
 * mid-round should not be navigated away from a flow to sign in.
 */

import { lazy, Suspense, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../lib/ui/primitives/dialog"
import { Button } from "../../lib/ui/primitives/button"
import { useSession } from "../../lib/hooks/useSession"
import { APP_LOGO, APP_LOGO_HEIGHT, APP_LOGO_WIDTH, APP_NAME } from "../../lib/config/site"

// The dock and the guest sign-in prompt mount this dialog on every page, but
// the form (auth providers, brand icons) is only needed once it opens.
const LoginForm = lazy(() => import("./LoginForm").then((m) => ({ default: m.LoginForm })))

export interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Replaces the default title. A prompt raised by a tool names what the user
   * was saving ("Sign in to save your video favorites"), which reads as an
   * answer to the click they just made rather than as a generic gate.
   */
  title?: string
  /** Replaces the default description with why signing in is worth it here. */
  description?: string
  /** Where to return after signing in. Defaults to the current page. */
  returnTo?: string
  /**
   * An optional secondary action below the form — the guest sign-in prompt's
   * "Don't ask me again" (see `SignInPromptProvider`). Absent from the
   * settings-menu sign-in, where there is nothing to decline.
   */
  secondaryAction?: { label: string; onClick: () => void }
}

export function LoginDialog({
  open,
  onOpenChange,
  title,
  description,
  returnTo,
  secondaryAction,
}: LoginDialogProps) {
  const { isAuthenticated } = useSession()
  const pathname = usePathname()

  // A One Tap prompt or a magic link opened in another tab can land the session
  // while this is open; leaving a sign-in form over an authenticated app is
  // just stale UI.
  useEffect(() => {
    if (open && isAuthenticated) onOpenChange(false)
  }, [open, isAuthenticated, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={APP_LOGO}
            alt={APP_NAME}
            width={APP_LOGO_WIDTH}
            height={APP_LOGO_HEIGHT}
            className="mx-auto mb-2 h-auto w-full max-w-[200px]"
          />
          <DialogTitle>{title ?? `Sign in to ${APP_NAME}`}</DialogTitle>
          <DialogDescription>
            {description ?? "Save your rounds, flows and research across devices."}
          </DialogDescription>
        </DialogHeader>
        {/* Returning to the current page keeps the sign-in from doubling as
            navigation the user did not ask for. */}
        <Suspense
          fallback={
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <LoginForm callbackURL={returnTo || pathname || "/"} />
        </Suspense>
        {secondaryAction && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="mx-auto h-auto p-0 text-muted-foreground"
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.label}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default LoginDialog
