"use client";

import { DownloadSimple } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Tip } from "../ui/tooltip";
import { useFlowStore } from "../../lib/store/useFlowStore";
import { getCurrentVersion, getSystemInfo } from "../../lib/update/adapter";
import type { UpdateUiState } from "../../lib/update/useAutoUpdate";
import { cn } from "../../lib/utils";

import { useUpdate } from "../update/UpdateProvider";
import SettingRow from "./SettingRow";

/** Rust's `std::env::consts` names, spelled the way people say them. */
const OS_LABELS: Record<string, string> = {
    macos: "macOS",
    windows: "Windows",
    linux: "Linux",
};
const ARCH_LABELS: Record<string, string> = {
    aarch64: "arm64",
    x86_64: "x86-64",
};

/** Why the install button is disabled, shown as its hover tooltip. */
function idleTooltip(state: UpdateUiState): string {
    switch (state.status) {
        case "checking":
            return "Checking for updates…";
        case "downloading":
            return "Downloading the update…";
        case "error":
            return "Couldn't check for updates.";
        default:
            return "Already on the latest version.";
    }
}

/**
 * Desktop-only update controls. The single "Install latest update" button is
 * the whole story: greyed with an "already latest" tooltip until a newer
 * version has been downloaded, then green and clickable to install + relaunch.
 * A newer version arrives either from the background poller (auto-check) or the
 * explicit "Check for updates" button. Only rendered inside the Tauri shell
 * (the settings panel gates the category on `isDesktop()`).
 */
export default function UpdateSettings() {
    const config = useFlowStore((s) => s.updateConfig);
    const setUpdateConfig = useFlowStore((s) => s.setUpdateConfig);
    const { state, checkNow, installAndRestart } = useUpdate();
    const [install, setInstall] = useState<{ version: string; platform: string } | null>(null);

    useEffect(() => {
        let cancelled = false;
        void Promise.all([getCurrentVersion(), getSystemInfo()]).then(([version, system]) => {
            if (cancelled) return;
            const [os, arch] = system ?? [];
            setInstall({
                version,
                platform: os
                    ? `${OS_LABELS[os] ?? os} (${arch ? (ARCH_LABELS[arch] ?? arch) : "unknown"})`
                    : "Unknown",
            });
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const busy = state.status === "checking" || state.status === "downloading";
    const ready = state.status === "ready";

    // Native `disabled` swallows pointer events, so the tooltip never opens.
    // Keep the button interactive, mark it aria-disabled, and no-op the click.
    const installButton = (
        <Button
            type="button"
            size="sm"
            variant={ready ? "default" : "secondary"}
            aria-disabled={!ready}
            onClick={ready ? () => void installAndRestart() : undefined}
            data-testid="install-update"
            className={cn(
                ready
                    ? "bg-green-600 text-white hover:bg-green-600/90 dark:bg-green-600 dark:hover:bg-green-600/80"
                    : "cursor-not-allowed opacity-60",
            )}
        >
            <DownloadSimple />
            Install latest update
        </Button>
    );

    return (
        <div className="flex flex-col">
            <SettingRow
                title="Check for updates automatically"
                description="Downloads happen silently; installing always waits for your confirmation."
                control={
                    <Switch
                        checked={config.autoCheckEnabled}
                        onCheckedChange={(v) => setUpdateConfig({ autoCheckEnabled: v })}
                        data-testid="toggle-autoCheck"
                        aria-label="Check for updates automatically"
                    />
                }
            />

            <SettingRow
                title="Software updates"
                control={
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void checkNow()}
                            disabled={busy}
                            data-testid="check-updates"
                        >
                            {state.status === "downloading"
                                ? "Downloading…"
                                : busy
                                  ? "Checking…"
                                  : "Check for updates"}
                        </Button>
                        {ready ? (
                            installButton
                        ) : (
                            <Tip label={idleTooltip(state)}>{installButton}</Tip>
                        )}
                    </>
                }
            />

            {install && (
                <div data-testid="install-info" className="flex flex-col">
                    <SettingRow
                        title="Version"
                        control={
                            <span className="text-foreground text-[13px] tabular-nums">
                                {install.version}
                            </span>
                        }
                    />
                    <SettingRow
                        title="Platform"
                        control={
                            <span className="text-foreground text-[13px]">{install.platform}</span>
                        }
                    />
                </div>
            )}
        </div>
    );
}
