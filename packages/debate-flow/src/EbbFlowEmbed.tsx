"use client";

/**
 * EbbFlowEmbed - mounts ebb (the local-first debate flow editor) as one
 * column of a host page, rather than as the page-owning app it is
 * standalone. Ports the provider tree `app/layout.tsx` mounts once for the
 * whole ebb site - everything there is already web-safe (ebb's web build is
 * a real, tested deployment target of its own, gated off every
 * desktop-only touchpoint by `isDesktop()`), so nothing here is stripped,
 * only re-homed:
 *
 *   - Next's router is gone. `app/page.tsx` and `app/flow/page.tsx` read
 *     "which screen" from the URL; there is no ebb-owned URL inside a host
 *     page, so this component holds that state itself and feeds it to
 *     `NavigatorHost` as a `FlowNavigator`, the same seam the keyboard layer
 *     and native menu already route every open/new/back-to-start through.
 *   - `.ebb-scope` is ebb's CSS root: `styles/ebb-scope.css` scopes every
 *     design token ebb defines (colors, radii, the flow font) under that
 *     class instead of `:root`, so ebb's palette doesn't leak onto the rest
 *     of the host page and the host's own tokens don't leak into ebb.
 *   - `setEbbKeyScope`/`setEbbThemeScope` point ebb's global keydown
 *     listeners and its dark-mode/font toggles at this root element instead
 *     of `window`/`<html>`, so a debater's ebb theme choice or a keyboard
 *     shortcut typed into the host's own grid doesn't reach past the panel.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Toaster } from "sonner";

import AppRoot from "./components/flow/AppRoot";
import ResumeFlow from "./components/flow/ResumeFlow";
import { BridgeHost } from "./components/BridgeHost";
import ConfigFileSync from "./components/ConfigFileSync";
import ConsentDialog from "./components/collab/ConsentDialog";
import ContactPickerDialog from "./components/collab/ContactPickerDialog";
import InviteWatch from "./components/collab/InviteWatch";
import JoinDialog from "./components/collab/JoinDialog";
import RejoinDialog from "./components/collab/RejoinDialog";
import ShareSheet from "./components/collab/ShareSheet";
import { DesktopMenu } from "./components/DesktopMenu";
import MotionRoot from "./components/MotionRoot";
import NavigatorHost from "./components/NavigatorHost";
import QuitGuard from "./components/QuitGuard";
import MigrationDialog from "./components/start/MigrationDialog";
import NewFlowDialog from "./components/start/NewFlowDialog";
import SettingsPanel from "./components/settings/SettingsPanel";
import ThemeSync from "./components/ThemeSync";
import { TooltipProvider } from "./components/ui/tooltip";
import UpdateChip from "./components/update/UpdateChip";
import { UpdateProvider } from "./components/update/UpdateProvider";
import { executeCommand } from "./lib/commands/commands";
import { openFlowFromPicker } from "./lib/commands/fileCommands";
import { navigateToFlow, type FlowNavigator } from "./lib/commands/flowNav";
import { setEbbKeyScope } from "./lib/keymap/scope";
import { useFlowStore } from "./lib/store/useFlowStore";
import { setEbbThemeScope } from "./lib/theme/themeScope";

// Tokens and Handsontable theming for `.ebb-scope` live in
// `styles/ebb-scope.css`, imported from the host app's Tailwind entry
// (`app/globals.css`) rather than here - `@theme` registration only takes
// effect for CSS Tailwind's build actually walks from that entry, the same
// reason `themes.css` is `@import`-ed there instead of from a component.

/**
 * An entry point from ebb's old start screen (New flow / Open / Join /
 * Settings, plus a chosen recent flow), invoked from the round workspace's
 * "ebb Flow tools" dropdown (`EbbFlowToolsMenu`, in debate-round) so those
 * stay one click away regardless of which tab is active. Handled here, once
 * this embed is mounted, rather than in the dropdown itself: opening a path
 * or joining a session both need `NavigatorHost`/collab machinery that only
 * exists while this embed is mounted, and selecting the pinned ebb tab is
 * what mounts it.
 */
export type EbbFlowToolAction =
    | { type: "new" }
    | { type: "open" }
    | { type: "open-path"; path: string }
    | { type: "join" }
    | { type: "settings" };

export interface EbbFlowEmbedProps {
    className?: string;
    /** A tool action queued by the host before or while mounting this embed.
     *  Consumed once (see `onPendingActionHandled`). */
    pendingAction?: EbbFlowToolAction | null;
    /** Called synchronously once `pendingAction` has been handled, so the
     *  host can clear it and not re-run it on the next render. */
    onPendingActionHandled?: () => void;
}

export function EbbFlowEmbed({
    className,
    pendingAction,
    onPendingActionHandled,
}: EbbFlowEmbedProps): React.JSX.Element {
    const rootRef = useRef<HTMLDivElement>(null);
    const [path, setPath] = useState<string | null>(null);
    const [isNew, setIsNew] = useState(false);

    useEffect(() => {
        setEbbKeyScope(rootRef.current);
        setEbbThemeScope(rootRef.current);
        return () => {
            setEbbKeyScope(null);
            setEbbThemeScope(null);
        };
    }, []);

    // React flushes effects bottom-up, so on the mount that first brings this
    // embed on screen, `NavigatorHost`'s own effect (registering the live
    // `FlowNavigator`) has already run by the time this one fires — safe for
    // the "open"/"open-path"/"join" cases below, which need it.
    useEffect(() => {
        if (!pendingAction) return;
        onPendingActionHandled?.();
        switch (pendingAction.type) {
            case "new":
                useFlowStore.getState().setNewFlowOpen(true);
                break;
            case "open":
                void openFlowFromPicker();
                break;
            case "open-path":
                navigateToFlow(pendingAction.path);
                break;
            case "join":
                executeCommand("collab.join");
                break;
            case "settings":
                useFlowStore.getState().setSettingsOpen(true);
                break;
        }
    }, [pendingAction, onPendingActionHandled]);

    const navigator = useMemo<FlowNavigator>(
        () => ({
            openPath: (p, opts) => {
                setPath(p);
                setIsNew(!!opts?.isNew);
            },
            toStart: () => {
                setPath(null);
                setIsNew(false);
            },
        }),
        [],
    );

    return (
        <div
            ref={rootRef}
            className={
                "ebb-scope relative flex h-full w-full flex-col overflow-hidden" +
                (className ? ` ${className}` : "")
            }
        >
            <DesktopMenu />
            <BridgeHost />
            <NavigatorHost navigator={navigator} />
            <QuitGuard />
            <ThemeSync />
            <ConfigFileSync />
            <InviteWatch />
            <TooltipProvider>
                <UpdateProvider>
                    <MotionRoot>
                        <div className="min-h-0 flex-1">
                            {path ? <AppRoot path={path} isNew={isNew} /> : <ResumeFlow />}
                        </div>
                        <UpdateChip />
                    </MotionRoot>
                    <SettingsPanel />
                    <NewFlowDialog />
                    <MigrationDialog onMigrated={() => {}} />
                    <ContactPickerDialog />
                    <RejoinDialog />
                    <JoinDialog />
                    <ShareSheet />
                    <ConsentDialog />
                </UpdateProvider>
            </TooltipProvider>
            <Toaster position="bottom-center" />
        </div>
    );
}

export default EbbFlowEmbed;
