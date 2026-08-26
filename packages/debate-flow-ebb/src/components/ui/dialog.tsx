"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "@phosphor-icons/react";
import * as React from "react";

import { asChildProps } from "./as-child";
import { focusActiveHot } from "../../lib/grid/hotInstance";
import { cn } from "../../lib/utils";

// z-[100], not the usual z-50: embedded in a host page (EbbFlowEmbed), ebb
// sits inside the host's own dialog, which portals to document.body at the
// shadcn-conventional z-50 too. Since base-ui's portal is a separate sibling
// of that host dialog rather than a descendant of it, equal z-index does not
// reliably resolve to document order across the two - this dialog needs to
// outrank the host's, not just its own siblings.

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
    return <DialogPrimitive.Root {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
    return <DialogPrimitive.Portal {...props} />;
}

function DialogClose({
    asChild,
    children,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Close> & { asChild?: boolean }) {
    return (
        <DialogPrimitive.Close
            data-slot="dialog-close"
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

function DialogOverlay({
    className,
    animated = true,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Backdrop> & {
    animated?: boolean;
}) {
    return (
        <DialogPrimitive.Backdrop
            data-slot="dialog-overlay"
            className={cn(
                "fixed inset-0 z-[100] bg-scrim",
                animated &&
                    "ease-out-quart data-[open]:animate-in data-[open]:fade-in-0 data-[open]:duration-200 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:duration-150",
                className,
            )}
            {...props}
        />
    );
}

function DialogContent({
    className,
    children,
    showCloseButton = true,
    animated = true,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Popup> & {
    showCloseButton?: boolean;
    // Keyboard-summoned surfaces (search palette) opt out of enter/exit
    // animation entirely: motion on a many-times-a-day path reads as latency.
    animated?: boolean;
}) {
    return (
        <DialogPortal>
            <DialogOverlay animated={animated} />
            <DialogPrimitive.Popup
                data-slot="dialog-content"
                // Closing an overlay over the flow hands focus straight back to
                // the grid instead of Base UI's default (the trigger), so the
                // next keystroke edits a cell rather than doing nothing.
                finalFocus={() => (focusActiveHot() ? false : true)}
                className={cn(
                    "fixed top-[50%] left-[50%] z-[100] grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-card p-6 shadow-lg outline-none sm:max-w-lg",
                    animated &&
                        "ease-out-quart duration-200 data-[closed]:duration-150 data-[open]:animate-in data-[open]:fade-in-0 motion-safe:data-[open]:zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 motion-safe:data-[closed]:zoom-out-95",
                    className,
                )}
                {...props}
            >
                {children}
                {showCloseButton && (
                    <DialogPrimitive.Close
                        data-slot="dialog-close"
                        className="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
                    >
                        <X />
                        <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                )}
            </DialogPrimitive.Popup>
        </DialogPortal>
    );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="dialog-header"
            className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
            {...props}
        />
    );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title
            data-slot="dialog-title"
            className={cn("text-lg leading-none font-semibold text-balance", className)}
            {...props}
        />
    );
}

function DialogDescription({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description
            data-slot="dialog-description"
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle };
