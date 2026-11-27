/**
 * @file textarea.tsx
 * @description shadcn text input and multi-line text area, themed with the docs' Fumadocs colour tokens.
 */
import * as React from "react"

import { cn } from "../../lib/utils"

const FIELD =
  "w-full min-w-0 rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm text-fd-foreground shadow-xs outline-none transition-[color,box-shadow] placeholder:text-fd-muted-foreground focus-visible:ring-[3px] focus-visible:ring-fd-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-500"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(FIELD, "h-9", className)} {...props} />
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(FIELD, "min-h-16 resize-y", className)} {...props} />
}

export { Input, Textarea }
