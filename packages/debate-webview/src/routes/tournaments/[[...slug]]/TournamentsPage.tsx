import { ExternalLink, Trophy } from "lucide-react"

/**
 * Tournaments live on Tabroom. This page links there rather than embedding
 * Tabroom in an `<iframe>`, which loaded that whole site inside this one.
 */
export function TournamentsPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center">
        <Trophy className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold text-foreground">Tournaments</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Invitations, pairings and results are on Tabroom.
        </p>
        <a
          href="https://beta.tabroom.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Open Tabroom
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </div>
    </div>
  )
}
