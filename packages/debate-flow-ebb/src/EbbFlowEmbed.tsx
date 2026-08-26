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
import NewFlowDialog from "./components/start/NewFlowDialog";
import SettingsPanel from "./components/settings/SettingsPanel";
import StartScreen from "./components/start/StartScreen";
import ThemeSync from "./components/ThemeSync";
import { TooltipProvider } from "./components/ui/tooltip";
import UpdateChip from "./components/update/UpdateChip";
import { UpdateProvider } from "./components/update/UpdateProvider";
import type { FlowNavigator } from "./lib/commands/flowNav";
import { setEbbKeyScope } from "./lib/keymap/scope";
import { setEbbThemeScope } from "./lib/theme/themeScope";

// Tokens and Handsontable theming for `.ebb-scope` live in
// `styles/ebb-scope.css`, imported from the host app's Tailwind entry
// (`app/globals.css`) rather than here - `@theme` registration only takes
// effect for CSS Tailwind's build actually walks from that entry, the same
// reason `themes.css` is `@import`-ed there instead of from a component.

export interface EbbFlowEmbedProps {
    className?: string;
}

export function EbbFlowEmbed({ className }: EbbFlowEmbedProps): React.JSX.Element {
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
                            {path ? <AppRoot path={path} isNew={isNew} /> : <StartScreen />}
                        </div>
                        <UpdateChip />
                    </MotionRoot>
                    <SettingsPanel />
                    <NewFlowDialog />
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
