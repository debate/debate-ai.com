"use client"

import { useEffect, useState } from "react"

/**
 * The total number of accounts, as the admin Users page's "Users" tile shows
 * it (`COUNT(*)` over the `user` table). It comes from the existing
 * `/api/admin/overview` stats endpoint rather than a new route.
 *
 * Shared by the user menu's Admin row and the admin left nav, so opening the
 * menu and then the admin page costs one request: the answer is kept for
 * {@link USER_COUNT_TTL_MS} and concurrent callers share one in-flight fetch.
 */
export const USER_COUNT_TTL_MS = 60_000

let cached: { value: number; at: number } | null = null
let inflight: Promise<number | null> | null = null

async function fetchUserCount(): Promise<number | null> {
  try {
    const res = await fetch("/api/admin/overview", { credentials: "include" })
    if (!res.ok) return null
    const body = (await res.json()) as { stats?: { users?: unknown } } | null
    const users = body?.stats?.users
    if (typeof users !== "number" || !Number.isFinite(users) || users < 0) return null
    cached = { value: users, at: Date.now() }
    return users
  } catch {
    return null
  }
}

function loadUserCount(): Promise<number | null> {
  if (cached && Date.now() - cached.at < USER_COUNT_TTL_MS) return Promise.resolve(cached.value)
  inflight ??= fetchUserCount().finally(() => {
    inflight = null
  })
  return inflight
}

/** Clears the shared cache; for tests, and for after the user count changes. */
export function resetAdminUserCountCache() {
  cached = null
  inflight = null
}

/**
 * The user count, or `null` until it loads, when `enabled` is false (not an
 * admin), or when the request fails — callers render no badge in all three.
 */
export function useAdminUserCount(enabled: boolean): number | null {
  const [count, setCount] = useState<number | null>(() =>
    enabled && cached && Date.now() - cached.at < USER_COUNT_TTL_MS ? cached.value : null,
  )

  useEffect(() => {
    if (!enabled) {
      setCount(null)
      return
    }
    let cancelled = false
    loadUserCount().then((value) => {
      if (!cancelled) setCount(value)
    })
    return () => {
      cancelled = true
    }
  }, [enabled])

  return enabled ? count : null
}
