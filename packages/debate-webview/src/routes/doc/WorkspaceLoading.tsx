"use client"

import { useEffect, useState } from "react"
import { OrbitalLoader } from "../../ui/loaders/OrbitalLoader"

/**
 * What `/research/docs` shows while the research workspace's chunks download:
 * the orbital "quantum sphere" with a progress bar under it, centred on the
 * page background, instead of an empty white page.
 *
 * `loaded` / `total` count the workspace's dynamic imports that have resolved
 * (see `ResearchAgentEmbed`). The browser gives no byte progress for an
 * `import()`, so between steps the bar creeps on a timer, slowing as it nears
 * the next step, and it never claims 100 % until the workspace is ready.
 */
export function WorkspaceLoading({ loaded, total }: { loaded: number; total: number }) {
  const settled = total > 0 ? loaded / total : 0
  const [creep, setCreep] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      // Ease toward 92 %: each tick closes 4 % of the remaining gap.
      setCreep((value) => value + (0.92 - value) * 0.04)
    }, 120)
    return () => window.clearInterval(timer)
  }, [])

  const percent = Math.round(Math.min(0.99, Math.max(settled, creep)) * 100)

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading research workspace"
      data-testid="research-workspace-loading"
      className="flex h-full w-full flex-col items-center justify-center gap-6 bg-background px-4 text-center"
    >
      <OrbitalLoader size="lg" className="pointer-events-none" />
      <div className="flex w-full max-w-xs flex-col items-center gap-2">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Research workspace loading progress"
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Loading research workspace… {percent}%
        </p>
      </div>
    </div>
  )
}
