/**
 * useSaveStatus - the editor's autosave indicator.
 *
 * Kept separate from `useFlowStore` on purpose: save status is a
 * persistence-layer concern, not round data, and must never enter the
 * undo/redo history. `attachFlowAutosave` reports transitions here; the
 * header's <SaveStatus /> renders them.
 */

import { create } from "zustand";

import type { SaveStatus } from "../persistence/flowSession";

/** "idle" = nothing to report yet (no round loaded / left the editor). */
export type SaveState = SaveStatus | "idle";

interface SaveStatusStore {
    state: SaveState;
    /** Epoch ms of the last successful save, or null. */
    savedAt: number | null;
    report: (state: SaveStatus) => void;
    reset: () => void;
}

export const useSaveStatus = create<SaveStatusStore>((set) => ({
    state: "idle",
    savedAt: null,
    report: (state) => set(state === "saved" ? { state, savedAt: Date.now() } : { state }),
    reset: () => set({ state: "idle", savedAt: null }),
}));
