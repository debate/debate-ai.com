import { ExternalLink, Trophy } from "lucide-react"

/**
 * Tabroom lives on its own origin and pulls in its own bundle, so embedding it
 * in a frame loaded all of that on every visit to this route and left the tab
 * pointed at a document the shell knew nothing about. A link out hands the
 * user the same site in a tab they control, for nothing.
 */
export function TournamentsPage() {
  return (
    <div className="flex min-h-[calc(100dvh-70px)] w-full items-center justify-center p-6 md:min-h-screen">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <span className="mx-auto mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-accent text-foreground">
          <Trophy className="size-5" />
        </span>
        <h1 className="text-xl font-semibold text-foreground">Tournaments</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Invitations, pairings, and results are on Tabroom. It opens in its own tab so this one stays
          on your round.
        </p>
        <a
          href="https://beta.tabroom.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Open Tabroom
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  )
}
