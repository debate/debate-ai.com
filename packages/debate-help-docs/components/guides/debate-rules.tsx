/**
 * @file debate-rules.tsx
 * @description Layout blocks for the "Debate formats & rules" guide: a
 * responsive card grid, format and rule cards, and a per-format rules panel.
 * Registered in `mdx-components.tsx` so the MDX page can use them directly.
 */
import type { ReactNode } from "react"

/** Responsive grid of `FormatCard`s or `RuleCard`s. */
export function RuleGrid({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  )
}

function CardShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 text-sm text-card-foreground shadow-sm [&_li]:my-1.5 [&_strong]:text-foreground [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
      {children}
    </div>
  )
}

/** One debate format: who competes, a one-line summary, and its key sections. */
export function FormatCard({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string
  title: string
  summary: string
  children?: ReactNode
}) {
  return (
    <CardShell>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
      <h3 className="mb-1.5 text-base font-semibold">{title}</h3>
      <p className="text-muted-foreground">{summary}</p>
      {children}
    </CardShell>
  )
}

/** A titled rule or checklist block. */
export function RuleCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <CardShell>
      <h3 className="mb-1.5 text-base font-semibold">{title}</h3>
      <div className="text-muted-foreground">{children}</div>
    </CardShell>
  )
}

/** A format's rules: heading, audience badge, summary, then its rule cards. */
export function FormatRules({
  title,
  badge,
  summary,
  children,
}: {
  title: string
  badge: string
  summary: string
  children: ReactNode
}) {
  return (
    <section className="not-prose my-6 rounded-2xl border border-border bg-muted/30 p-5 md:p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          {badge}
        </span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{summary}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}
