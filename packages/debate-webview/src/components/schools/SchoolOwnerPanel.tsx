"use client"

/**
 * @fileoverview Simplified school owner panel showing only claim link.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { fetchSchoolPage, type SchoolPageData } from "../../lib/schools/school-claims"

/**
 * Loads a school page's owner-managed data. The page loads it rather than the
 * panel, because a created school with no rankings needs its name before the
 * profile decides whether there is a page to show at all.
 */
export function useSchoolPageData(slug: string) {
  const [data, setData] = useState<SchoolPageData | null>(null)
  useEffect(() => {
    let cancelled = false
    setData(null)
    fetchSchoolPage(slug)
      .then((loaded) => {
        if (!cancelled) setData(loaded)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [slug])
  return [data, setData] as const
}

/**
 * @param props.slug - The school's `@handle`.
 * @param props.data - The page data, from {@link useSchoolPageData}.
 * @param props.onData - Takes the page data each edit answers with.
 */
export function SchoolOwnerPanel({
  slug,
  data,
  onData,
}: {
  slug: string
  data: SchoolPageData | null
  onData: (data: SchoolPageData) => void
}) {
  if (!data) return null
  const empty = !data.logo && data.owners.length === 0 && data.members.length === 0
  if (empty && !data.canManage) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        Coach here?{" "}
        <Link href="/settings?category=my-school" className="underline underline-offset-4">
          Claim this school
        </Link>
        .
      </p>
    )
  }

  return null
}
