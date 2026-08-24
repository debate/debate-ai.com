/**
 * CardMirror Lite (2026-08-18): a BUILD VARIANT — not a fork — for
 * school environments whose vendor audits require no AI features and
 * no internet communication (field driver: a district denied the app
 * over unblockable student-supplied AI keys; their own recommendation
 * was "a web-hosted version that does not contain AI features").
 *
 * What Lite removes, everywhere it surfaces (settings rows, tabs,
 * ribbon/palette commands, pills, panels):
 *   - every AI feature (student-supplied API keys are the audit issue)
 *   - collaboration (card sharing, co-editing, account linking)
 *   - plugins (GitHub installs), update checks, voice-model downloads
 *
 * Enforcement is layered, not just cosmetic: the web deployment ships
 * a `connect-src 'self'` Content-Security-Policy (the BROWSER refuses
 * outbound requests), and the desktop Lite main process installs a
 * session-level request blocker. Hiding the UI is the third layer.
 *
 * The flag: `VITE_LITE=1` at build time (both the web build and the
 * desktop renderer build go through vite). Same codebase, second
 * artifact — Lite inherits every editor fix forever.
 */

let overrideForTests: boolean | null = null;

export function isLiteBuild(): boolean {
  if (overrideForTests !== null) return overrideForTests;
  try {
    return (
      (import.meta as { env?: Record<string, string | undefined> }).env?.['VITE_LITE'] === '1'
    );
  } catch {
    return false;
  }
}

/** Test hook: force the flag (null = back to the build value). */
export function __setLiteForTests(value: boolean | null): void {
  overrideForTests = value;
}
