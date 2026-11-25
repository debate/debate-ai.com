/**
 * @file journal-masthead.tsx
 * @description The masthead at the top of the Research Journal page
 * (`content/docs/journal/index.mdx`), laid out like an academic journal's home
 * page: a typeset cover, the journal's title block (publisher, ISSN,
 * format, coverage, indexing) and a row of section links.
 *
 * The facts live in `JOURNAL` below so the page and any later issue pages
 * read one source. Entries still marked "pending" are placeholders: no ISSN
 * has been assigned and no indexing service lists the journal yet, so none is
 * shown rather than an invented one. Registered in `mdx-components.tsx`.
 */
import type { ReactNode } from "react"

/** The journal's own details. Replace a "pending" value once it is real. */
export const JOURNAL = {
  name: "Debate AI Research Journal",
  shortName: "DARJ",
  publisher: "Debate AI Institute",
  publisherUrl: "https://debate-ai.com",
  issnOnline: "Pending assignment",
  issnPrint: "Not issued (online only)",
  format: "Online web editions · video overview, DOI and references list per paper",
  coverage: "Volume 1 (2026) – Present",
  archive: "Zenodo (DOI prefix 10.5281)",
  indexing: "Pending: no abstracting or indexing service lists the journal yet.",
  submissionsEmail: "support@debate-ai.com",
} as const

/** The section links under the title block; anchors are headings on the page. */
const NAV: { label: string; href: string }[] = [
  { label: "Home", href: "/docs/journal" },
  { label: "Issue Contents", href: "#issue-contents" },
  { label: "Contributor Notes", href: "#contributor-notes" },
  { label: "Submissions", href: "#submissions" },
  { label: "Call for Papers", href: "#call-for-papers" },
]

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <dt className="shrink-0 font-semibold text-fd-foreground sm:w-36">{label}</dt>
      <dd className="text-fd-muted-foreground">{children}</dd>
    </div>
  )
}

export function JournalMasthead() {
  return (
    <section
      aria-label={`${JOURNAL.name} masthead`}
      className="not-prose my-6 overflow-hidden rounded-lg border bg-fd-card text-fd-card-foreground"
    >
      <nav
        aria-label="Journal sections"
        className="flex flex-wrap gap-x-1 gap-y-1 border-b bg-fd-accent/40 px-4 py-2 text-xs font-medium uppercase tracking-wide"
      >
        {NAV.map((item, i) => (
          <span key={item.href} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className="text-fd-muted-foreground">·</span>}
            <a href={item.href} className="text-fd-primary hover:underline">
              {item.label}
            </a>
          </span>
        ))}
      </nav>

      <div className="flex flex-col gap-6 p-5 sm:flex-row">
        <div
          aria-hidden
          className="mx-auto flex h-48 w-32 shrink-0 flex-col justify-between rounded-sm border-2 border-fd-primary bg-fd-background p-3 font-serif shadow-sm sm:mx-0"
        >
          <span className="text-[0.6rem] uppercase tracking-[0.2em] text-fd-muted-foreground">
            {JOURNAL.publisher}
          </span>
          <span className="text-2xl font-bold leading-none text-fd-primary">
            {JOURNAL.shortName}
          </span>
          <span className="border-t border-fd-primary pt-1 text-[0.6rem] uppercase tracking-[0.15em] text-fd-muted-foreground">
            Research Journal
            <br />
            Vol. 1 · 2026
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl font-bold leading-tight text-fd-foreground">
            {JOURNAL.name}
          </h2>
          <p className="mt-1 text-sm text-fd-muted-foreground">
            Published by{" "}
            <a href={JOURNAL.publisherUrl} className="text-fd-primary hover:underline">
              {JOURNAL.publisher}
            </a>
          </p>

          <dl className="mt-4 flex flex-col gap-1.5 text-sm">
            <Detail label="ISSN (online)">{JOURNAL.issnOnline}</Detail>
            <Detail label="ISSN (print)">{JOURNAL.issnPrint}</Detail>
            <Detail label="Format">{JOURNAL.format}</Detail>
            <Detail label="Issue Coverage">{JOURNAL.coverage}</Detail>
            <Detail label="Archived in">{JOURNAL.archive}</Detail>
          </dl>

          <div className="mt-4 border-t pt-3 text-sm">
            <p className="font-semibold text-fd-foreground">Abstracted and Indexed in:</p>
            <p className="text-fd-muted-foreground">{JOURNAL.indexing}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
