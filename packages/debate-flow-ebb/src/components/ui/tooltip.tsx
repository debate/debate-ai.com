"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import * as React from "react";

import { asChildProps } from "./as-child";
import type { CommandId } from "../../lib/commands/registry";
import { keyHintFor } from "../../lib/keymap/displayChord";
import { useFlowStore } from "../../lib/store/useFlowStore";
import { cn } from "../../lib/utils";

function TooltipProvider({
    delay = 500,
    ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
    return <TooltipPrimitive.Provider delay={delay} {...props} />;
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
    return <TooltipPrimitive.Root {...props} />;
}

function TooltipTrigger({
    asChild,
    children,
    ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger> & { asChild?: boolean }) {
    return (
        <TooltipPrimitive.Trigger
            data-slot="tooltip-trigger"
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

function TooltipContent({
    className,
    side,
    sideOffset = 4,
    children,
    ...props
}: React.ComponentProps<typeof TooltipPrimitive.Popup> &
    Pick<React.ComponentProps<typeof TooltipPrimitive.Positioner>, "side" | "sideOffset">) {
    return (
        <TooltipPrimitive.Portal>
            <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset}>
                <TooltipPrimitive.Popup
                    data-slot="tooltip-content"
                    className={cn(
                        // z-[100]: see dialog.tsx - a host page's own dialog can portal to
                        // document.body at the same z-50 this would otherwise use.
                        "bg-foreground text-background z-[100] flex items-center gap-2 rounded-md px-2 py-1 text-xs shadow-md select-none origin-(--transform-origin) ease-out-quart animate-in fade-in-0 motion-safe:zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 motion-safe:data-[closed]:zoom-out-95 data-[closed]:duration-100",
                        className,
                    )}
                    {...props}
                >
                    {children}
                </TooltipPrimitive.Popup>
            </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
    );
}

interface TipProps {
    label: React.ReactNode;
    command?: CommandId;
    side?: React.ComponentProps<typeof TooltipPrimitive.Positioner>["side"];
    /**
     * Show only on hover, never on focus. Set this on a trigger a dialog
     * auto-focuses on open (e.g. a Close button) so the tip does not pop up
     * unprompted. Base UI opens tooltips on focus-visible only, so programmatic
     * focus-on-open already does not trigger them; the prop is kept to mark
     * that intent at the call site.
     */
    hoverOnly?: boolean;
    children: React.ReactNode;
}

function Tip({ label, command, side, children }: TipProps) {
    const tooltips = useFlowStore((s) => s.tooltips);
    const hint = command ? keyHintFor(command) : null;
    if (!tooltips) return children;
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent side={side}>
                <span>{label}</span>
                {hint && (
                    <kbd
                        data-slot="tooltip-kbd"
                        className="border-background/30 text-background/80 rounded border px-1 font-mono text-[10px]"
                    >
                        {hint}
                    </kbd>
                )}
            </TooltipContent>
        </Tooltip>
    );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Tip };
