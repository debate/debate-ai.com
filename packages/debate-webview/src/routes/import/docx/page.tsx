"use client"

import { Suspense } from "react"
import { DocxImportReceiver } from "@debate-ai/reason-docs/docs/import/DocxImportReceiver"

/**
 * `/import/docx` — the browser extension's "Open in Debate AI editor" on a
 * link to a `.docx`. Imports the file into My Files › Imported and opens it in
 * the editor; see `DocxImportReceiver`.
 */
export default function DocxImportPage() {
  // useSearchParams() needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <DocxImportReceiver />
    </Suspense>
  )
}
