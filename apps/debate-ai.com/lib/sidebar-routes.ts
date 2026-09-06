/**
 * @fileoverview App-facing entry point for the "does this route get the tool
 * sidebar?" predicates.
 *
 * The predicates themselves live in `debate-videos`, next to the link data
 * they are derived from (`components/category-gallery/sidebar-routes.ts`) —
 * see that module for how matching works and why it is prefix-based. This
 * file exists so app code keeps importing them from one app-local path.
 *
 * Used by `CategoryDock` (to suppress its own fixed dock wherever a
 * sidebar-hosted one is already on screen) and `AppSidebarShell` (to decide
 * whether to wrap a page in the generic sidebar) — see `AppSidebarShell`'s
 * file comment for why this exists.
 */

export { hasEmbeddedDock, isGenericToolSidebarRoute } from "debate-videos"
