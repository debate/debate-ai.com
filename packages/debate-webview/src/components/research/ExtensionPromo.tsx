/**
 * @fileoverview The Chrome extension's pitch in the Research Workspace header:
 * an install button for the header's action row and a short list of what the
 * extension adds while you research on other sites. Both are server-renderable.
 *
 * @module components/research/ExtensionPromo
 */

import { Puzzle } from "lucide-react"
import { EXTENSION_STORE_URL } from "../../lib/config/site"

/** What the extension does, in the order a researcher meets it on a page. */
export const EXTENSION_FEATURES = [
  "Already cut? The popup checks the page against your team's cards and the caselist library, with each card's tag, highlights and an AI author rating.",
  "Reading mode opens any long article, PDF or YouTube transcript beside an AI panel.",
  "Select text and press ` to search it on Debate AI cards, Google Scholar, News and more.",
  "Speech and prep timers that keep running in the browser toolbar.",
] as const

/** "Chrome extension" install button, styled like the header's Docs link. */
export function ExtensionInstallLink() {
  return (
    <a
      href={EXTENSION_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Install the Debate AI Chrome extension from the Chrome Web Store"
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
    >
      <Puzzle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      Chrome extension
    </a>
  )
}

/** One-paragraph explanation of the extension's features, for under the header's title. */
export function ExtensionFeatures() {
  return (
    <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      <p className="text-sm text-foreground">
        <Puzzle className="mr-1.5 inline h-4 w-4 align-[-3px] text-primary" aria-hidden="true" />
        Research on any site with the{" "}
        <a href={EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer" className="font-medium underline">
          Debate AI Chrome extension
        </a>
        :
      </p>
      <ul className="flex flex-col gap-1">
        {EXTENSION_FEATURES.map((feature) => (
          <li key={feature} className="flex gap-1.5">
            <span aria-hidden="true">·</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
