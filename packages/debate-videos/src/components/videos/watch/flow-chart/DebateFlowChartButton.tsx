/**
 * @fileoverview The graph-icon button beside the watch page's Edit button
 * that opens the round's flow chart (`DebateFlowChartDialog`).
 *
 * The modal — and D3 with it — is loaded only when the button is first
 * pressed, so a viewer who never opens it downloads none of it.
 * @module components/watch/flow-chart/DebateFlowChartButton
 */

"use client"

import { lazy, Suspense, useState } from "react"
import { Network } from "lucide-react"
import { Button } from "../../../../ui/primitives/button"
import type { RoundSpeech } from "../../../../lib/round-speeches"
import type { RoundContext } from "../../../../lib/speech-outcomes"

const DebateFlowChartDialog = lazy(() => import("./DebateFlowChartDialog"))

export interface DebateFlowChartButtonProps {
  videoId: string
  videoTitle?: string
  speeches: RoundSpeech[]
  round?: RoundContext
}

export function DebateFlowChartButton(props: DebateFlowChartButtonProps) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-8"
        onClick={() => {
          setLoaded(true)
          setOpen(true)
        }}
        title="Flow chart: a mind map of the whole round's arguments"
        aria-label="Open the debate flow chart"
      >
        <Network />
      </Button>
      {loaded && (
        <Suspense fallback={null}>
          <DebateFlowChartDialog open={open} onOpenChange={setOpen} {...props} />
        </Suspense>
      )}
    </>
  )
}
