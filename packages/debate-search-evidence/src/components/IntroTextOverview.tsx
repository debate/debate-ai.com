/**
 * @module IntroTextOverview
 * @fileoverview Introductory landing shown when no research card is selected.
 * Shows the CARDS logo and extension download, and points to the features
 * page, which now carries the CARDS overview and vision.
 */

"use client"

import { DownloadAppButton } from "react-native-app-buttons"

export function IntroTextOverview() {

  return (
    <div className="h-full overflow-y-auto p-4 bg-background max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col items-center gap-6 mb-12">
        <div className="flex items-center justify-center gap-8">
          <img
            width="128"
            src="https://i.imgur.com/VbJF0Bx.png"
            alt="Building Blocks Icon"
            className="drop-shadow-sm"
          />
          <div className="flex flex-col gap-2">
            <DownloadAppButton platform="chrome-extension" appId="noecbaibfhbmpapofcdkgchfifmoinfj" />
          </div>
        </div>

        <div className="text-center space-y-2 max-w-2xl">
          <p className="text-muted-foreground">
            Search for evidence and select a card to read it here.
          </p>
          {/* `/research/cards` runs inside the app shell's frame, so break out of it. */}
          <a
            href="/practice/features#cards-vision"
            target="_top"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            About CARDS &rarr;
          </a>
        </div>
      </div>
    </div>
  )
}
