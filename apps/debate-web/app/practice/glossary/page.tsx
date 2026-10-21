import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of the glossary, merged into Formats, Rules & Glossary at
 * `/practice/rules`. It permanently redirects to its "glossary" tab.
 */

export const metadata: Metadata = {
  title: "Glossary of Terms",
  alternates: { canonical: "/practice/rules?section=glossary" },
}

export default function LegacyGlossaryPage() {
  permanentRedirect("/practice/rules?section=glossary")
}
