import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";

/**
 * Kbd — a single keycap. Presentational only; callers pass the resolved key
 * text as children (use `keyHintFor` for live keymap bindings). The double
 * bottom border reads as a physical key without leaning on shadow.
 */
export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
    return (
        <kbd
            className={cn(
                "text-foreground border-border bg-muted inline-flex min-w-[22px] items-center justify-center rounded border border-b-2 px-1 py-px font-mono text-[11px] whitespace-nowrap",
                className,
            )}
            {...props}
        />
    );
}
