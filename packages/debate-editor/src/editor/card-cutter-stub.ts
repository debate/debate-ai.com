/**
 * No-op fallback for `@cardcutter/browser` when the separately-
 * versioned card-cutter package isn't checked out alongside this repo
 * (e.g. production builds, or a fresh clone). The vite alias points
 * here in that case, so the port's dynamic import always resolves;
 * this module simply registers nothing, leaving the feature inert.
 */
export {};
