/**
 * @fileoverview Global topbar hosting the speech view/layout controls that
 * used to live inside each per-speech {@link SpeechHeaderBar} — quote view,
 * markdown view mode, single/split layout, the recording ellipsis menu, and
 * the "open speech document" button. Rendered once at the top of the page
 * instead of being duplicated across every speech's own header bar.
 * @module layout/SpeechControlsTopBar
 */

"use client"

import { FileText, Quote, Columns2 } from "lucide-react"
import type { ViewMode } from "../types/debate-flow"
import { ViewModeSelector } from "../controls/ViewModeSelector"
import { Button } from "../ui/primitives/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/primitives/tooltip"
import { SpeechRecordingMenu } from "debate-timer/src/recorder/SpeechRecordingPlayer"

export interface SpeechControlsTopBarProps {
  /** The speech these controls apply to, e.g. "1AR". */
  speechName: string
  /** Active view mode applied to the markdown editor. */
  viewMode: ViewMode
  /** Whether the quote view overlay is currently active. */
  quoteView: boolean
  /** Handler called when the user selects a different view mode. */
  onViewModeChange: (mode: ViewMode) => void
  /** Handler called when the quote view toggle button is clicked. */
  onQuoteViewToggle: () => void
  /** Current layout mode: a single active speech pane, or both shown side-by-side. */
  layoutMode: "single" | "split"
  /** Handler called when the layout toggle button is clicked. */
  onToggleLayoutMode: () => void
  /** Handler called when the "open speech document" button is clicked. */
  onOpenSpeechPanel: (speech: string) => void
  /** Selected microphone device ID. */
  micDeviceId?: string
  /** Callback when the microphone device changes. */
  onMicDeviceChange: (deviceId: string) => void
  /** Whether recording is enabled. */
  recordingEnabled: boolean
  /** Callback when the recording-enabled flag changes. */
  onRecordingEnabledChange: (enabled: boolean) => void
  /** Callback to reset the speech timer to its default. */
  onResetSpeechTime: () => void
  /** Callback to switch the speech timer to Cross-X (3 min). */
  onSwitchToCrossX: () => void
  /** Callback to reset prep timers to their defaults. */
  onResetPrepTimers?: () => void
  /** Whether a saved recording exists for this speech. */
  hasRecording: boolean
  /** Callback to delete the saved recording. */
  onDeleteRecording: (key: string) => void
  /** localStorage key for the saved recording, when one exists. */
  recordingKey?: string
}

/**
 * Persistent topbar for speech view/layout/recording controls, spanning the
 * full width of the page above the sidebar and main content area.
 */
export function SpeechControlsTopBar({
  speechName,
  viewMode,
  quoteView,
  onViewModeChange,
  onQuoteViewToggle,
  layoutMode,
  onToggleLayoutMode,
  onOpenSpeechPanel,
  micDeviceId,
  onMicDeviceChange,
  recordingEnabled,
  onRecordingEnabledChange,
  onResetSpeechTime,
  onSwitchToCrossX,
  onResetPrepTimers,
  hasRecording,
  onDeleteRecording,
  recordingKey,
}: SpeechControlsTopBarProps) {
  return (
    <div className="flex items-center justify-end gap-1 w-full h-9 px-2 border-b border-border bg-[var(--background)] shrink-0">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={quoteView ? "default" : "ghost"}
              size="icon"
              onClick={onQuoteViewToggle}
              className="h-7 w-7"
            >
              <Quote className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{quoteView ? "Disable Quote View" : "Enable Quote View"}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <ViewModeSelector value={viewMode} onChange={onViewModeChange} size="sm" />

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={layoutMode === "split" ? "default" : "ghost"}
              size="icon"
              onClick={onToggleLayoutMode}
              className="h-7 w-7"
            >
              <Columns2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {layoutMode === "split" ? "Show one speech at a time" : "Show both speeches side by side"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <SpeechRecordingMenu
        speechName={speechName}
        speechLabel={speechName}
        micDeviceId={micDeviceId}
        onMicDeviceChange={onMicDeviceChange}
        recordingEnabled={recordingEnabled}
        onRecordingEnabledChange={onRecordingEnabledChange}
        onResetSpeechTime={onResetSpeechTime}
        onSwitchToCrossX={onSwitchToCrossX}
        onResetPrepTimers={onResetPrepTimers}
        onDeleteRecording={hasRecording ? onDeleteRecording : undefined}
        recordingKey={recordingKey}
        inHeader={true}
      />

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => onOpenSpeechPanel(speechName)}
        title={`Open ${speechName} speech document`}
      >
        <FileText className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  )
}
