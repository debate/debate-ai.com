import type { Metadata } from "next"
import { Suspense } from "react"
import { LibraryPageContent } from "./LibraryPageContent"

export const metadata: Metadata = {
  title: "My Library",
  description:
    "Manage every document, saved flow, and shared file linked to your account — open, rename, duplicate, share, upload, and delete from one place",
}

/**
 * `/library` — the account's file manager (see docs/features/user-library.md):
 * Reason Editor documents, cloud-saved flows and rounds, and the shared-file
 * library (your own shared files plus the public Topic Starter packs and
 * everything other users have published).
 */
export default function LibraryPage() {
  return (
    <Suspense>
      <LibraryPageContent />
    </Suspense>
  )
}
