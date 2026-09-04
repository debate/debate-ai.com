"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { saveOpenFlow } from "../commands/fileCommands";
import { useFlowStore } from "../store/useFlowStore";

import {
    downloadUpdate,
    fetchManifest,
    getCurrentVersion,
    installAndRelaunch,
    isDesktop,
    type StagedUpdate,
} from "./adapter";
import { decideUpdateAction } from "./policy";
import type { UpdateManifest } from "./types";

/** How often background checks run when auto-check is enabled. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * The update lifecycle as the UI sees it.
 * - `ready`: a newer version is downloaded and verified, but the install (the
 *   rewrite of the app on disk) waits for the user to confirm via the chip.
 * - `upToDate` / `error`: manual-check feedback only; auto-checks stay silent.
 */
export type UpdateUiState =
    | { status: "idle" }
    | { status: "checking" }
    | { status: "downloading" }
    | { status: "ready"; manifest: UpdateManifest }
    | { status: "upToDate" }
    | { status: "error"; message: string };

export interface AutoUpdate {
    state: UpdateUiState;
    /** Manual check. Downloads a newer version; reports up-to-date otherwise. */
    checkNow(): Promise<void>;
    /** User-confirmed install: rewrite the app with the staged download, then relaunch. */
    installAndRestart(): Promise<void>;
}

/**
 * Drives the download-silently / install-only-on-confirm update model. All
 * policy decisions come from the pure, tested `decideUpdateAction`; this hook
 * only wires that brain to Tauri I/O and the persisted config. A check never
 * touches the install on disk: it downloads at most, and the rewrite happens
 * exclusively in `installAndRestart`, which is user-initiated.
 * Failures surface as `error`/`upToDate` only for manual checks; auto-checks
 * stay silent. Entirely inert on the web build (no desktop runtime, so no
 * checks and no network).
 */
export function useAutoUpdate(): AutoUpdate {
    const [state, setState] = useState<UpdateUiState>({ status: "idle" });
    // Guards against overlapping checks (interval firing during a download, etc.).
    const running = useRef(false);
    // The downloaded-but-not-installed update the user has yet to confirm.
    const staged = useRef<StagedUpdate | null>(null);
    const autoCheckEnabled = useFlowStore((s) => s.updateConfig.autoCheckEnabled);

    const run = useCallback(async (manual: boolean) => {
        if (!isDesktop() || running.current) return;
        running.current = true;
        try {
            setState({ status: "checking" });
            let manifest: UpdateManifest | null;
            try {
                manifest = await fetchManifest();
            } catch {
                setState(
                    manual
                        ? { status: "error", message: "Couldn't check for updates." }
                        : { status: "idle" },
                );
                return;
            }
            if (!manifest) {
                setState(manual ? { status: "upToDate" } : { status: "idle" });
                return;
            }
            const version = await getCurrentVersion();
            const action = decideUpdateAction(manifest, version);

            switch (action.kind) {
                case "download": {
                    if (staged.current?.version === manifest.version) {
                        setState({ status: "ready", manifest });
                        return;
                    }
                    setState({ status: "downloading" });
                    try {
                        const update = await downloadUpdate();
                        if (!update) {
                            setState(manual ? { status: "upToDate" } : { status: "idle" });
                            return;
                        }
                        staged.current = update;
                    } catch {
                        setState(
                            manual
                                ? { status: "error", message: "Couldn't download the update." }
                                : { status: "idle" },
                        );
                        return;
                    }
                    setState({ status: "ready", manifest });
                    return;
                }
                case "none":
                    setState({ status: "idle" });
                    return;
            }
        } finally {
            running.current = false;
        }
    }, []);

    const checkNow = useCallback(() => run(true), [run]);

    const installAndRestart = useCallback(async () => {
        const update = staged.current;
        if (!update) return;

        // Installing rewrites the binary and relaunches, which ends this
        // process as surely as quitting does. An edit still sitting in the
        // autosave debounce would go with it.
        if (!(await saveOpenFlow())) {
            setState({
                status: "error",
                message: "Couldn't save your flow, so the update was not installed.",
            });
            return;
        }

        try {
            await installAndRelaunch(update);
        } catch {
            staged.current = null; // a half-applied install can't be retried blindly
            setState({ status: "error", message: "Couldn't install the update." });
        }
    }, []);

    // Background checks: on mount and on an interval, only when opted in.
    useEffect(() => {
        if (!isDesktop() || !autoCheckEnabled) return;
        void run(false);
        const id = window.setInterval(() => void run(false), CHECK_INTERVAL_MS);
        return () => window.clearInterval(id);
    }, [autoCheckEnabled, run]);

    return { state, checkNow, installAndRestart };
}
