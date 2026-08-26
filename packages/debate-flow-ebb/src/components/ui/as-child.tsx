import type * as React from "react";

/**
 * Base UI parts compose onto a child via a `render` prop; the `ui/` wrappers
 * expose an `asChild` boolean instead. When set, the lone child element becomes
 * the rendered element and Base UI merges its own props (event handlers,
 * className, style) onto it.
 */
export function asChildProps(
    asChild: boolean | undefined,
    children: React.ReactNode,
): { render: React.ReactElement } | { children: React.ReactNode } {
    return asChild ? { render: children as React.ReactElement } : { children };
}
