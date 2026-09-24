"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { initMixpanel, trackPageView, identifyUser } from "@/lib/analytics/mixpanel"
import { useSession } from "@/lib/hooks/useSession"

export function MixpanelProvider() {
  const pathname = usePathname()
  const { user, isAuthenticated } = useSession()

  useEffect(() => {
    initMixpanel()
  }, [])

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      identifyUser(user.id, {
        $name: user.name,
        $email: user.email,
        $avatar: user.image,
      })
    }
  }, [isAuthenticated, user?.id, user?.name, user?.email, user?.image])

  useEffect(() => {
    if (pathname) {
      trackPageView(pathname)
    }
  }, [pathname])

  return null
}
