"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import * as React from "react";

import { cn } from "../../lib/utils";

function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
    return (
        <SliderPrimitive.Root
            data-slot="slider"
            className={cn(
                "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
                className,
            )}
            {...props}
        >
            <SliderPrimitive.Control
                data-slot="slider-control"
                className="relative flex w-full grow items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col"
            >
                <SliderPrimitive.Track
                    data-slot="slider-track"
                    className={cn(
                        // No overflow-hidden: the thumb sits inside the Track and
                        // would be clipped to the track's thickness otherwise.
                        "bg-muted relative grow rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5",
                    )}
                >
                    <SliderPrimitive.Indicator
                        data-slot="slider-range"
                        className={cn(
                            "bg-primary absolute rounded-full data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
                        )}
                    />
                    <SliderPrimitive.Thumb
                        data-slot="slider-thumb"
                        index={0}
                        className="border-primary bg-background ring-ring/50 block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
                    />
                </SliderPrimitive.Track>
            </SliderPrimitive.Control>
        </SliderPrimitive.Root>
    );
}

export { Slider };
