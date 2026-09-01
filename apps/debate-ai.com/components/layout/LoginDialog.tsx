"use client"

/**
 * @fileoverview Sign-in dialog opened from the settings menu.
 *
 * Same controls as `/login`, without losing the page the user is on — a debater
 * mid-round should not be navigated away from a flow to sign in.
 */

import { useEffect } from "react"
import { usePathname } from "next/navigation"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/debate-ui/primitives/dialog"
import { LoginForm } from "./LoginForm"
import { useSession } from "@/lib/hooks/useSession"
import { APP_NAME } from "@/lib/config/site"

export interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
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
          <DialogTitle>Sign in to {APP_NAME}</DialogTitle>
          <DialogDescription>
            Save your rounds, flows and research across devices.
          </DialogDescription>
        </DialogHeader>
        {/* Returning to the current page keeps the sign-in from doubling as
            navigation the user did not ask for. */}
        <LoginForm callbackURL={pathname || "/"} />
      </DialogContent>
    </Dialog>
  )
}

export default LoginDialog
