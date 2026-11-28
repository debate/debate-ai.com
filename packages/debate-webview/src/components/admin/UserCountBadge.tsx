"use client"

import { cn } from "../../ui/lib/utils"

/**
 * Small count pill, styled like the unread-notification badge in the account
 * menu (`UnreadBadge` in `app-sidebar/nav-user.tsx`) but showing the whole
 * number. Renders nothing until there is a count, so a failed fetch leaves no
 * badge behind.
 */
export function UserCountBadge({ count, className }: { count: number | null; className?: string }) {
  if (count === null) return null
  return (
    <span
      data-testid="user-count-badge"
      title={`${count.toLocaleString()} users`}
      className={cn(
        "inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none tabular-nums text-primary-foreground",
        className,
      )}
    >
      {count.toLocaleString()}
    </span>
  )
}
