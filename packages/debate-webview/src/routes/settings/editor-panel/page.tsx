"use client"

import { EditorSettingsPanel } from "../../../components/settings/EditorSettingsPanel"

/**
 * The settings panel on its own, without `/settings`' header. `/settings`
 * renders the same `EditorSettingsPanel` directly rather than embedding this
 * route in an iframe; it stays for existing links.
 */
export default function EditorSettingsPanelPage() {
  return <EditorSettingsPanel />
}
