/**
 * @fileoverview The app dock's navigation destinations, in dock order.
 *
 * Lifted out of `CategoryDock` because two other places need the same list:
 * `AppFrameProvider` (to decide which paths are opened in the app frame
 * rather than by a full route change) and the Alt+<n> keyboard shortcuts.
 * Keeping one array means the shortcut numbering, the dock order and the
 * framed-route set can never drift apart.
 */

import { dockNavLabel } from "./dock-nav-paths"
import {
  IconCollectiveMind,
  IconFlowFlower,
  IconRead,
  IconRoundsYoutube,
  IconVsAi,
} from "../ui/icons"

export interface DockNavItem {
  href: string
  label: string
  icon: any
}

export const NAV_ITEMS: DockNavItem[] = [
  { href: "/videos", label: dockNavLabel("/videos"), icon: IconRoundsYoutube },
  { href: "/cards", label: dockNavLabel("/cards"), icon: IconCollectiveMind },
  { href: "/debate", label: dockNavLabel("/debate"), icon: IconFlowFlower },
  // Practice vs AI — a full timed round against an AI opponent, from the
  // `debate-practice-vs-ai` package.
  { href: "/versus-ai", label: dockNavLabel("/versus-ai"), icon: IconVsAi },
  { href: "/doc", label: dockNavLabel("/doc"), icon: IconRead },
  // No "Tools" icon here on purpose: the tools catalog is reached from the
  // sidebar nav tree (its "Apps" heading and the Coaching/Research/Practice
  // sections) and from the Settings menu's "All Tools" entry and Tools
  // submenu. Keeping it out holds the dock to five destinations, which is
  // what lets the sidebar-hosted instance fit inside the sidebar column
  // instead of reaching across it — see `DockInstance`'s `embedded` prop.
]

export { DOCK_NAV_HREFS, DOCK_NAV_LABELS, isDockNavPath } from "./dock-nav-paths"
