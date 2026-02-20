"use client"

/**
 * @fileoverview Main Debate Flow Page Component (Refactored)
 *
 * This is the primary component for the debate flow interface, now refactored
 * into a clean, modular architecture using custom hooks and layout components.
 *
 * @module components/debate/core/DebateFlowPage
 */

import { useRef } from "react"
import { useFlowStore } from "@/lib/state/store"
import { newFlow } from "@/lib/utils/flow-utils"
import { settings } from "@/lib/state/settings"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Sheet, SheetContent } from "@/components/ui/sheet"

// Modular components
import { FlowPageHeader } from "./layout/FlowPageHeader"
import { FlowPageSidebar } from "./layout/FlowPageSidebar"
import { FlowMainContent } from "./layout/FlowMainContent"
import { SpeechDocPanel } from "./layout/SpeechDocPanel"
import { SplitModeToolbar } from "./controls/SplitModeToolbar"

// Dialogs
import { FlowHistoryDialog } from "../dialogs/FlowHistoryDialog"
import { RoundEditorDialog } from "../dialogs/RoundEditorDialog"
import { SettingsDialog } from "../dialogs/SettingsDialog"

// Custom hooks
import { useDebateFlowState } from "./hooks/useDebateFlowState"
import { useInitialLoad, useFontSizeSettings, useFlowPersistence } from "./hooks/useFlowEffects"
import { useMobileDetection } from "./hooks/useMobileDetection"
import { useFlowHandlers } from "./hooks/useFlowHandlers"
import { useSpeechHandlers } from "./hooks/useSpeechHandlers"
import { useSplitModeHandlers } from "./hooks/useSplitModeHandlers"
import { useColumnNavigation } from "./hooks/useColumnNavigation"

