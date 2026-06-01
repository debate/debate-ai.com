import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "CARDS Search",
  description: "Crowdsourced Annotated Research for Debatable Subjects (CARDS)",
}

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
