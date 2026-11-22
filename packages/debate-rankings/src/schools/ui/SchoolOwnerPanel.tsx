"use client"

/**
 * @fileoverview School owner panel: the claim link for visitors, and for the
 * school's owners and staff the city and state shown under its name.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { fetchSchoolPage, setSchoolLocation, type SchoolPageData } from "../school-claims"
import { MAX_SCHOOL_CITY_LENGTH, US_STATE_NAMES } from "../school-location"

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
  if (data.canManage) return <SchoolLocationEditor slug={slug} data={data} onData={onData} />
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

/** City and state fields for the school's owners and staff. */
function SchoolLocationEditor({
  slug,
  data,
  onData,
}: {
  slug: string
  data: SchoolPageData
  onData: (data: SchoolPageData) => void
}) {
  const [city, setCity] = useState(data.city ?? "")
  const [state, setState] = useState(data.state ?? "")
  const [status, setStatus] = useState<string | null>(null)
  const dirty = city.trim() !== (data.city ?? "") || state !== (data.state ?? "")
  const save = async () => {
    setStatus("Saving…")
    try {
      onData(await setSchoolLocation(slug, { city: city.trim() || null, state: state || null }))
      setStatus("Saved")
    } catch (error) {
      setStatus((error as Error).message)
    }
  }
  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2 text-sm"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <span className="text-muted-foreground">Location</span>
      <input
        aria-label="City"
        placeholder="City"
        maxLength={MAX_SCHOOL_CITY_LENGTH}
        className="h-8 w-40 rounded-md border bg-background px-2"
        value={city}
        onChange={(event) => setCity(event.target.value)}
      />
      <select
        aria-label="State"
        className="h-8 rounded-md border bg-background px-2"
        value={state}
        onChange={(event) => setState(event.target.value)}
      >
        <option value="">State</option>
        {Object.entries(US_STATE_NAMES).map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={!dirty} className="h-8 rounded-md border px-3 disabled:opacity-50">
        Save
      </button>
      {status && <span className="text-xs text-muted-foreground">{status}</span>}
    </form>
  )
}
