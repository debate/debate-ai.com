"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { authClient } from "./client"
import { resetUser } from "../analytics/mixpanel"

/**
 * The app's one sign-out handler: forgets the analytics identity, ends the
 * session, and refreshes the route so server-rendered data drops the account.
 * Shared by the dock's Settings menu and the sidebar's account menu so the
 * two cannot drift — a sign-out that skipped `resetUser` would keep tagging
 * the next visitor's events with the previous account.
 */
export function useSignOut(): () => Promise<void> {
  const router = useRouter()

  return useCallback(async () => {
    try {
      resetUser()
      const { error } = await authClient.signOut()
      if (error) throw new Error(error.message || error.statusText)
      router.refresh()
    } catch (error) {
      console.error("[auth] sign-out failed:", error)
      toast.error("Could not sign out")
    }
  }, [router])
}