/**
 * DebateFlowPage - Main debate flow interface component (Refactored)
 *
 * Manages the entire debate flow experience with a modular, maintainable architecture:
 * - Custom hooks for state management and business logic
 * - Layout components for UI structure
 * - Control components for reusable UI elements
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

  // ============================================================================
  // Refs
  // ============================================================================
  const gridApiRef = useRef<any>(null)

  // ============================================================================
  // Side Effects
  // ============================================================================
  useInitialLoad(setFlows, setRounds)
  useFontSizeSettings()
  useFlowPersistence(flows, setFlows)
  useMobileDetection(state.setIsMobile)

  // ============================================================================
  // Handlers
  // ============================================================================
  const flowHandlers = useFlowHandlers(flows, setFlows, setSelected)
  const columnNav = useColumnNavigation(gridApiRef)

  // Update flow helper
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
  const handleAddFlow = () => {
    const debateStyleIndex = settings.data.debateStyle.value as number
    const flow = newFlow(flows.length, "primary", false, debateStyleIndex)
    if (!flow) return

    const updatedFlows = [...flows, flow]
    setFlows(updatedFlows)
    setSelected(flow.id)
  }

  const handleRenameFlow = (index: number, newName: string) => {
    updateFlow(index, { content: newName })
  }

  const handleArchiveFlow = (index: number) => {
    updateFlow(index, { archived: !flows[index].archived })
  }

  const handleDeleteFlow = (index: number) => {
    flowHandlers.deleteFlow(flows[index].id)
  }

  // ============================================================================
  // Dialog Handlers
  // ============================================================================
  const handleOpenHistory = () => {
    state.setHistoryDialogOpen(true)
  }

  const handleEditRound = (roundId: number) => {
    state.setEditingRoundId(roundId)
    state.setRoundDialogOpen(true)
  }


  // ============================================================================
  // Speech Panel Handlers
  // ============================================================================
  const handleOpenSpeechPanel = (speech: string) => {
    flowHandlers.selectSpeech(speech, state.setSpeechPanelOpen, state.setSelectedSpeech)
  }

  const handleCloseSpeechPanel = () => {
    state.setSpeechPanelOpen(false)
  }

  // ============================================================================
  // Split Mode Handlers
  // ============================================================================
  const handleToggleSplit = () => {
    if (!state.splitMode && flows[selected]?.columns) {
      splitHandlers.initializeSplitMode()
    }
    state.setSplitMode(!state.splitMode)
  }

  // ============================================================================
  // Computed Values
  // ============================================================================
  const currentFlow = flows[selected] || null
  const speechContent = currentFlow?.speechDocs?.[state.selectedSpeech] || ""

  const leftSpeech = splitHandlers.getLeftSpeech()
  const rightSpeech = splitHandlers.getRightSpeech()
  const leftContent = currentFlow?.speechDocs?.[leftSpeech] || ""
  const rightContent = currentFlow?.speechDocs?.[rightSpeech] || ""

  // ============================================================================
  // Render
  // ============================================================================
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Mobile Header */}
      {state.isMobile && (
        <FlowPageHeader
          currentFlow={currentFlow}
          splitMode={state.splitMode}
          onMenuClick={() => state.setMobileMenuOpen(true)}
          onNavigatePrev={columnNav.navigatePreviousColumn}
          onNavigateNext={columnNav.navigateNextColumn}
        />
      )}

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        {!state.isMobile && (
          <div className="w-64 flex-shrink-0">
            <FlowPageSidebar
              flows={flows}
              selected={selected}
              rounds={rounds}
              currentFlow={currentFlow}
              splitMode={state.splitMode}
              isMobile={false}
              onSelectFlow={setSelected}
              onAddFlow={handleAddFlow}
              onRenameFlow={handleRenameFlow}
              onArchiveFlow={handleArchiveFlow}
              onDeleteFlow={handleDeleteFlow}
              onToggleSplitMode={handleToggleSplit}
              onOpenHistory={handleOpenHistory}
              onEditRound={handleEditRound}
            />
          </div>
        )}

        {/* Mobile Sidebar (Sheet) */}
        {state.isMobile && (
          <Sheet open={state.mobileMenuOpen} onOpenChange={state.setMobileMenuOpen}>
            <SheetContent side="left" className="w-64 p-0">
              <FlowPageSidebar
                flows={flows}
                selected={selected}
                rounds={rounds}
                currentFlow={currentFlow}
                splitMode={state.splitMode}
                isMobile={true}
                onSelectFlow={setSelected}
                onAddFlow={handleAddFlow}
                onRenameFlow={handleRenameFlow}
                onArchiveFlow={handleArchiveFlow}
                onDeleteFlow={handleDeleteFlow}
                onToggleSplitMode={handleToggleSplit}
                onOpenHistory={handleOpenHistory}
                onEditRound={handleEditRound}
                onCloseMobileMenu={() => state.setMobileMenuOpen(false)}
              />
            </SheetContent>
          </Sheet>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden p-2">
          {/* Split Mode Toolbar */}
          {state.splitMode && currentFlow && (
            <SplitModeToolbar
              leftSpeech={leftSpeech}
              rightSpeech={rightSpeech}
              canNavigatePrev={splitHandlers.canNavigatePrev}
              canNavigateNext={splitHandlers.canNavigateNext}
              onNavigatePrev={splitHandlers.handlePreviousSpeeches}
              onNavigateNext={splitHandlers.handleNextSpeeches}
              leftViewMode={state.splitViewMode1}
              rightViewMode={state.splitViewMode2}
              leftQuoteView={state.splitQuoteView1}
              rightQuoteView={state.splitQuoteView2}
              onLeftViewModeChange={state.setSplitViewMode1}
              onRightViewModeChange={state.setSplitViewMode2}
              onLeftQuoteViewToggle={() => state.setSplitQuoteView1(!state.splitQuoteView1)}
              onRightQuoteViewToggle={() => state.setSplitQuoteView2(!state.splitQuoteView2)}
            />
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
                leftSpeech={leftSpeech}
                rightSpeech={rightSpeech}
                leftViewMode={state.splitViewMode1}
                rightViewMode={state.splitViewMode2}
                leftQuoteView={state.splitQuoteView1}
                rightQuoteView={state.splitQuoteView2}
                splitWidth={state.splitWidth}
                leftContent={leftContent}
                rightContent={rightContent}
                onOpenSpeechPanel={handleOpenSpeechPanel}
                onUpdateLeftSpeech={splitHandlers.handleUpdateLeftSpeech}
                onUpdateRightSpeech={splitHandlers.handleUpdateRightSpeech}
                onUpdate={updateFlow.bind(null, selected)}
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
      </div>

      {/* Dialogs */}
      <FlowHistoryDialog
        open={state.historyDialogOpen}
        onOpenChange={state.setHistoryDialogOpen}
        onEditRound={handleEditRound}
      />

      <RoundEditorDialog
        open={state.roundDialogOpen}
        onOpenChange={state.setRoundDialogOpen}
        roundId={state.editingRoundId}
      />

      <SettingsDialog open={state.settingsOpen} onOpenChange={state.setSettingsOpen} />
    </div>
  )
}
