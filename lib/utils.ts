import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Synchronizes application state with URL search parameters for shareable, bookmarkable URLs.
 *
 * This utility manages URL state in two ways:
 * - **Reading**: When called without arguments, returns current URL parameters as an object
 * - **Writing**: When provided a state object, updates URL parameters without page reload
 *
 * @template T - The expected shape of the state object (defaults to Record<string, string>)
 *
 * @param stateObject - Key-value pairs to sync to URL. Use `null` or empty string to remove a parameter.
 * @param options - Configuration options
 * @param options.addToBrowserHistory - If `true`, creates a new history entry (back button navigates to previous state). If `false` (default), replaces current history entry.
 * @param options.removeNullish - If `true`, removes parameters with `null`, `undefined`, or empty string values. Default: `true`
 *
 * @returns The current URL state as a key-value object, or `undefined` in SSR context
 *
 * @example
 * // Read current URL state
 * const { view, q } = setStateInURL<{ view?: string; q?: string }>();
 *
 * @example
 * // Update URL state (replaces history)
 * setStateInURL({ view: "search", q: "debate" });
 *
 * @example
 * // Update URL state (adds to history - enables back button)
 * setStateInURL({ view: "results" }, { addToBrowserHistory: true });
 *
 * @example
 * // Remove a parameter by setting it to null or empty string
 * setStateInURL({ q: null }); // or { q: "" }
 */
export function setStateInURL<T extends Record<string, string | null | undefined> = Record<string, string>>(
  stateObject?: Partial<T>,
  options: {
    addToBrowserHistory?: boolean;
    removeNullish?: boolean;
  } = {}
): Partial<T> | undefined {
  const { addToBrowserHistory = false, removeNullish = true } = options;

  // Server-side rendering guard
  if (typeof window === "undefined") return undefined;

  const url = new URL(window.location.href);

  // Update URL parameters if state object provided
  if (stateObject && Object.keys(stateObject).length > 0) {
    Object.entries(stateObject).forEach(([key, value]) => {
      // Remove parameter if value is nullish or empty (when removeNullish is true)
      if (removeNullish && (value === null || value === undefined || value === "")) {
        url.searchParams.delete(key);
      } else if (value != null) {
        url.searchParams.set(key, String(value));
      }
    });

    // Update browser history
    const historyMethod = addToBrowserHistory ? "pushState" : "replaceState";
    window.history[historyMethod]({}, "", url);
  }

  // Return current URL parameters as object
  return Object.fromEntries(url.searchParams.entries()) as Partial<T>;
}
