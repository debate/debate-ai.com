"use client";

import { Skeleton } from "../ui/skeleton";

/**
 * Held frame mirroring the editor shell, so opening or resuming a round never
 * flashes a blank screen that reads as data loss.
 */
export function EditorLoadingSkeleton() {
    return (
        <div className="flex h-full flex-col" data-testid="editor-loading">
            <div className="border-border bg-card flex h-12 flex-none items-center border-b px-4">
                <Skeleton className="h-4 w-48" />
            </div>
            <div className="flex min-h-0 flex-1">
                <div className="border-border bg-card w-[220px] shrink-0 space-y-2 border-r p-2">
                    <Skeleton className="h-7 w-full" />
                    <Skeleton className="h-7 w-full" />
                    <Skeleton className="h-7 w-2/3" />
                </div>
                <div className="flex-1 p-4">
                    <Skeleton className="h-40 w-full" />
                </div>
            </div>
        </div>
    );
}
