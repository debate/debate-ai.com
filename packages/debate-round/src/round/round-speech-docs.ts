/**
 * @fileoverview The speech docs of a round, for `@debate-ai/timer`'s
 * "Play with speech doc" view (`SpeechDocPlaybackDialog`, opened from the
 * joined round recording).
 *
 * A speech's doc is the editor document linked to it (`state/speechDocLinks.ts`)
 * when there is one, else the flow's own `speechDocs[speech]` markdown — the
 * same choice `hooks/useSpeechWordStats.ts` makes. Both of a round's flows
 * share its speeches, so the selected flow is tried first and then the
 * round's other flows.
 *
 * @module round/round-speech-docs
 */

import { fetchLinkedDocumentHtml } from "../hooks/useSpeechWordStats"
import { getSpeechDocLink, speechDocLinkScope } from "../state/speechDocLinks"
import { useFlowStore } from "../state/store"
import type { Flow } from "../types/flow"

/** The flow speech doc for `speechName`: the selected flow's, else another flow of its round's. */
export function findFlowSpeechDoc(
  flows: ReadonlyArray<Pick<Flow, "id" | "roundId" | "speechDocs">>,
  current: Pick<Flow, "id" | "roundId" | "speechDocs"> | null | undefined,
  speechName: string,
): string | null {
  const wanted = speechName.toUpperCase()
  const docOf = (flow: Pick<Flow, "speechDocs">) => {
    for (const [name, doc] of Object.entries(flow.speechDocs ?? {})) {
      if (name.toUpperCase() === wanted && doc?.trim()) return doc
    }
    return null
  }
  if (current) {
    const own = docOf(current)
    if (own) return own
  }
  if (current?.roundId == null) return null
  for (const flow of flows) {
    if (flow.id === current.id || flow.roundId !== current.roundId) continue
    const doc = docOf(flow)
    if (doc) return doc
  }
  return null
}

/**
 * Loads a speech's doc for the selected flow's round: the linked editor
 * document's HTML, else the flow speech doc. Reads the flow store when
 * called, so it can be passed around as a stable function.
 */
export async function loadRoundSpeechDoc(speechName: string): Promise<string | null> {
  const { flows, selected } = useFlowStore.getState()
  const current = (flows[selected] as Flow | undefined) ?? null
  const link = getSpeechDocLink(speechDocLinkScope(current), speechName)
  if (link) {
    try {
      const { html } = await fetchLinkedDocumentHtml(link.docId)
      if (html.trim()) return html
    } catch {
      // Fall back to the flow's own speech doc.
    }
  }
  return findFlowSpeechDoc(flows as Flow[], current, speechName)
}
