/**
 * @fileoverview Flow-in-Speech Flow Annotations panel — the "(a) a
 * video-player UI (`debate-videos`) that lets a viewer drop an annotation at
 * the current playback position, persisted through `flowAnnotations.ts`,
 * and jump back to one" follow-up named under idea #15 ("Flow-in-Speech Flow
 * Annotations") in TODO.md.
 *
 * Reads the currently loaded recording from `debate-videos`'s
 * `useVideoPlayerStore` (the same persistent player mounted at the app
 * root) so a viewer can drop an annotation at the live playback position
 * with one click, or type a manual `m:ss` timestamp when nothing is
 * playing. Annotations dropped against the live position also record which
 * video they belong to (`FlowAnnotation.videoId`), so "Jump to" (via the
 * shared `jumpToAnnotation` helper) either seeks that exact recording in
 * place, or switches the persistent player to it first via
 * `useVideoPlayerStore.setActiveVideo` when a different recording is
 * currently loaded. No new annotation-model or persistence logic is
 * introduced — this composes the
 * already-existing `flow/flow-annotations.ts` + `state/flowAnnotations.ts`
 * with the already-existing video player.
 *
 * Also subscribes to the browser's `storage` event via `flow/live-update.ts`'s
 * `isFlowAnnotationsPanelLiveUpdateStorageEvent`, so an annotation dropped or
 * cleared in another browser tab refreshes this panel's rendered list here
 * too — the `storage` event never fires in the tab that made the write, only
 * in other tabs. This is distinct from `FlowSpreadsheet`'s own
 * `isFlowLiveUpdateStorageEvent`-driven grid badge refresh, which only
 * force-refreshes AG Grid cells, not this standalone list view.
 *
 * @module panels/FlowAnnotationsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import { Textarea } from "debate-ui/src/primitives/textarea"
import { sendYouTubeCommand, useVideoPlayerStore } from "debate-videos"
import {
  createFlowAnnotation,
  formatAnnotationTimestamp,
  jumpToAnnotation,
  parseAnnotationTimestamp,
  parseBoxPathInput,
} from "../flow/flow-annotations"
import { isFlowAnnotationsPanelLiveUpdateStorageEvent } from "../flow/live-update"
import {
  buildFlowAnnotationsPanelView,
  deleteFlowAnnotation,
  saveFlowAnnotation,
} from "../state/flowAnnotations"
import type { FlowAnnotation } from "../flow/flow-annotations"

function newAnnotationId(): string {
  return `anno-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Renders the Flow Annotations panel: a form to drop a new annotation
 * (against the live video position or a manual timestamp) and every
 * persisted annotation, newest first, each with a "Jump to" action (enabled
 * whenever it has a recording attached — switching the player to that
 * recording first if a different one is currently loaded) and a "Clear"
 * action.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function FlowAnnotationsPanel() {
  const {
    activeVideoId,
    activeVideoTitle,
    isPlaying,
    getCurrentTimeRef,
    setIsPlaying,
    setActiveVideo,
  } = useVideoPlayerStore()

  const [annotations, setAnnotations] = useState<FlowAnnotation[] | null>(null)
  const [liveSeconds, setLiveSeconds] = useState(0)
  const [flowId, setFlowId] = useState("")
  const [speechId, setSpeechId] = useState("")
  const [boxPathInput, setBoxPathInput] = useState("")
  const [note, setNote] = useState("")
  const [useLivePosition, setUseLivePosition] = useState(true)
  const [manualTimestamp, setManualTimestamp] = useState("0:00")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setAnnotations(buildFlowAnnotationsPanelView())
  }, [])

  useEffect(() => {
    if (!activeVideoId || !isPlaying) return
    const interval = setInterval(() => {
      setLiveSeconds(getCurrentTimeRef ? getCurrentTimeRef() : 0)
    }, 250)
    return () => clearInterval(interval)
  }, [activeVideoId, isPlaying, getCurrentTimeRef])

  const refresh = () => setAnnotations(buildFlowAnnotationsPanelView())

  /**
   * Live-update the rendered annotation list when another browser tab drops
   * or clears an annotation.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isFlowAnnotationsPanelLiveUpdateStorageEvent(event)) return
      refresh()
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const handleAdd = () => {
    const trimmedFlowId = flowId.trim()
    const parsedFlowId = Number(trimmedFlowId)
    if (!trimmedFlowId || !Number.isFinite(parsedFlowId) || !Number.isInteger(parsedFlowId)) {
      setError("Flow ID must be a whole number.")
      return
    }
    if (!speechId.trim()) {
      setError("Speech ID is required (e.g. \"1AC\").")
      return
    }
    const boxPath = parseBoxPathInput(boxPathInput)
    if (boxPath === null) {
      setError("Box path must be comma-separated whole numbers (e.g. \"0, 1\").")
      return
    }

    const useLive = useLivePosition && Boolean(activeVideoId)
    const timestampMs = useLive
      ? Math.round((getCurrentTimeRef ? getCurrentTimeRef() : 0) * 1000)
      : parseAnnotationTimestamp(manualTimestamp)
    if (timestampMs === null) {
      setError("Timestamp must be a valid m:ss (or h:mm:ss) position.")
      return
    }

    try {
      const annotation = createFlowAnnotation({
        id: newAnnotationId(),
        flowId: parsedFlowId,
        boxPath,
        speechId: speechId.trim(),
        timestampMs,
        createdAt: Date.now(),
        note,
        videoId: useLive ? (activeVideoId ?? undefined) : undefined,
        videoTitle: useLive ? (activeVideoTitle ?? undefined) : undefined,
      })
      saveFlowAnnotation(annotation)
      setNote("")
      setError(null)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create annotation.")
    }
  }

  const handleJump = (annotation: FlowAnnotation) => {
    jumpToAnnotation(annotation, {
      activeVideoId,
      setActiveVideo,
      seekTo: (timestampMs) => sendYouTubeCommand("seekTo", [timestampMs / 1000, true]),
      playVideo: () => sendYouTubeCommand("playVideo"),
      setIsPlaying,
    })
  }

  const handleClear = (id: string) => {
    deleteFlowAnnotation(id)
    refresh()
  }

  if (annotations === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading flow annotations…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Flow-in-Speech Annotations</h1>
        <p className="text-sm text-muted-foreground">
          While watching a streamed or recorded round, drop a timestamped note tied to a specific
          flow argument, then jump straight back to it later.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <p className="text-sm text-foreground">
          {activeVideoId ? (
            <>
              Now playing: <span className="font-medium">{activeVideoTitle ?? activeVideoId}</span>{" "}
              <Badge variant="outline">{formatAnnotationTimestamp(liveSeconds * 1000)}</Badge>
            </>
          ) : (
            <span className="text-muted-foreground">No video is currently playing.</span>
          )}
        </p>

        <div className="flex flex-wrap gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="annotation-flow-id">Flow ID</Label>
            <Input
              id="annotation-flow-id"
              value={flowId}
              onChange={(e) => setFlowId(e.target.value)}
              placeholder="1"
              className="w-28"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="annotation-speech-id">Speech</Label>
            <Input
              id="annotation-speech-id"
              value={speechId}
              onChange={(e) => setSpeechId(e.target.value)}
              placeholder="1AC"
              className="w-28"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="annotation-box-path">Box path</Label>
            <Input
              id="annotation-box-path"
              value={boxPathInput}
              onChange={(e) => setBoxPathInput(e.target.value)}
              placeholder="0, 1"
              className="w-32"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="annotation-timestamp-mode">Timestamp</Label>
            <div className="flex items-center gap-2">
              <Button
                id="annotation-timestamp-mode"
                type="button"
                size="sm"
                variant={useLivePosition ? "default" : "outline"}
                onClick={() => setUseLivePosition(true)}
                disabled={!activeVideoId}
              >
                Current position
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!useLivePosition ? "default" : "outline"}
                onClick={() => setUseLivePosition(false)}
              >
                Manual
              </Button>
            </div>
          </div>
          {!useLivePosition && (
            <div className="space-y-1.5">
              <Label htmlFor="annotation-manual-timestamp">m:ss</Label>
              <Input
                id="annotation-manual-timestamp"
                value={manualTimestamp}
                onChange={(e) => setManualTimestamp(e.target.value)}
                placeholder="1:30"
                className="w-24"
              />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="annotation-note">Note (optional)</Label>
          <Textarea
            id="annotation-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Solvency claim starts here…"
            className="min-h-16"
          />
        </div>

        <Button onClick={handleAdd}>Drop annotation</Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {annotations.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No flow annotations yet. Drop one above while watching a round to see it here.
        </div>
      ) : (
        <div className="space-y-2">
          {annotations.map((annotation) => {
            const canJump = Boolean(annotation.videoId)
            return (
              <div
                key={annotation.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{formatAnnotationTimestamp(annotation.timestampMs)}</Badge>
                    <span>Flow {annotation.flowId}</span>
                    <span>{annotation.speechId}</span>
                    <span>box [{annotation.boxPath.join(", ")}]</span>
                  </div>
                  {annotation.note && <p className="text-sm text-foreground">{annotation.note}</p>}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleJump(annotation)}
                    disabled={!canJump}
                    title={
                      canJump
                        ? annotation.videoId === activeVideoId
                          ? undefined
                          : "Switch to this annotation's recording and jump to it"
                        : "This annotation has no recording attached"
                    }
                  >
                    Jump to
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleClear(annotation.id)}>
                    Clear
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
