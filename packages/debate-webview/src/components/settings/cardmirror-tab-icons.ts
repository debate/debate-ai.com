/**
 * @fileoverview Sidebar icons for CardMirror's settings tabs
 * (`CARDMIRROR_SETTINGS_TABS`), shared by the two Settings sidebars that list
 * them: `/settings` and the research settings.
 *
 * @module components/settings/cardmirror-tab-icons
 */

import type { ComponentType } from "react"
import { Accessibility, FolderOpen, Keyboard, MessageSquareText, Palette, PenLine, Settings, Users } from "lucide-react"

export const CARDMIRROR_TAB_ICONS: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  general: Settings,
  files: FolderOpen,
  appearance: Palette,
  accessibility: Accessibility,
  editing: PenLine,
  shortcuts: Keyboard,
  "comments-ai": MessageSquareText,
  pairing: Users,
}
