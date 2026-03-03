/**
 * @fileoverview Persistent storage for the user's "My Team" profile.
 *
 * Stores school, primary debater email, and partner email in localStorage
 * so the round editor can prefill team fields with one click.
 */

const STORAGE_KEY = "myTeamProfile"

export interface MyTeamProfile {
  school: string
  email1: string
  email2: string
}

export function getMyTeamProfile(): MyTeamProfile {
  if (typeof window === "undefined") return { school: "", email1: "", email2: "" }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { school: "", email1: "", email2: "" }
    return JSON.parse(raw) as MyTeamProfile
  } catch {
    return { school: "", email1: "", email2: "" }
  }
}

export function saveMyTeamProfile(profile: MyTeamProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}
