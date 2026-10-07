"use client"

/**
 * A page that does not exist. Full page loads never get here — the Worker
 * redirects their 404 one segment up (`lib/redirects/not-found.ts`) — so this
 * covers client-side navigations, and does the same thing: replace the
 * address with the page above, so a bad `/tournaments/…` link lands on
 * `/tournaments` instead of a dead end.
 */

import { useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { notFoundFallbackPath } from "@/lib/redirects/not-found"

export default function NotFound() {
  const pathname = usePathname()
  const router = useRouter()
  const fallback = pathname ? notFoundFallbackPath(pathname) : null

  useEffect(() => {
    if (fallback) router.replace(fallback)
  }, [fallback, router])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-xl font-semibold">This page does not exist</h2>
      <Link href={fallback ?? "/"} className="text-sm underline">
        Go back
      </Link>
    </div>
  )
}
