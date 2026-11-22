/**
 * @fileoverview Follow button in a team or school profile header. Following
 * adds the profile's rounds, research, tournament results and monthly recaps
 * to the viewer's news feed (`/news`). Signed out, the button links to sign
 * in. Follower counts are deliberately not shown on any page.
 * @module leaderboard/profile/FollowButton
 */

"use client"

import { useEffect, useState } from "react"
import { Check, UserPlus } from "lucide-react"
import { Button } from "../ui/primitives/button"
import {
  fetchFollowState,
  setProfileFollow,
  type FollowKind,
  type FollowState,
} from "../follows/profile-follows"

/** Props for {@link FollowButton}. */
export interface FollowButtonProps {
  kind: FollowKind
  /** The profile's URL segment. */
  slug: string
  /** Display name stored with the follow, e.g. the team's school and name. */
  name: string
}

/** Follow / Following toggle (no follower count is shown). */
export function FollowButton({ kind, slug, name }: FollowButtonProps) {
  const [state, setState] = useState<FollowState | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    fetchFollowState(kind, slug)
      .then((next) => {
        if (!cancelled) setState(next)
      })
      .catch(() => {
        if (!cancelled) setState(null)
      })
    return () => {
      cancelled = true
    }
  }, [kind, slug])

  const toggle = async () => {
    if (!state) return
    setPending(true)
    setError(null)
    try {
      setState(await setProfileFollow({ kind, slug, name }, !state.following))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your follow.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      {state && !state.signedIn ? (
        <Button asChild size="sm" variant="outline">
          <a href="/login">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Sign in to follow
          </a>
        </Button>
      ) : (
        <Button
          size="sm"
          variant={state?.following ? "secondary" : "default"}
          disabled={!state || pending}
          onClick={toggle}
          aria-pressed={state?.following ?? false}
        >
          {state?.following ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <UserPlus className="h-4 w-4" aria-hidden="true" />
          )}
          {state?.following ? "Following" : "Follow"}
        </Button>
      )}
      {state?.following && (
        <a href="/news" className="text-sm text-primary underline-offset-4 hover:underline">
          See updates in your news feed
        </a>
      )}
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  )
}
