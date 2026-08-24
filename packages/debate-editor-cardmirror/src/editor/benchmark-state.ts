/**
 * Shared benchmark-active flag.
 *
 * Lives in its own module so the hot paths that CHECK it
 * (`dispatchTransaction` in `index.ts`, the multi-pane shell) don't
 * statically import `benchmark.ts` — which drags the whole benchmark
 * harness plus its embedded sample-card text into the main chunk for a
 * diagnostics tool that only runs from the (lazily-loaded) Settings
 * dialog.
 */

let benchmarkActive = false;

export function isBenchmarkActive(): boolean {
  return benchmarkActive;
}

export function setBenchmarkActive(active: boolean): void {
  benchmarkActive = active;
}
