"use client"

/**
 * @fileoverview The "Load sample data" bar at the top of the Coaching and
 * Research workspaces.
 *
 * Fills the workspace with sample data built from real cards in the corpus
 * (see `lib/sample-data/`), so the panels can be tried before the squad has
 * any work of its own. The sample stays in this browser and never syncs to
 * the account; the same button clears it again.
 */

import { useEffect, useState } from "react"
import { Database, Loader2, Trash2 } from "lucide-react"
import { Button } from "@debate-ai/ui/primitives/button"
import { fetchSampleCards } from "../../lib/sample-data/sample-cards"
import {
  clearWorkspaceSampleData,
  hasWorkspaceSampleData,
  loadWorkspaceSampleData,
  type SampleWorkspace,
} from "../../lib/sample-data/workspace-sample-data"

/**
 * Sample data toggle for one workspace.
 *
 * @param props.workspace - Which workspace's sample to load or clear.
 * @param props.onChange - Called after the sample is loaded or cleared, so the hub can remount its panels.
 * @returns The bar element.
 */
export function SampleDataBar({ workspace, onChange }: { workspace: SampleWorkspace; onChange: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // localStorage is client-only; read it after hydration.
  useEffect(() => setLoaded(hasWorkspaceSampleData(workspace)), [workspace])

  const load = async () => {
    setBusy(true)
    setError(null)
    try {
      const cards = await fetchSampleCards()
      loadWorkspaceSampleData(workspace, cards)
      setLoaded(true)
      onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const clear = () => {
    clearWorkspaceSampleData(workspace)
    setLoaded(false)
    setError(null)
    onChange()
  }

  return (
    <section
      aria-label="Sample data"
      className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-muted-foreground" aria-live="polite">
          {error ??
            (loaded
              ? "Showing sample data built from real cards in the database. It stays in this browser and isn't saved to your account."
              : "Try the workspace with sample data built from real cards in the database. Nothing is saved to your account.")}
        </p>
      </div>
      {loaded ? (
        <Button variant="outline" size="sm" onClick={clear} className="shrink-0 self-start sm:self-auto">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Clear sample data
        </Button>
      ) : (
        <Button size="sm" onClick={load} disabled={busy} className="shrink-0 self-start sm:self-auto">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Database className="h-4 w-4" aria-hidden="true" />}
          {busy ? "Loading…" : "Load sample data"}
        </Button>
      )}
    </section>
  )
}
