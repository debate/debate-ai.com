"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CaretDown, Check } from "@phosphor-icons/react";
import * as React from "react";

import { cn } from "../../lib/utils";

function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
    return <SelectPrimitive.Root {...props} />;
}

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
    return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
    className,
    size = "default",
    children,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & { size?: "sm" | "default" }) {
    return (
        <SelectPrimitive.Trigger
            data-slot="select-trigger"
            data-size={size}
            className={cn(
                "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                className,
            )}
            {...props}
        >
            {children}
            <SelectPrimitive.Icon render={<CaretDown className="size-4 opacity-50" />} />
        </SelectPrimitive.Trigger>
    );
}

function SelectContent({
    className,
    children,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Popup> &
    Pick<
        React.ComponentProps<typeof SelectPrimitive.Positioner>,
        "side" | "align" | "sideOffset"
    >) {
    const { side, align, sideOffset = 4, ...popupProps } = props;
    return (
        <SelectPrimitive.Portal>
            <SelectPrimitive.Positioner
                side={side}
                align={align}
                sideOffset={sideOffset}
                alignItemWithTrigger={false}
                // z-[100]: see dialog.tsx - a host page's own dialog can portal to
                // document.body at the same z-50 this would otherwise use.
                className="z-[100]"
            >
                <SelectPrimitive.Popup
                    data-slot="select-content"
                    className={cn(
                        "bg-popover text-popover-foreground ease-out-quart data-[closed]:duration-100 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 motion-safe:data-[closed]:zoom-out-95 motion-safe:data-[open]:zoom-in-95 motion-safe:data-[side=bottom]:slide-in-from-top-2 motion-safe:data-[side=left]:slide-in-from-right-2 motion-safe:data-[side=right]:slide-in-from-left-2 motion-safe:data-[side=top]:slide-in-from-bottom-2 relative max-h-(--available-height) min-w-[8rem] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
                        className,
                    )}
                    {...popupProps}
                >
                    {children}
                </SelectPrimitive.Popup>
            </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
    );
}

function SelectItem({
    className,
    children,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
    return (
        <SelectPrimitive.Item
            data-slot="select-item"
            className={cn(
                "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                className,
            )}
            {...props}
        >
            <span className="absolute right-2 flex size-3.5 items-center justify-center">
                <SelectPrimitive.ItemIndicator>
                    <Check className="size-4" />
                </SelectPrimitive.ItemIndicator>
            </span>
            <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        </SelectPrimitive.Item>
    );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
