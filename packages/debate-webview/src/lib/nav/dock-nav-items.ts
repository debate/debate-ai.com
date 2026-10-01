/**
 * @fileoverview The app dock's navigation destinations, in dock order.
 *
 * Lifted out of `CategoryDock` so the dock icons, the Alt+<n> keyboard
 * shortcuts and the idle prefetch (`dock-idle-prefetch.ts`) read one array
 * and can never drift apart.
 */

import { dockNavLabel } from "./dock-nav-paths"
import {
  IconCollectiveMind,
  IconDoc,
  IconFlowFlower,
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
  { href: "/research/cards", label: dockNavLabel("/research/cards"), icon: IconCollectiveMind },
  { href: "/debate", label: dockNavLabel("/debate"), icon: IconFlowFlower },
  // Practice vs AI — a full timed round against an AI opponent, from the
  // `debate-practice-vs-ai` package.
{ href: "/practice/versus-ai", label: dockNavLabel("/practice/versus-ai"), icon: IconVsAi },
  // Quick search (qwksearch.com, framed at /doc), marked with that site's own
  // app icon (`icon-doc.png`, a copy of qwksearch.com/apple-touch-icon.png)
  // rather than a generic page: it reads as a different tool from the rest.
  { href: "/doc", label: dockNavLabel("/doc"), icon: IconDoc },
  // No "Tools" icon here on purpose: the tools catalog is reached from the
  // sidebar nav tree (its "Apps" heading and the Coaching/Research/Practice
  // sections) and from the Settings menu's "All Tools" entry and Tools
  // submenu. Keeping it out holds the dock to five destinations, which is
  // what lets the sidebar-hosted instance fit inside the sidebar column
  // instead of reaching across it — see `DockInstance`'s `embedded` prop.
]

export { DOCK_NAV_HREFS, DOCK_NAV_LABELS, isDockNavPath } from "./dock-nav-paths"
