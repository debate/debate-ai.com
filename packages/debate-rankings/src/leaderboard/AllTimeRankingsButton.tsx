/**
 * @fileoverview "All time" button beside the season picker on the rankings
 * page. It opens the same greatest-of-all-time modal the school pages use:
 * for college (NDT) the all-seasons NDT points ranking
 * ({@link NdtAllSeasonsRankings}), for the high school events the top 100
 * high school teams per event ({@link HsAllTimeTeamsRankings}), opened on the
 * event whose rankings are showing. No school is highlighted.
 * @module leaderboard/AllTimeRankingsButton
 */

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Trophy } from "lucide-react"
import { Button } from "./ui/primitives/button"
import type { Division } from "./leaderboardTypes"
import { NdtAllSeasonsRankings } from "./profile/NdtAllSeasonsDialog"
import { HsAllTimeTeamsRankings } from "./profile/ProfileHsAllTimeTeams"
import { hsAllTimeTeams, loadHsAllTimeTeams, type HsAllTimeEvent, type HsAllTimeTeam } from "./profile/hsAllTimeTeams"
import { useNdtHistory } from "./profile/ndtHistory"

/** The high school all-time event each high school division opens on. */
const HS_EVENT: Record<Exclude<Division, "NDT">, HsAllTimeEvent> = {
  VCX: "Policy",
  VLD: "Lincoln-Douglas",
  VPF: "Public Forum",
}

const TITLE_ID = "rankings-all-time-title"

function CollegeAllTime({ onClose }: { onClose: () => void }) {
  const history = useNdtHistory()
  if (!history) {
    return (
      <p id={TITLE_ID} className="px-4 py-6 text-center text-sm text-muted-foreground">
        Loading all-seasons NDT points...
      </p>
    )
  }
  return <NdtAllSeasonsRankings history={history} titleId={TITLE_ID} onClose={onClose} className="max-h-[85vh]" />
}

function HighSchoolAllTime({ event, onClose }: { event: HsAllTimeEvent; onClose: () => void }) {
  const bundled = useMemo(() => hsAllTimeTeams(), [])
  const [withCollege, setWithCollege] = useState<Record<HsAllTimeEvent, HsAllTimeTeam[]> | null>(null)
  useEffect(() => {
    let live = true
    loadHsAllTimeTeams()
      .then((loaded) => live && setWithCollege(loaded))
      .catch(() => {
        // The lists stay on national finishes alone.
      })
    return () => {
      live = false
    }
  }, [])
  return (
    <HsAllTimeTeamsRankings
      lists={withCollege ?? bundled}
      schoolKey={null}
      collegeLoaded={withCollege !== null}
      initialEvent={event}
      titleId={TITLE_ID}
      onClose={onClose}
    />
  )
}

/** @param props.division - The rankings division showing; picks the college or high school list. */
export function AllTimeRankingsButton({ division }: { division: Division }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal()
      else dialog.setAttribute("open", "")
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close()
      else dialog.removeAttribute("open")
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title={division === "NDT" ? "Greatest college teams of all time" : "Greatest high school teams of all time"}
      >
        <Trophy className="text-amber-500" aria-hidden />
        All time
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={TITLE_ID}
        onClose={close}
        onClick={(event) => event.target === event.currentTarget && close()}
        className="m-auto w-[min(48rem,calc(100vw-2rem))] max-h-[85vh] overflow-hidden rounded-lg border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50"
      >
        {open &&
          (division === "NDT" ? (
            <CollegeAllTime onClose={close} />
          ) : (
            <HighSchoolAllTime key={division} event={HS_EVENT[division]} onClose={close} />
          ))}
      </dialog>
    </>
  )
}
