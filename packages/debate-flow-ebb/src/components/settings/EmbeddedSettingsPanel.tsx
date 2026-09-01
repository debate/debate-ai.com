"use client";

/**
 * @fileoverview ebb's settings, mounted directly into a host page instead of
 * ebb's own full-screen `SettingsPanel` dialog — used by the app-wide
 * `/settings` page so a signed-in user's flow-editor preferences sit
 * alongside every other app's settings, grouped by app, rather than only
 * reachable from inside a live flow.
 *
 * `.ebb-scope` scopes ebb's design tokens the same way `EbbFlowEmbed` does
 * (see that file's docstring) so they don't leak onto the rest of the host
 * page. `TooltipProvider` is required here too since `SettingsPanelBody`
 * uses ebb's `Tip` component, normally supplied by `EbbFlowEmbed`'s own
 * provider tree, which isn't otherwise present outside a mounted flow.
 */

import { TooltipProvider } from "../ui/tooltip";

import SettingsPanelBody from "./SettingsPanelBody";

export interface EmbeddedSettingsPanelProps {
    className?: string;
}

export function EmbeddedSettingsPanel({ className }: EmbeddedSettingsPanelProps) {
    return (
        <div
            className={
                "ebb-scope bg-background text-foreground flex h-full min-h-0 flex-col overflow-hidden" +
                (className ? ` ${className}` : "")
            }
        >
            <TooltipProvider>
                <SettingsPanelBody />
            </TooltipProvider>
        </div>
    );
}

export default EmbeddedSettingsPanel;
