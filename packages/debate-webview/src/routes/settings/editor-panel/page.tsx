"use client"

import { Suspense } from "react"
import { EditorSettingsPanel } from "../../../components/settings/EditorSettingsPanel"

/**
 * The settings panel on its own, without `/settings`' header. `/settings`
 * renders the same `EditorSettingsPanel` directly rather than embedding this
 * route in an iframe; it stays for existing links.
 */
export default function EditorSettingsPanelPage() {
  // The panel reads its tab from useSearchParams(), which fails the
  // production render with a 500 without a Suspense boundary above it.
  return (
    <Suspense>
      <EditorSettingsPanel />
    </Suspense>
  )
}
