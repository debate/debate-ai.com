"use client";

import { lazy, Suspense } from "react";

import KeybindingsCheatsheet from "../palette/KeybindingsCheatsheet";
import SearchPalette from "../palette/SearchPalette";
import { sideLabels } from "../../lib/format/events";
import { useKeymap } from "../../lib/keymap/useKeymap";
import { useFlowStore } from "../../lib/store/useFlowStore";

import InfoPanel from "./InfoPanel";
import PrintView from "./PrintView";
import RfdDrawer from "./RfdDrawer";
import RoundHeader from "./RoundHeader";
import SheetTitleBar from "./SheetTitleBar";
import Sidebar from "./Sidebar";

// Handsontable touches window at import time; keep it out of prerendering.
const HotGrid = lazy(() => import("./HotGrid"));

export default function Workspace() {
    useKeymap();

    const activeSheetId = useFlowStore((s) => s.activeSheetId);
    const splitSheetId = useFlowStore((s) => s.splitSheetId);
    const focusedPane = useFlowStore((s) => s.focusedPane);
    const round = useFlowStore((s) => s.round);
    const rfdOpen = useFlowStore((s) => s.rfdOpen);
    const roundId = useFlowStore((s) => s.round?.id);
    const sides = sideLabels(round?.event);

    const sheetOf = (id: string | null) => round?.sheets.find((s) => s.id === id);
    const titleOf = (id: string | null) => sheetOf(id)?.title ?? "";
    const sideOf = (id: string | null): "aff" | "neg" =>
        sheetOf(id)?.group === "neg" ? "neg" : "aff";

    return (
        <div className="bg-background flex h-full flex-col" data-testid="workspace">
            <RoundHeader />
            <div className="flex min-h-0 flex-1">
                <Sidebar />
                <main
                    // isolate: trap Handsontable's frozen-header clone layers (z-index up
                    // to ~1060) in their own stacking context so they can't punch through
                    // dialog/dropdown/sheet overlays (z-50) that dim the rest of the screen.
                    className="no-print isolate flex min-w-0 flex-1 overflow-hidden"
                    data-testid="workspace-content"
                >
                    {activeSheetId ? (
                        <>
                            {/* Same element/position in single and split mode so toggling
                                    split never remounts pane 1's live HotGrid. */}
                            <div
                                data-testid="pane-1"
                                className="flex min-w-0 flex-1 flex-col overflow-hidden"
                            >
                                <SheetTitleBar
                                    sheetId={activeSheetId}
                                    title={titleOf(activeSheetId)}
                                    side={sideOf(activeSheetId)}
                                    tabLabel={splitSheetId ? "Tab 1" : undefined}
                                    focused={splitSheetId ? focusedPane === 1 : undefined}
                                />
                                <div className="min-h-0 flex-1">
                                    <Suspense fallback={null}>
                                        <HotGrid key="pane1" sheetId={activeSheetId} pane={1} />
                                    </Suspense>
                                </div>
                            </div>
                            {splitSheetId && (
                                <>
                                    <div className="border-border w-px shrink-0 border-l" />
                                    <div
                                        data-testid="pane-2"
                                        className="flex min-w-0 flex-1 flex-col overflow-hidden"
                                    >
                                        <SheetTitleBar
                                            sheetId={splitSheetId}
                                            title={titleOf(splitSheetId)}
                                            side={sideOf(splitSheetId)}
                                            tabLabel="Tab 2"
                                            focused={focusedPane === 2}
                                        />
                                        <div className="min-h-0 flex-1">
                                            <Suspense fallback={null}>
                                                <HotGrid key="pane2" sheetId={splitSheetId} pane={2} />
                                            </Suspense>
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="text-muted-foreground w-full p-6 text-[13px]">
                            No sheet selected. Choose one from the sidebar, or add a sheet with{" "}
                            <span className="text-foreground font-medium">+ {sides.aff.label}</span>{" "}
                            /{" "}
                            <span className="text-foreground font-medium">+ {sides.neg.label}</span>
                            .
                        </div>
                    )}
                </main>
            </div>
            {rfdOpen && roundId && <RfdDrawer key={roundId} />}
            <SearchPalette />
            <InfoPanel />
            <KeybindingsCheatsheet />
            <PrintView />
        </div>
    );
}
