"use client";

import { useEffect } from "react";

import { setFlowNavigator, type FlowNavigator } from "../lib/commands/flowNav";

export interface NavigatorHostProps {
    /** Live navigator backing the embed's own open-flow / start-screen state. */
    navigator: FlowNavigator;
}

/**
 * Registers the live navigator for commands that run outside React - the
 * keyboard layer and the native menu both dispatch from module scope.
 * Renders nothing; mounted once beside the other app-wide hosts in
 * `EbbFlowEmbed`, which owns the open-flow state this delegates to (there is
 * no Next.js router to read here: the embed is one panel of a host app with
 * its own routing, not a page of its own).
 */
export default function NavigatorHost({ navigator }: NavigatorHostProps) {
    useEffect(() => {
        setFlowNavigator(navigator);
        return () => setFlowNavigator(null);
    }, [navigator]);

    return null;
}
