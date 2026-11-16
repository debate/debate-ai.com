"use client"

/**
 * The signed-in reader's username — the `alexgul` in `/alexgul/aff/k-aff-answers`
 * (`lib/reason-docs/personal-doc-paths`) — or `null` when signed out or not
 * known yet.
 *
 * Asked of `/api/users/handle` once per page load (the server assigns the
 * handle on first ask, numbered when the name is taken), and remembered in
 * localStorage so a reload names the file at its personal address straight
 * away instead of flashing `?doc=` first. Until it arrives, links keep the
 * `?doc=` form, which still opens the file.
 */

import { useEffect, useState } from "react"
import { isUsername } from "../lib/reason-docs/personal-doc-paths"

const STORAGE_KEY = "debate-ai:personal-username"

let request: Promise<string | null> | null = null

function readCached(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isUsername(value) ? value : null
  } catch {
    return null
  }
}

function writeCached(value: string | null): void {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage blocked: the username still holds for this page load.
  }
}

function fetchUsername(): Promise<string | null> {
  request ??= fetch("/api/users/handle", { credentials: "same-origin" })
    .then((res) => (res.ok ? (res.json() as Promise<{ handle?: unknown }>) : null))
    .then((body) => {
      const handle = typeof body?.handle === "string" && isUsername(body.handle) ? body.handle : null
      writeCached(handle)
      return handle
    })
    .catch(() => {
      // Offline or the route failed: keep whatever was remembered, and let a
      // later mount try again.
      request = null
      return readCached()
    })
  return request
}

export function usePersonalUsername(): string | null {
  const [username, setUsername] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    const cached = readCached()
    if (cached) setUsername(cached)
    void fetchUsername().then((value) => {
      if (live) setUsername(value)
    })
    return () => {
      live = false
    }
  }, [])
  return username
}
