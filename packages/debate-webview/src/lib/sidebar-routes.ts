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
 *
 * `ownsItsLayout` is the opt-out both of those consult: a tree destination
 * that renders its own full-height workspace chrome (`/debate`) gets neither
 * the generic sidebar nor the dock suppression that goes with it.
 *
 * `hostsOwnSidebarDock` is the half of that opt-out which keeps the dock
 * suppression: `/doc`'s REASON workspace skips the generic sidebar but mounts
 * the dock at the top of its own (see `components/qwksearch/SidebarWithAppDock`),
 * so the floating instance would be a second dock rather than the only one.
 */

export {
  hasEmbeddedDock,
  hostsOwnSidebarDock,
  isGenericToolSidebarRoute,
  ownsItsLayout,
} from "debate-videos"
