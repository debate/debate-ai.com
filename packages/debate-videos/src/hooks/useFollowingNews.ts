/**
 * @fileoverview The news feed's "Following" items: for every team and school
 * the viewer follows, its latest rounds, latest caselist research, tournament
 * results and monthly recaps (see `lib/follows/follow-feed.ts`).
 *
 * Loads the viewer's follows from `/api/follows`, resolves each to its
 * rankings rows (for the search phrases, divisions and ratings), then fetches
 * its rounds from `/api/videos` and its documents from
 * `/api/caselist-documents`, a few follows at a time. A follow whose rankings
 * row has gone (a new season's CSV) still searches by its saved name.
 * @module hooks/useFollowingNews
 */

"use client"

import { useEffect, useState } from "react"
import { schoolSearchNames, type RankingDataset } from "@debate/rankings-adapter"
import { useAllRankingDatasets } from "./useAllRankingDatasets"
import {
  findSchoolEntries,
  findTeamEntries,
  schoolVideoSearch,
  summarizeSchool,
  teamVideoSearch,
} from "../panels/leaderboard/profile/rankingProfileHelpers"
import { fetchMyFollows, type ProfileFollow } from "../lib/follows/profile-follows"
import { buildFollowNews, type FollowNewsItem, type FollowResearchDoc } from "../lib/follows/follow-feed"
import type { VideoFeedResponse } from "../types/videos"

/** Rounds fetched per follow: enough for three months of recaps. */
const ROUNDS_FETCHED = 60
/** Follows fetched at once. */
const CONCURRENCY = 4

/** Return value of {@link useFollowingNews}. */
export interface FollowingNews {
  items: FollowNewsItem[]
  follows: ProfileFollow[]
  loading: boolean
  signedIn: boolean
}

/** Where to look for one follow's rounds and research. */
interface FollowLookup {
  competitors: string[]
  styles: number[]
  docSchool: string
  docTeam: string | null
}

function lookupFor(follow: ProfileFollow, datasets: RankingDataset[]): FollowLookup {
  if (follow.kind === "team") {
    const entries = findTeamEntries(datasets, follow.slug)
    const first = entries[0]?.entry
    if (first) {
      const search = teamVideoSearch(entries)
      return { competitors: search.competitors, styles: search.styles, docSchool: first.school, docTeam: first.name }
    }
    return { competitors: [follow.name], styles: [], docSchool: follow.name, docTeam: null }
  }
  const entries = findSchoolEntries(datasets, follow.slug)
  if (entries.length > 0) {
    const school = summarizeSchool(entries).school
    const search = schoolVideoSearch(school, entries)
    return { competitors: search.competitors, styles: search.styles, docSchool: school, docTeam: null }
  }
  return { competitors: schoolSearchNames(follow.name), styles: [], docSchool: follow.name, docTeam: null }
}

async function fetchRounds(lookup: FollowLookup, signal: AbortSignal): Promise<VideoFeedResponse["videos"]> {
  if (lookup.competitors.length === 0) return []
  const params = new URLSearchParams({
    source: "round",
    competitors: lookup.competitors.join("|"),
    sort: "Recency",
    limit: String(ROUNDS_FETCHED),
  })
  if (lookup.styles.length > 0) params.set("styles", lookup.styles.join(","))
  const response = await fetch(`/api/videos?${params}`, { signal })
  if (!response.ok) return []
  const data = (await response.json()) as VideoFeedResponse
  return data.videos ?? []
}

async function fetchDocs(lookup: FollowLookup, signal: AbortSignal): Promise<FollowResearchDoc[]> {
  const params = new URLSearchParams({ school: lookup.docSchool, limit: "3" })
  if (lookup.docTeam) params.set("team", lookup.docTeam)
  const response = await fetch(`/api/caselist-documents?${params}`, { signal })
  if (!response.ok) return []
  const data = (await response.json()) as { documents?: FollowResearchDoc[] }
  return data.documents ?? []
}

/**
 * Builds the viewer's "Following" news items. Signed out, or following
 * nothing, it settles on an empty list.
 */
export function useFollowingNews(): FollowingNews {
  const [follows, setFollows] = useState<ProfileFollow[] | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [items, setItems] = useState<FollowNewsItem[]>([])
  const [building, setBuilding] = useState(false)
  const rankings = useAllRankingDatasets((follows?.length ?? 0) > 0)

  useEffect(() => {
    let cancelled = false
    fetchMyFollows()
      .then((res) => {
        if (cancelled) return
        setFollows(res.follows)
        setSignedIn(res.signedIn)
      })
      .catch(() => {
        if (!cancelled) setFollows([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!follows || follows.length === 0 || rankings.loading) return
    // The rankings load starts a render after the follows arrive; wait for it
    // (or its failure, which falls back to searching by saved names).
    if (rankings.datasets.length === 0 && !rankings.error) return
    const controller = new AbortController()
    const datasets = rankings.datasets
    setBuilding(true)

    const run = async () => {
      const out: FollowNewsItem[] = []
      const queue = [...follows]
      const worker = async () => {
        for (let follow = queue.shift(); follow; follow = queue.shift()) {
          const lookup = lookupFor(follow, datasets)
          const [rounds, docs] = await Promise.all([
            fetchRounds(lookup, controller.signal).catch(() => []),
            fetchDocs(lookup, controller.signal).catch(() => []),
          ])
          out.push(
            ...buildFollowNews({
              follow,
              competitors: lookup.competitors,
              rounds,
              docs,
              datasets,
              now: Date.now(),
            }),
          )
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker))
      // A round or document can belong to a followed team and its followed
      // school both; it posts once.
      const seen = new Set<string>()
      return out.filter((item) => !seen.has(item.id) && Boolean(seen.add(item.id)))
    }

    run()
      .then((built) => {
        if (!controller.signal.aborted) setItems(built)
      })
      .finally(() => {
        if (!controller.signal.aborted) setBuilding(false)
      })
    return () => controller.abort()
  }, [follows, rankings.loading, rankings.datasets, rankings.error])

  return {
    items,
    follows: follows ?? [],
    loading: follows === null || building || ((follows?.length ?? 0) > 0 && rankings.datasets.length === 0 && !rankings.error),
    signedIn,
  }
}
