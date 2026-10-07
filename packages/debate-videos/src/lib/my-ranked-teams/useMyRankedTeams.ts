/**
 * @fileoverview React state for {@link MyRankedTeams}: this browser's copy at
 * once, then the account's when signed in, kept current across tabs and
 * across components on the page.
 * @module lib/my-ranked-teams/useMyRankedTeams
 */

"use client"

import { useCallback, useEffect, useState } from "react"
import {
  EMPTY_MY_RANKED_TEAMS,
  MY_RANKED_TEAMS_EVENT,
  fetchAccountMyRankedTeams,
  getMyRankedTeams,
  saveAccountMyRankedTeams,
  saveMyRankedTeams,
  type MyRankedTeams,
} from "./my-ranked-teams"

/** Return value of {@link useMyRankedTeams}. */
export interface UseMyRankedTeams {
  value: MyRankedTeams
  /** Saves locally at once and to the account in the background; resolves to whether the account save landed. */
  save: (next: MyRankedTeams) => Promise<boolean>
}

/** The viewer's team per division. Starts empty on the server render. */
export function useMyRankedTeams(): UseMyRankedTeams {
  const [value, setValue] = useState<MyRankedTeams>(EMPTY_MY_RANKED_TEAMS)

  useEffect(() => {
    let live = true
    const sync = () => setValue(getMyRankedTeams())
    sync()
    fetchAccountMyRankedTeams().then((remote) => {
      if (!live || !remote) return
      saveMyRankedTeams(remote)
    })
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "myRankedTeams") sync()
    }
    window.addEventListener(MY_RANKED_TEAMS_EVENT, sync)
    window.addEventListener("storage", onStorage)
    return () => {
      live = false
      window.removeEventListener(MY_RANKED_TEAMS_EVENT, sync)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const save = useCallback((next: MyRankedTeams) => {
    saveMyRankedTeams(next)
    return saveAccountMyRankedTeams(next)
  }, [])

  return { value, save }
}
