"use client"

/**
 * @fileoverview Main Debate Flow Page Component (Refactored)
 *
 * This is the primary component for the debate flow interface, now refactored
 * into a clean, modular architecture using custom hooks and layout components.
 */

import { useRef, useEffect, useState } from "react"
import { X } from "lucide-react"
import { EbbFlowEmbed } from "debate-flow-ebb"
import { useFlowStore } from "../state/store"
import { newFlow } from "../utils/flow-utils"
import { settings } from "../state/settings"
import type { Flow } from "../types/flow"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "debate-ui/src/primitives/resizable"
import { Sheet, SheetContent } from "debate-ui/src/primitives/sheet"
import { buildBoxJumpFailedMessage } from "../flow/edit-cells"

// Modular components
import { FlowPageSidebar } from "../layout/FlowPageSidebar"
import { FlowMainContent } from "../layout/FlowMainContent"
import { SpeechDocPanel } from "../layout/SpeechDocPanel"

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
import { useRoundFromSlug } from "../hooks/useRoundFromSlug"
import { useSyncUrlWithRound } from "../hooks/useSyncUrlWithRound"
import { useJumpToPrepNoteBox } from "../hooks/useJumpToPrepNoteBox"

/**
 * Manages the entire debate flow experience with a modular, maintainable architecture:
 * - Custom hooks for state management and business logic
 * - Layout components for UI structure
 * - Control components for reusable UI elements
 *
 * @returns The full-screen debate flow page
 */
export function DebateFlowPage() {
  // ============================================================================
  // Global State (Zustand)
  // ============================================================================
  const { flows, selected, setFlows, setSelected, setRounds, getRounds } = useFlowStore()
  const rounds = getRounds()

  // ============================================================================
  // Local State (Custom Hook)
  // ============================================================================
  const state = useDebateFlowState()

  // Whether the pinned "ebb Flow" sidebar entry is the active document —
  // ebb is a separate local-first editor, not one of the database-backed
  // `flows`, so it isn't tracked via `selected`.
  const [ebbActive, setEbbActive] = useState(false)

  // ============================================================================
  // Timer State (lifted here so it survives mobile sidebar unmount)
  // ============================================================================
  const timerState = useTimerState()

  // ============================================================================
  // Refs
  // ============================================================================
  /** Reference to the AG Grid API for programmatic column navigation. */
  const gridApiRef = useRef<any>(null)

  // ============================================================================
  // Side Effects
  // ============================================================================
  useInitialLoad(setFlows, setRounds)
  useFontSizeSettings()
  useFlowPersistence(flows, setFlows)
  useArgumentTreeAutoSync(flows, selected)
  useMobileDetection(state.setIsMobile)
  useRoundFromSlug()
  useSyncUrlWithRound()
  const {
    onGridReady: onPrepNoteJumpGridReady,
    jumpFailed: prepNoteJumpFailed,
    dismissJumpFailed: dismissPrepNoteJumpFailed,
  } = useJumpToPrepNoteBox(gridApiRef)

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

  const speechHandlers = useSpeechHandlers(flows, selected, state.selectedSpeech, updateFlow)

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
   * Toggle split mode on or off, initializing column state when enabling.
   */
  const handleToggleSplit = () => {
    if (!state.splitMode && flows[selected]?.columns) {
      splitHandlers.initializeSplitMode()
    }
    state.setSplitMode(!state.splitMode)
  }

  // ============================================================================
  // Computed Values
  // ============================================================================

  /** Currently selected flow, or null if none is selected. */
  const currentFlow = flows[selected] || null

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

      const round = currentFlow?.roundId
        ? rounds.find((r) => r.id === currentFlow.roundId)
        : undefined

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
        <EbbFlowEmbed className="h-full w-full" />
      </div>
    </div>
  ) : (
    <div className="h-full flex flex-col overflow-hidden p-2">
      {prepNoteJumpFailed && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{buildBoxJumpFailedMessage()}</span>
          <button
            type="button"
            onClick={dismissPrepNoteJumpFailed}
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 hover:bg-destructive/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
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
            gridApiRef={gridApiRef}
            onFlowGridReady={onPrepNoteJumpGridReady}
            isMobile={state.isMobile}
            leftSpeech={leftSpeech}
            rightSpeech={rightSpeech}
            leftViewMode={state.splitViewMode1}
            rightViewMode={state.splitViewMode2}
            leftQuoteView={state.splitQuoteView1}
            rightQuoteView={state.splitQuoteView2}
            onLeftViewModeChange={state.setSplitViewMode1}
            onRightViewModeChange={state.setSplitViewMode2}
            onLeftQuoteViewToggle={() => state.setSplitQuoteView1(!state.splitQuoteView1)}
            onRightQuoteViewToggle={() => state.setSplitQuoteView2(!state.splitQuoteView2)}
            splitWidth={state.splitWidth}
            leftContent={leftContent}
            rightContent={rightContent}
            onOpenSpeechPanel={handleOpenSpeechPanel}
            onUpdateLeftSpeech={splitHandlers.handleUpdateLeftSpeech}
            onUpdateRightSpeech={splitHandlers.handleUpdateRightSpeech}
            onUpdate={updateFlow.bind(null, selected)}
            speechTimerStates={timerState.perSpeechTimerStates}
            onSpeechTimerStateChange={timerState.setSpeechTimerState}
            onResetPrepTimers={() => {
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
            }}
            canNavigatePrev={splitHandlers.canNavigatePrev}
            canNavigateNext={state.isMobile ? splitHandlers.canNavigateNextSingle : splitHandlers.canNavigateNext}
            onNavigatePrev={state.isMobile ? splitHandlers.handlePreviousSingle : splitHandlers.handlePreviousSpeeches}
            onNavigateNext={state.isMobile ? splitHandlers.handleNextSingle : splitHandlers.handleNextSpeeches}
            onMobileMenuClick={state.isMobile ? () => state.setMobileMenuOpen(true) : undefined}
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
                onShareSpeech={speechHandlers.handleShareSpeech}
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
                splitMode={state.splitMode}
                isMobile={false}
                onSelectFlow={handleSelectFlow}
                onAddFlow={handleAddFlow}
                onRenameFlow={handleRenameFlow}
                onArchiveFlow={handleArchiveFlow}
                onDeleteFlow={handleDeleteFlow}
                onToggleSplitMode={handleToggleSplit}
                onOpenHistory={handleOpenHistory}
                onEditRound={handleEditRound}
                ebbActive={ebbActive}
                onSelectEbb={() => setEbbActive(true)}
                timerState={timerState}
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
                  splitMode={state.splitMode}
                  isMobile={true}
                  onSelectFlow={handleSelectFlow}
                  onAddFlow={handleAddFlow}
                  onRenameFlow={handleRenameFlow}
                  onArchiveFlow={handleArchiveFlow}
                  onDeleteFlow={handleDeleteFlow}
                  onToggleSplitMode={handleToggleSplit}
                  onOpenHistory={handleOpenHistory}
                  onEditRound={handleEditRound}
                  ebbActive={ebbActive}
                  onSelectEbb={() => setEbbActive(true)}
                  onCloseMobileMenu={() => state.setMobileMenuOpen(false)}
                  timerState={timerState}
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
      />

      <RoundEditorDialog
        open={state.roundDialogOpen}
        onOpenChange={state.setRoundDialogOpen}
        roundId={state.editingRoundId}
      />
    </div>
  )
}
