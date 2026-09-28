/**
 * @fileoverview Opt-in client-side debug logging.
 *
 * Diagnostic `console.log` calls left switched on in production turn the
 * browser console into noise, which is where real errors have to be spotted.
 * Routing them through `debugLog` keeps the instrumentation in the source but
 * silent for visitors: it prints during `vite dev`, and in a deployed build
 * only after someone opts in from the console with
 *
 *     localStorage.setItem("debate-ai:debug", "1")
 *
 * `console.warn`/`console.error` are deliberately not wrapped — a real failure
 * should always be visible.
 *
 * @module lib/debug-log
 */

/** localStorage key that switches debug logging on in a deployed build. */
export const DEBUG_LOG_KEY = "debate-ai:debug";

/**
 * Vite's build-time environment, which it injects into every bundled module.
 * Declared locally because this app's tsconfig does not pull in
 * `vite/client`, and the optional chaining below covers any runtime (a test,
 * the Worker) where it is absent.
 */
interface ViteImportMeta {
  env?: { DEV?: boolean };
}

/**
 * Whether debug logging is currently on.
 *
 * Read per call rather than cached, so flipping the flag in the console takes
 * effect without a reload. localStorage throws in some privacy modes, so the
 * read is guarded.
 *
 * @returns `true` in dev, or when the opt-in flag is set.
 */
export function isDebugLoggingEnabled(): boolean {
  if ((import.meta as unknown as ViteImportMeta).env?.DEV === true) return true;
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(DEBUG_LOG_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * `console.log`, but only when debug logging is on.
 *
 * @param args - Anything `console.log` accepts.
 */
export function debugLog(...args: unknown[]): void {
  if (isDebugLoggingEnabled()) console.log(...args);
}
