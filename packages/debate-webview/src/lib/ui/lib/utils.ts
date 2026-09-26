import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Options to configure the behavior of {@link setStateInURL}.
 */
export interface SetStateInURLOptions {
  /**
   * If `true`, the state change will be pushed to the browser history,
   * creating a new history entry so the back button works.
   * If `false` (default), the current history entry is replaced.
   */
  addToBrowserHistory?: boolean;
  /**
   * If `true` (default), query parameters with `null`, `undefined`, or empty string `""`
   * values will be removed from the URL instead of being serialized.
   */
  removeNullish?: boolean;
}

/**
 * Synchronizes on-page selected state vars with URL
 * parameters for shareable URLs that load those filters.
 *
 * This utility manages URL state in two ways:
 * - **Reading**: When called without arguments, returns current URL parameters as an object
 * - **Writing**: When provided a state object, updates URL parameters without page reload
 *
 * @template T - The expected shape of the state object (defaults to Record<string, string | null | undefined>)
 *
 * @param stateObject - Key-value pairs to sync to URL. Use `null` or empty string to remove a parameter.
 * @param options - Configuration options for history behavior and serialization
 *
 * @returns The current URL state as a key-value object, or `undefined` in SSR context
 *
 * @example
 * // Read current URL state
 * const { view, q } = setStateInURL<{ view?: string; q?: string }>();
 * // Update URL state (replaces history)
 * setStateInURL({ view: "search", q: "debate" });
 * // Update URL state (adds to history - enables back button)
 * setStateInURL({ view: "results" }, { addToBrowserHistory: true });
 * // Remove a parameter by setting it to null or empty string
 * setStateInURL({ q: null }); // or { q: "" }
 */
export function setStateInURL<
  T extends Record<string, string | null | undefined> = Record<string, string | null | undefined>,
>(
  stateObject?: Partial<T>,
  options: SetStateInURLOptions = {},
): Partial<T> | undefined {
  const { addToBrowserHistory = false, removeNullish = true } = options;

  // Server-side rendering guard
  if (typeof window === "undefined") return undefined;

  const url = new URL(window.location.href);

  // Update URL parameters if state object provided
  if (stateObject && Object.keys(stateObject).length > 0) {
    Object.entries(stateObject).forEach(([key, value]) => {
      // Remove parameter if value is nullish or empty (when removeNullish is true)
      if (
        removeNullish &&
        (value === null || value === undefined || value === "")
      ) {
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
