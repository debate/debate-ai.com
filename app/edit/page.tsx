import React from "react"
import type { Metadata } from "next"
import { Footer } from "@/components/debate/Footer"

export const metadata: Metadata = {
  title: "REASON Docs",
  description: "Research Evidence And Speech Organizer Notes",
}

export default function EditorPage() {
  return (
    <div className="min-h-screen flex flex-col pb-20 lg:pb-0">
      <div className="flex-1 min-h-0">
        <iframe
          src="https://qwksearch.com/docs"
          className="w-full h-full border-0"
          title="Editor"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <Footer />
    </div>
  )
}
