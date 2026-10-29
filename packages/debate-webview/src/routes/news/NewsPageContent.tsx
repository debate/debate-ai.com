/**
 * @fileoverview Client wrapper around `NewsStreamPanel` — split out of
 * `page.tsx` because `page.tsx` needs to stay a server component to export
 * `metadata`.
 *
 * The News tab shows only new rounds, new files and forum activity:
 * `useSiteNews()` fetches the site-wide newest of each, `useFollowingNews()`
 * from `@debate-ai/videos` adds the rounds, research, results and recaps of
 * every team and school the viewer follows, and the panel itself adds the
 * daily Argument Library digests. A round or file a follow already posted
 * is not posted twice. `useNewsStreamSync` keeps a signed-in user's
 * read/liked state in sync across devices.
 *
 * @module app/news/NewsPageContent
 */

"use client"

import { useMemo } from "react"
import { NewsStreamPanel } from "@debate-ai/community"
import { useFollowingNews } from "@debate-ai/videos"
import { followHref } from "@debate-ai/rankings/src/leaderboard/follows/profile-follows"
import { useNewsStreamSync } from "../../lib/hooks/useNewsStreamSync"
import { useSiteNews } from "../../lib/hooks/useSiteNews"

/** `follow-round-abc` and `round-abc` are the same round; same for research and files. */
const FOLLOWED_TWIN = /^follow-(round|research)-/

export function NewsPageContent() {
  const syncRemote = useNewsStreamSync()
  const following = useFollowingNews()
  const siteNews = useSiteNews()
  const extraItems = useMemo(() => {
    const followed = new Set(
      following.items.map((item) => item.id.replace(FOLLOWED_TWIN, (_, kind) => (kind === "round" ? "round-" : "file-"))),
    )
    return [...siteNews.filter((item) => !followed.has(item.id)), ...following.items]
  }, [siteNews, following.items])
  return (
    <div className="flex flex-col gap-4">
      {following.follows.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Following{" "}
          {following.follows.map((follow, i) => (
            <span key={`${follow.kind}-${follow.slug}`}>
              {i > 0 && ", "}
              <a href={followHref(follow)} className="font-medium text-foreground hover:underline">
                {follow.name}
              </a>
            </span>
          ))}
          {following.loading && " · loading their updates…"}
        </p>
      ) : following.signedIn ? (
        <p className="text-sm text-muted-foreground">
          Follow a team or school from its profile page to see its rounds, research, results and monthly recaps here.
        </p>
      ) : null}
      <NewsStreamPanel extraItems={extraItems} syncRemote={syncRemote} />
    </div>
  )
}
