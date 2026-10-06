"use client"

/**
 * @fileoverview Main Debate Flow Page Component (Refactored)
 *
 * This is the primary component for the debate flow interface, now refactored
 * into a clean, modular architecture using custom hooks and layout components.
 */

import { useEffect, useRef, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { EbbFlowEmbed, type EbbFlowToolAction } from "@debate/flow-ebb"
import { useFlowStore } from "../state/store"
import { newFlow } from "../utils/flow-utils"
import { settings } from "../state/settings"
import type { Flow, Round } from "../types/flow"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../ui/primitives/resizable"
import { Sheet, SheetContent } from "../ui/primitives/sheet"

// Modular components
import { FlowPageSidebar } from "../layout/FlowPageSidebar"
import { FlowMainContent } from "../layout/FlowMainContent"
import { SpeechDocPanel } from "../layout/SpeechDocPanel"
import { SpeechControlsTopBar } from "../layout/SpeechControlsTopBar"
import { DebateStartPanel } from "./DebateStartPanel"

// Dialogs
import { FlowHistoryDialog } from "../dialogs/FlowHistoryDialog"
import { RoundEditorDialog } from "../dialogs/CreateRoundDialog"

// Custom hooks
import { useDebateFlowState } from "../hooks/useDebateFlowState"
import {
  useInitialLoad,
  useFontSizeSettings,
  useFlowPersistence,
  useArgumentTreeAutoSync,
} from "../hooks/useFlowEffects"
import { useMobileDetection } from "../hooks/useMobileDetection"
import { useFlowHandlers } from "../hooks/useFlowHandlers"
import { useSpeechHandlers } from "../hooks/useSpeechHandlers"
import { useSplitModeHandlers } from "../hooks/useSplitModeHandlers"
import { useTimerState } from "../hooks/useTimerState"
import { useSpeechRecordingStatus } from "../hooks/useSpeechRecordingStatus"
import { useRoundFromSlug } from "../hooks/useRoundFromSlug"
import { useSyncUrlWithRound } from "../hooks/useSyncUrlWithRound"
import { useJumpToPrepNoteBox } from "../hooks/useJumpToPrepNoteBox"
import { useSpeechDocHeadings } from "../hooks/useSpeechDocHeadings"
import { useTimerSync } from "../hooks/useTimerSync"
import { getRoundRecordingShareEmails } from "../round/round-recording-share"
import { readPinnedDebateIds, togglePinnedDebate } from "../state/pinnedDebates"
import { readFlowHistory } from "../state/flowHistoryEntries"
import { hydrateBulkStorage } from "@debate/data-sync/src/state/bulk-storage"
import { selectSidebarRound } from "../utils/sidebar-round"
import {
  buildFeaturedRound,
  featuredRoundBySlug,
  featuredRoundStyleIndex,
  findLocalFeaturedRound,
  loadFeaturedSpeechDocs,
  FEATURED_ROUNDS,
  type FeaturedRound,
} from "../round/featured-rounds"

/** Props for {@link DebateFlowPage}. */
export interface DebateFlowPageProps {
  /** Extra controls for the start screen's header (the host app's account-sync badge). */
  startScreenActions?: ReactNode
  /** Extra controls for the open round/flow workspace's top bar (the host app's account-sync badge). */
  roundActions?: ReactNode
}

/**
 * Manages the entire debate flow experience with a modular, maintainable architecture:
 * - Custom hooks for state management and business logic
 * - Layout components for UI structure
 * - Control components for reusable UI elements
 *
 * @returns The full-screen debate flow page
 */
export function DebateFlowPage({ startScreenActions, roundActions }: DebateFlowPageProps = {}) {
  // ============================================================================
  // Global State (Zustand)
  // ============================================================================
  const { flows, selected, setFlows, setSelected, setRounds, getRounds, getFlowHistory, loadFromHistory, createRound } =
    useFlowStore()
  const rounds = getRounds()

  // ============================================================================
  // Local State (Custom Hook)
  // ============================================================================
  const state = useDebateFlowState()

  // Whether the pinned "ebb Flow" sidebar entry is the active document —
  // ebb is a separate local-first editor, not one of the database-backed
  // `flows`, so it isn't tracked via `selected`.
  const [ebbActive, setEbbActive] = useState(false)

  // An "ebb Flow tools" menu choice (New flow / Open / Join / Settings / a
  // recent flow) made while the ebb tab wasn't the active one — queued here
  // and handed to `EbbFlowEmbed` once selecting the tab mounts it, then
  // cleared so it doesn't re-run on the next render.
  const [ebbPendingAction, setEbbPendingAction] = useState<EbbFlowToolAction | null>(null)

  // CardMirror only ever has one live, editable speech at a time — in split
  // mode that's whichever panel the user last clicked into. Lifted to page
  // level (rather than owned inside FlowMainContent) so the sidebar's "round
  // times" group knows which speech's timer/controls bar to show.
  const [activeSplitSide, setActiveSplitSide] = useState<"left" | "right">("left")

  // Mic device and recording-enabled flag, shared between the live speech's
  // recorder (embedded in the sidebar's SpeechHeaderBar) and the global
  // SpeechControlsTopBar's recording menu, since they act on the same speech.
  const [micDeviceId, setMicDeviceId] = useState<string | undefined>()
  const [recordingEnabled, setRecordingEnabled] = useState(true)

  // ============================================================================
  // Start Screen Data (pinned + recent debates, read once the page mounts)
  // ============================================================================
  const [pinnedIds, setPinnedIds] = useState<number[]>([])
  const [recentHistory, setRecentHistory] = useState<ReturnType<typeof readFlowHistory>>([])

  /**
   * Load the pinned round ids and the auto-saved flow history that the start
   * screen renders. Read after mount rather than during the first render so
   * this stays client-only (pins are localStorage, the history is the
   * IndexedDB-backed bulk store, read again once it has loaded) and so a
   * second visit picks up whatever was pinned or worked on in the meantime.
   */
  useEffect(() => {
    let cancelled = false
    setPinnedIds(readPinnedDebateIds())
    setRecentHistory(readFlowHistory())
    void hydrateBulkStorage().then(() => {
      if (!cancelled) setRecentHistory(readFlowHistory())
    })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * Pin or unpin a round from the start screen's featured section.
   *
   * @param roundId - The round's local id.
   */
  const handleTogglePin = (roundId: number) => {
    setPinnedIds(togglePinnedDebate(roundId))
  }

  /**
   * Open a round from the start screen: bring that round's flows to the front
   * (archiving every other flow) and select its first one — the same action as
   * clicking a round in the history dialog, minus the dialog.
   *
   * @param round - The round to open.
   */
  const handleOpenRound = (round: Round) => {
    const newFlows = flows.map((f) => ({ ...f, archived: !round.flowIds.includes(f.id) }))
    const firstFlowIndex = newFlows.findIndex((f) => round.flowIds.includes(f.id))
    if (firstFlowIndex === -1) return
    setFlows(newFlows)
    setSelected(firstFlowIndex)
    setEbbActive(false)
  }

  // ============================================================================
  // Featured Rounds (built-in rounds whose speech docs are fetched on open)
  // ============================================================================
  const [loadingFeaturedKey, setLoadingFeaturedKey] = useState<string | null>(null)
  const [featuredError, setFeaturedError] = useState<string | null>(null)

  /**
   * Open a built-in featured round. The first time, its speech docs are
   * fetched from the public library and built into a local round in the
   * round's format; after that the same local round is reopened. Either way
   * the timers switch to the round's format.
   *
   * @param featured - The catalog entry to open.
   */
  const handleOpenFeatured = async (featured: FeaturedRound) => {
    if (loadingFeaturedKey) return
    settings.setValue("debateStyle", featuredRoundStyleIndex(featured))
    settings.saveToLocalStorage()

    const currentFlows = useFlowStore.getState().flows
    const existing = findLocalFeaturedRound(featured, useFlowStore.getState().rounds, currentFlows)
    if (existing) {
      handleOpenRound(existing)
      return
    }

    setFeaturedError(null)
    setLoadingFeaturedKey(featured.key)
    try {
      const { docs, missing } = await loadFeaturedSpeechDocs(featured)
      // Re-read: the store may have changed while the docs were loading.
      const latestFlows = useFlowStore.getState().flows
      const { flow, round: roundData } = buildFeaturedRound(featured, docs, latestFlows.length)
      const round = createRound(roundData)
      const nextFlows = [
        ...latestFlows.map((f) => ({ ...f, archived: true })),
        { ...flow, roundId: round.id },
      ]
      setFlows(nextFlows)
      setSelected(nextFlows.length - 1)
      setEbbActive(false)
      if (missing.length > 0) {
        setFeaturedError(`Opened ${featured.title}, but the ${missing.join(", ")} doc could not be loaded.`)
      }
    } catch (error) {
      setFeaturedError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoadingFeaturedKey(null)
    }
  }


  /**
   * Restore one of the start screen's recent flows from the history log and
   * open it, leaving the pinned ebb Flow tab.
   *
   * @param historyId - The history entry's id.
   */
  const handleOpenRecentFlow = (historyId: string) => {
    if (loadFromHistory(historyId) == null) {
      // The entry was trimmed since the screen rendered — refresh the list.
      setRecentHistory(getFlowHistory())
      return
    }
    setEbbActive(false)
  }

  /**
   * Switch to the pinned ebb Flow tab and queue an "ebb Flow tools" action
   * for it to run once mounted — how every item in that dropdown is wired,
   * regardless of which tab was active when it was chosen.
   *
   * @param action - The tool action to run once the ebb tab is mounted.
   */
const handleEbbToolAction = (action: EbbFlowToolAction) => {
    setEbbActive(true)
    setEbbPendingAction(action)
  }

  // ============================================================================
  // Timer State (lifted here so it survives mobile sidebar unmount)
  // ============================================================================
  const timerState = useTimerState()

  // ============================================================================
  // Side Effects
  // ============================================================================
  const storedFlowsLoaded = useInitialLoad(setFlows, setRounds)
  useFontSizeSettings()
  useFlowPersistence(flows)
  useArgumentTreeAutoSync(flows, selected)
  useMobileDetection(state.setIsMobile)
  useRoundFromSlug()
  useSyncUrlWithRound()
  useJumpToPrepNoteBox()

  // A shared `/debate/<featured slug>` link builds the round for a reader who
  // has never opened it; `useRoundFromSlug` handles every later visit. Waits
  // for `useInitialLoad` (an async IndexedDB read) so the stored flows and
  // rounds are already in the store when this first runs.
  const pathname = usePathname()
  const featuredFromPathRef = useRef<string | null>(null)
  useEffect(() => {
    if (!storedFlowsLoaded) return
    const slug = pathname?.match(/^\/debate\/([^/]+\/[^/]+)$/)?.[1]
    const featured = slug ? featuredRoundBySlug(slug) : undefined
    if (!featured || featuredFromPathRef.current === featured.slug) return
    featuredFromPathRef.current = featured.slug
    const { rounds: storedRounds, flows: storedFlows } = useFlowStore.getState()
    if (!findLocalFeaturedRound(featured, storedRounds, storedFlows)) void handleOpenFeatured(featured)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, storedFlowsLoaded])

  // Update document title when active round changes
  useEffect(() => {
    const activeRound = rounds.find((r) => r.status === "active")
    if (activeRound?.title) {
      document.title = activeRound.title.toUpperCase()
    } else {
      document.title = "Debate FIAT"
    }
  }, [rounds])

  // ============================================================================
  // Handlers
  // ============================================================================
  const flowHandlers = useFlowHandlers(flows, setFlows, setSelected)

  /**
   * Select a database-backed flow tab, leaving the pinned ebb Flow tab.
   *
   * @param index - Index of the flow to select
   */
  const handleSelectFlow = (index: number) => {
    setEbbActive(false)
    setSelected(index)
  }

  /**
   * Apply partial updates to a flow at the given index.
   *
   * @param index - Index of the flow to update in the flows array
   * @param updates - Partial flow properties to merge
   */
  const updateFlow = (index: number, updates: Partial<Flow>) => {
    const newFlows = [...flows]
    newFlows[index] = { ...newFlows[index], ...updates }
    setFlows(newFlows)
  }

  // ============================================================================
  // Room Sync State (for speech doc headings and timer sync)
  // ============================================================================
  const currentFlowForRoom = flows[selected] || null
  const roomId = currentFlowForRoom?.roundId ? `round-${currentFlowForRoom.roundId}` : null
  const { receivedHeadings, broadcastSpeechDocHeadings } = useSpeechDocHeadings(roomId ?? "", "speaker")
  const { remoteTimers, broadcastTimerState } = useTimerSync(roomId ?? "", "speaker")

  // Broadcast timer state changes to the room
  useEffect(() => {
    if (!roomId) return
    // Broadcast speech timer state
    for (const [speechName, entry] of Object.entries(timerState.perSpeechTimerStates)) {
      broadcastTimerState(speechName, {
        speechName,
        time: entry.time,
        resetTime: entry.resetTime,
        state: entry.state,
        timestamp: Date.now(),
      })
    }
    // Broadcast prep timers
    if (timerState.prepState) {
      broadcastTimerState("Prep (Aff)", {
        speechName: "Prep (Aff)",
        time: timerState.prepState.time,
        resetTime: timerState.prepState.resetTime,
        state: timerState.prepState.state,
        timestamp: Date.now(),
      })
    }
    if (timerState.prepSecondaryState) {
      broadcastTimerState("Prep (Neg)", {
        speechName: "Prep (Neg)",
        time: timerState.prepSecondaryState.time,
        resetTime: timerState.prepSecondaryState.resetTime,
        state: timerState.prepSecondaryState.state,
        timestamp: Date.now(),
      })
    }
  }, [timerState.perSpeechTimerStates, timerState.prepState, timerState.prepSecondaryState, roomId, broadcastTimerState])

  const speechHandlers = useSpeechHandlers(flows, selected, state.selectedSpeech, updateFlow, rounds)

  // Wrap handleShareSpeech to also broadcast speech doc headings to the room
  const handleShareSpeechWithHeadings = async () => {
    const currentFlow = flows[selected]
    if (!currentFlow) return

    const speechContent = currentFlow.speechDocs?.[state.selectedSpeech] || ""
    if (!speechContent.trim()) {
      alert("Cannot share empty speech document")
      return
    }

    // Call the original handler
    await speechHandlers.handleShareSpeech()

    // Broadcast headings to the room if we're in a room
    if (roomId && speechContent.trim()) {
      broadcastSpeechDocHeadings(state.selectedSpeech, speechContent)
    }
  }

  const splitHandlers = useSplitModeHandlers(flows, selected, updateFlow)

  // ============================================================================
  // Flow Management Handlers
  // ============================================================================

  /**
   * Create a new flow using the current debate style and append it to the list.
   */
  const handleAddFlow = () => {
    const debateStyleIndex = settings.data.debateStyle.value as number
    const flow = newFlow(flows.length, "primary", false, debateStyleIndex)
    if (!flow) return

    const updatedFlows = [...flows, flow]
    setFlows(updatedFlows)
    setEbbActive(false)
    setSelected(flow.id)
  }

  /**
   * Rename a flow at the given index.
   *
   * @param index - Index of the flow to rename
   * @param newName - New display name for the flow
   */
  const handleRenameFlow = (index: number, newName: string) => {
    updateFlow(index, { content: newName })
  }

  /**
   * Toggle the archived state of a flow.
   *
   * @param index - Index of the flow to archive or unarchive
   */
  const handleArchiveFlow = (index: number) => {
    updateFlow(index, { archived: !flows[index].archived })
  }

  /**
   * Delete a flow by index, delegating to the flow handlers.
   *
   * @param index - Index of the flow to delete
   */
  const handleDeleteFlow = (index: number) => {
    flowHandlers.deleteFlow(flows[index].id)
  }

  // ============================================================================
  // Dialog Handlers
  // ============================================================================

  /**
   * Open the flow history dialog.
   */
  const handleOpenHistory = () => {
    state.setHistoryDialogOpen(true)
  }

  /**
   * Open the round editor dialog for the specified round.
   *
   * @param roundId - ID of the round to edit
   */
  const handleEditRound = (roundId?: number) => {
    state.setEditingRoundId(roundId)
    state.setRoundDialogOpen(true)
  }


  // ============================================================================
  // Speech Panel Handlers
  // ============================================================================

  /**
   * Open the speech document panel for the given speech name.
   *
   * @param speech - Name of the speech whose document should be shown
   */
  const handleOpenSpeechPanel = (speech: string) => {
    if (state.speechPanelOpen && state.selectedSpeech === speech) {
      state.setSpeechPanelOpen(false)
    } else {
      flowHandlers.selectSpeech(speech, state.setSpeechPanelOpen, state.setSelectedSpeech)
    }
  }

  /**
   * Close the speech document panel.
   */
  const handleCloseSpeechPanel = () => {
    state.setSpeechPanelOpen(false)
  }

  // ============================================================================
  // Split Mode Handlers
  // ============================================================================

  /**
   * Toggle between showing one active speech and both speeches side-by-side.
   */
  const handleToggleLayoutMode = () => {
    state.setSinglePaneMode(!state.singlePaneMode)
  }

  // ============================================================================
  // Computed Values
  // ============================================================================

  /** Currently selected flow, or null if none is selected. */
  const currentFlow = flows[selected] || null

  /** Round the currently open flow belongs to, if any. */
  const currentRound = currentFlow?.roundId ? rounds.find((r) => r.id === currentFlow.roundId) : undefined

  /** Markdown content of the currently open speech document. */
  const speechContent = currentFlow?.speechDocs?.[state.selectedSpeech] || ""

  /** Speech name displayed in the left split pane. */
  const leftSpeech = splitHandlers.getLeftSpeech()

  /** Speech name displayed in the right split pane. */
  const rightSpeech = splitHandlers.getRightSpeech()

  /** Content of the left split pane's speech document. */
  const leftContent = currentFlow?.speechDocs?.[leftSpeech] || ""

  /** Content of the right split pane's speech document. */
  const rightContent = currentFlow?.speechDocs?.[rightSpeech] || ""

  // The app dock's sidebar button (mobile) asks whichever route owns its
  // sidebar to open it; this workspace's is the Sheet below.
  const { isMobile, setMobileMenuOpen } = state
  useEffect(() => {
    if (!isMobile) return
    const open = () => setMobileMenuOpen(true)
    window.addEventListener("debate:open-sidebar", open)
    return () => window.removeEventListener("debate:open-sidebar", open)
  }, [isMobile, setMobileMenuOpen])

  // Both panes are only shown side-by-side on desktop, outside single-pane
  // mode — every other layout collapses to just the left speech, so that's
  // the one whose timer/controls bar belongs in the sidebar.
  const showBothPanes = state.splitMode && !state.isMobile && !state.singlePaneMode
  const selectedIsRight = showBothPanes && activeSplitSide === "right"

  /** Name of the speech whose timer/controls bar the sidebar shows. */
  const selectedSpeech = selectedIsRight ? rightSpeech : leftSpeech
  const selectedViewMode = selectedIsRight ? state.splitViewMode2 : state.splitViewMode1
  const selectedQuoteView = selectedIsRight ? state.splitQuoteView2 : state.splitQuoteView1
  const onSelectedViewModeChange = selectedIsRight ? state.setSplitViewMode2 : state.setSplitViewMode1
  const onSelectedQuoteViewToggle = selectedIsRight
    ? () => state.setSplitQuoteView2(!state.splitQuoteView2)
    : () => state.setSplitQuoteView1(!state.splitQuoteView1)

  // Recording status for the speech the global topbar's menu currently targets.
  const { hasRecording: selectedSpeechHasRecording, deleteRecording: deleteSelectedSpeechRecording } =
    useSpeechRecordingStatus(selectedSpeech)

  /** Round the sidebar shows a timer for — when set, the recording menu lives under its speech there. */
  const sidebarRound = selectSidebarRound(rounds, currentFlow)

  /** Emails the global topbar's recording menu's "Share with Opponents" notifies. */
  const selectedSpeechShareEmails = getRoundRecordingShareEmails(currentRound)

  /** Reset the selected speech's timer to its default length. */
  const handleResetSpeechTime = () => {
    const entry = timerState.getSpeechTimerState(selectedSpeech)
    timerState.setSpeechTimerState(selectedSpeech, { time: entry.resetTime, state: { name: "paused" } })
  }

  /** Switch the selected speech's timer to a 3-minute Cross-X. */
  const handleSwitchToCrossX = () => {
    const crossXTime = 3 * 60 * 1000
    timerState.setSpeechTimerState(selectedSpeech, { time: crossXTime, resetTime: crossXTime, state: { name: "paused" } })
  }

  // Update document.title with timer countdown while a timer is running
  useEffect(() => {
    if (!timerState.activeTimer) {
      document.title = "Debate AI"
      return
    }

    const { label, totalTime, startTime } = timerState.activeTimer

    const update = () => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, totalTime - elapsed)
      const m = Math.floor(remaining / 60000)
      const s = Math.floor((remaining % 60000) / 1000)
      const timeStr = `${m}:${s.toString().padStart(2, "0")}`

      let title = `${timeStr} ${label}`

      const round = currentRound

      if (round) {
        const parts: string[] = []
        if (round.tournamentName || round.roundLevel) {
          parts.push([round.tournamentName, round.roundLevel].filter(Boolean).join(" "))
        }
        const formatTeam = (debaters: [string, string], schools?: [string, string]) => {
          const initials = debaters
            .filter(Boolean)
            .map((d) => {
              const tokens = d.trim().split(/\s+/)
              return tokens[tokens.length - 1]?.[0]?.toUpperCase() || ""
            })
            .join("")
          const school = schools?.[0] || ""
          return [school, initials].filter(Boolean).join(" ")
        }
        const affTeam = formatTeam(round.debaters.aff, round.schools?.aff)
        const negTeam = formatTeam(round.debaters.neg, round.schools?.neg)
        if (affTeam || negTeam) {
          parts.push(`${affTeam} v ${negTeam}`)
        }
        if (parts.length) {
          title += ` - ${parts.join(" - ")}`
        }
      }

      document.title = title
    }

    update()
    const id = setInterval(update, 1000)
    return () => {
      clearInterval(id)
      document.title = "Debate AI"
    }
  }, [timerState.activeTimer, currentFlow?.roundId, rounds])

  /** Reset both prep timers to the current debate style's default. */
  const handleResetPrepTimers = () => {
    const prepTime = timerState.debateStyle.prepTime
    if (prepTime) {
      timerState.setPrepState({
        resetTime: prepTime * 60 * 1000,
        time: prepTime * 60 * 1000,
        state: { name: "paused" },
      })
      timerState.setPrepSecondaryState({
        resetTime: prepTime * 60 * 1000,
        time: prepTime * 60 * 1000,
        state: { name: "paused" },
      })
    }
  }

  // Navigation between speeches — single-speech stepping on mobile/single-pane,
  // pair-at-a-time stepping when both split panels are shown side-by-side.
  const canNavigatePrev = splitHandlers.canNavigatePrev
  const canNavigateNext = state.isMobile || state.singlePaneMode ? splitHandlers.canNavigateNextSingle : splitHandlers.canNavigateNext
  const onNavigatePrev = state.isMobile || state.singlePaneMode ? splitHandlers.handlePreviousSingle : splitHandlers.handlePreviousSpeeches
  const onNavigateNext = state.isMobile || state.singlePaneMode ? splitHandlers.handleNextSingle : splitHandlers.handleNextSpeeches

  /**
   * Whether the start screen replaces the flow grid. Shown whenever the page
   * has no flow open — the first visit (nothing loaded from `flows` yet), and
   * any later landing where every flow was deleted.
   */
  const showStartScreen = !ebbActive && !currentFlow

  /**
   * The main content area containing the resizable flow and speech panels.
   * Rendered for both desktop and mobile layouts. When the pinned ebb Flow
   * tab is active, this area hosts ebb's own self-contained editor instead
   * — it owns its own document tree, grid, and dialogs, so none of the
   * flow-specific split/speech-panel machinery below applies to it.
   */
  const mainContentArea = ebbActive ? (
    <div className="h-full p-2">
      <div className="h-full w-full rounded-lg border border-border overflow-hidden">
        <EbbFlowEmbed
          className="h-full w-full"
          pendingAction={ebbPendingAction}
          onPendingActionHandled={() => setEbbPendingAction(null)}
        />
      </div>
    </div>
  ) : showStartScreen ? (
    <div className="h-full p-2">
      <DebateStartPanel
        rounds={rounds}
        history={recentHistory}
        pinnedIds={pinnedIds}
        featuredRounds={FEATURED_ROUNDS}
        loadingFeaturedKey={loadingFeaturedKey}
        featuredError={featuredError}
        onOpenFeatured={(featured) => void handleOpenFeatured(featured)}
        onOpenRound={handleOpenRound}
        onOpenHistoryEntry={handleOpenRecentFlow}
        onTogglePin={handleTogglePin}
        onCreateFlow={handleAddFlow}
        onCreateRound={() => handleEditRound()}
        onOpenHistory={handleOpenHistory}
        headerActions={startScreenActions}
      />
    </div>
  ) : (
    <div className="h-full flex flex-col overflow-hidden p-2">
      {/* Resizable Panels */}
      <ResizablePanelGroup
        orientation="horizontal"
        className="flex-1 rounded-lg border border-border overflow-hidden"
      >
        {/* Main Flow/Split Panel */}
        <ResizablePanel defaultSize={state.speechPanelOpen ? 60 : 100} minSize={30}>
          <FlowMainContent
            currentFlow={currentFlow}
            splitMode={state.splitMode}
            isMobile={state.isMobile}
            singlePaneMode={state.singlePaneMode}
            leftSpeech={leftSpeech}
            rightSpeech={rightSpeech}
            splitWidth={state.splitWidth}
            leftContent={leftContent}
            rightContent={rightContent}
            onUpdateLeftSpeech={splitHandlers.handleUpdateLeftSpeech}
            onUpdateRightSpeech={splitHandlers.handleUpdateRightSpeech}
            activeSplitSide={activeSplitSide}
            onActiveSplitSideChange={setActiveSplitSide}
            onMouseDown={() => {
              const handleMouseMove = (e: MouseEvent) => {
                const container = (e.target as HTMLElement).closest(".split-container")
                if (!container) return
                const rect = container.getBoundingClientRect()
                const newWidth = ((e.clientX - rect.left) / rect.width) * 100
                state.setSplitWidth(Math.max(20, Math.min(80, newWidth)))
              }

              const handleMouseUp = () => {
                document.removeEventListener("mousemove", handleMouseMove)
                document.removeEventListener("mouseup", handleMouseUp)
              }

              document.addEventListener("mousemove", handleMouseMove)
              document.addEventListener("mouseup", handleMouseUp)
            }}
          />
        </ResizablePanel>

        {/* Speech Document Panel */}
        {state.speechPanelOpen && !state.splitMode && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={40} minSize={20}>
              <SpeechDocPanel
                selectedSpeech={state.selectedSpeech}
                viewMode={state.speechPanelViewMode}
                quoteView={state.speechPanelQuoteView}
                content={speechContent}
                currentFlow={currentFlow}
                onClose={handleCloseSpeechPanel}
                onUpdateContent={speechHandlers.handleUpdateSpeechDoc}
                onViewModeChange={state.setSpeechPanelViewMode}
                onQuoteViewToggle={() => state.setSpeechPanelQuoteView(!state.speechPanelQuoteView)}
                onShareSpeech={handleShareSpeechWithHeadings}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  )

  // ============================================================================
  // Render
  // ============================================================================
  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      {/* Global speech controls — quote view, view mode, layout, recording
          menu, and open-speech-doc, formerly duplicated inside each speech's
          own header bar. */}
      <SpeechControlsTopBar
        speechName={selectedSpeech}
        viewMode={selectedViewMode}
        quoteView={selectedQuoteView}
        onViewModeChange={onSelectedViewModeChange}
        onQuoteViewToggle={onSelectedQuoteViewToggle}
        layoutMode={state.singlePaneMode ? "single" : "split"}
        onToggleLayoutMode={handleToggleLayoutMode}
        onOpenSpeechPanel={handleOpenSpeechPanel}
        micDeviceId={micDeviceId}
        onMicDeviceChange={setMicDeviceId}
        recordingEnabled={recordingEnabled}
        onRecordingEnabledChange={setRecordingEnabled}
        onResetSpeechTime={handleResetSpeechTime}
        onSwitchToCrossX={handleSwitchToCrossX}
        onResetPrepTimers={handleResetPrepTimers}
        hasRecording={selectedSpeechHasRecording}
        onDeleteRecording={deleteSelectedSpeechRecording}
        recordingKey={selectedSpeechHasRecording ? `debate-recording-${selectedSpeech}` : undefined}
        participantEmails={selectedSpeechShareEmails}
        showRecordingMenu={state.isMobile || !sidebarRound}
        leadingActions={roundActions}
      />
      {/* Main Layout */}
      <div className="flex-1 overflow-hidden">
        {!state.isMobile ? (
          <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
            <ResizablePanel defaultSize={20} minSize={8}>
              <FlowPageSidebar
                flows={flows}
                selected={selected}
                rounds={rounds}
                currentFlow={currentFlow}
                isMobile={false}
                onSelectFlow={handleSelectFlow}
                onAddFlow={handleAddFlow}
                onRenameFlow={handleRenameFlow}
                onArchiveFlow={handleArchiveFlow}
                onDeleteFlow={handleDeleteFlow}
                onOpenHistory={handleOpenHistory}
                onEditRound={handleEditRound}
                ebbActive={ebbActive}
                onSelectEbb={() => setEbbActive(true)}
                onEbbToolAction={handleEbbToolAction}
                timerState={timerState}
                selectedSpeech={selectedSpeech}
                onResetPrepTimers={handleResetPrepTimers}
                canNavigatePrev={canNavigatePrev}
                canNavigateNext={canNavigateNext}
                onNavigatePrev={onNavigatePrev}
                onNavigateNext={onNavigateNext}
                micDeviceId={micDeviceId}
                onMicDeviceChange={setMicDeviceId}
                recordingEnabled={recordingEnabled}
                onRecordingEnabledChange={setRecordingEnabled}
                receivedHeadings={receivedHeadings}
                remoteTimers={remoteTimers}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={80}>
              {mainContentArea}
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <>
            {/* Mobile Sidebar (Sheet) */}
            <Sheet open={state.mobileMenuOpen} onOpenChange={state.setMobileMenuOpen}>
              <SheetContent side="left" className="w-64 p-0">
                <FlowPageSidebar
                  flows={flows}
                  selected={selected}
                  rounds={rounds}
                  currentFlow={currentFlow}
                  isMobile={true}
                  onSelectFlow={handleSelectFlow}
                  onAddFlow={handleAddFlow}
                  onRenameFlow={handleRenameFlow}
                  onArchiveFlow={handleArchiveFlow}
                  onDeleteFlow={handleDeleteFlow}
                  onOpenHistory={handleOpenHistory}
                  onEditRound={handleEditRound}
                  ebbActive={ebbActive}
                  onSelectEbb={() => setEbbActive(true)}
                  onEbbToolAction={handleEbbToolAction}
                  onCloseMobileMenu={() => state.setMobileMenuOpen(false)}
                  timerState={timerState}
                  selectedSpeech={selectedSpeech}
                  onResetPrepTimers={handleResetPrepTimers}
                  canNavigatePrev={canNavigatePrev}
                  canNavigateNext={canNavigateNext}
                  onNavigatePrev={onNavigatePrev}
                  onNavigateNext={onNavigateNext}
                  micDeviceId={micDeviceId}
                  onMicDeviceChange={setMicDeviceId}
                  recordingEnabled={recordingEnabled}
                  onRecordingEnabledChange={setRecordingEnabled}
                  receivedHeadings={receivedHeadings}
                  remoteTimers={remoteTimers}
                />
              </SheetContent>
            </Sheet>
            {mainContentArea}
          </>
        )}
      </div>

      {/* Dialogs */}
      <FlowHistoryDialog
        open={state.historyDialogOpen}
        onOpenChange={state.setHistoryDialogOpen}
        onEditRound={handleEditRound}
        onCreateRound={() => handleEditRound()}
        onFlowOpened={() => setEbbActive(false)}
      />

      <RoundEditorDialog
        open={state.roundDialogOpen}
        onOpenChange={state.setRoundDialogOpen}
        roundId={state.editingRoundId}
      />
    </div>
  )
}
