"use client"

import { useEffect, useState } from "react"

import { AdminDashboard } from "../../components/admin/AdminDashboard"
import { useSession } from "../../lib/hooks/useSession"

interface StaffAccess {
  isAdmin: boolean
  canEditContent: boolean
}

/**
 * `/admin` outside Next. The web app decides access on the server
 * (`app/admin/page.tsx` → `getStaffAccess()`); here the same answer comes from
 * `/api/admin/me`, which reads the same session. Every admin API checks the
 * role again itself, so this only decides what to draw.
 */
export default function AdminRoute() {
  const { user, isLoading } = useSession()
  const [access, setAccess] = useState<StaffAccess | null>(null)

  useEffect(() => {
    if (isLoading) return
    let cancelled = false
    fetch("/api/admin/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { isAdmin: false, canEditContent: false }))
      .then((body: StaffAccess) => !cancelled && setAccess(body))
      .catch(() => !cancelled && setAccess({ isAdmin: false, canEditContent: false }))
    return () => {
      cancelled = true
    }
  }, [isLoading, user?.id])

  if (!access) return null
  if (!access.canEditContent) {
    return (
      <main className="mx-auto flex max-w-lg flex-col items-center gap-2 px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-muted-foreground">
          {user?.email
            ? `${user.email} is not authorized to view this page.`
            : "Sign in with an authorized account to view this page."}
        </p>
      </main>
    )
  }
  return <AdminDashboard isAdmin={access.isAdmin} />
}
