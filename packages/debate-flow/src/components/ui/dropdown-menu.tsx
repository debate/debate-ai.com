"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import * as React from "react";

import { asChildProps } from "./as-child";
import { cn } from "../../lib/utils";

function DropdownMenu({ ...props }: React.ComponentProps<typeof MenuPrimitive.Root>) {
    return <MenuPrimitive.Root {...props} />;
}

function DropdownMenuTrigger({
    asChild,
    children,
    ...props
}: React.ComponentProps<typeof MenuPrimitive.Trigger> & { asChild?: boolean }) {
    return (
        <MenuPrimitive.Trigger
            data-slot="dropdown-menu-trigger"
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

function DropdownMenuContent({
    className,
    align,
    ...props
}: React.ComponentProps<typeof MenuPrimitive.Popup> &
    Pick<React.ComponentProps<typeof MenuPrimitive.Positioner>, "align">) {
    return (
        <MenuPrimitive.Portal>
            <MenuPrimitive.Positioner align={align} sideOffset={4}>
                <MenuPrimitive.Popup
                    data-slot="dropdown-menu-content"
                    className={cn(
                        // z-[100], matching dialog.tsx: this portals to document.body,
                        // a sibling of (not a descendant of) a host page's own dialog,
                        // so it needs to outrank that dialog's z-50, not just tie it.
                        "z-[100] max-h-(--available-height) min-w-[8rem] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md ease-out-quart data-[closed]:duration-100 motion-safe:data-[side=bottom]:slide-in-from-top-2 motion-safe:data-[side=left]:slide-in-from-right-2 motion-safe:data-[side=right]:slide-in-from-left-2 motion-safe:data-[side=top]:slide-in-from-bottom-2 data-[closed]:animate-out data-[closed]:fade-out-0 motion-safe:data-[closed]:zoom-out-95 data-[open]:animate-in data-[open]:fade-in-0 motion-safe:data-[open]:zoom-in-95",
                        className,
                    )}
                    {...props}
                />
            </MenuPrimitive.Positioner>
        </MenuPrimitive.Portal>
    );
}

function DropdownMenuItem({
    className,
    onSelect,
    onClick,
    ...props
}: Omit<React.ComponentProps<typeof MenuPrimitive.Item>, "onClick"> & {
    // Base UI's Item exposes selection as onClick (fired for keyboard and
    // pointer alike); expose it here as onSelect for a stable call-site API.
    onSelect?: () => void;
    onClick?: React.ComponentProps<typeof MenuPrimitive.Item>["onClick"];
}) {
    return (
        <MenuPrimitive.Item
            data-slot="dropdown-menu-item"
            onClick={onSelect ?? onClick}
            className={cn(
                "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
                className,
            )}
            {...props}
        />
    );
}

function DropdownMenuGroup({ ...props }: React.ComponentProps<typeof MenuPrimitive.Group>) {
    return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuGroupLabel({
    className,
    ...props
}: React.ComponentProps<typeof MenuPrimitive.GroupLabel>) {
    return (
        <MenuPrimitive.GroupLabel
            data-slot="dropdown-menu-group-label"
            className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)}
            {...props}
        />
    );
}

export {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuGroup,
    DropdownMenuGroupLabel,
};
