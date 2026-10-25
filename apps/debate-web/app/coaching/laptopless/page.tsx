import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of the Laptop-less Debating guide, moved into Coaching at
 * `/coaching`. It permanently redirects to its "laptopless" tab.
 */

export const metadata: Metadata = {
  title: "Laptop-less Debating",
  alternates: { canonical: "/coaching?section=laptopless" },
}

export default function LegacyLaptoplessPage() {
  permanentRedirect("/coaching?section=laptopless")
}
