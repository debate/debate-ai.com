"use client"

/**
 * Where QwkSearch's consent screen sends the visitor back when the browser
 * extension started "Sign in with QwkSearch" (packages/debate-qwksearch/src/lib/connect.ts,
 * EXTENSION_CALLBACK_PATH). The extension is watching this tab: it reads the
 * code off the URL, closes the tab and finishes the link itself, so this page
 * only covers the moment before that, or a tab the extension lost track of.
 */
import { useEffect, useState } from "react"

export default function QwkSearchExtensionCompletePage() {
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    setDenied(new URLSearchParams(window.location.search).get("error") === "access_denied")
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm text-center space-y-3">
        <p className="text-sm font-medium">
          {denied ? "QwkSearch sign-in was cancelled." : "Finishing QwkSearch sign-in…"}
        </p>
        <p className="text-sm text-muted-foreground">
          This tab closes itself once the extension picks it up. If it stays open, close it and
          choose Sign in with QwkSearch again from the extension.
        </p>
      </div>
    </div>
  )
}
