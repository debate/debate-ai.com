"use client"

/**
 * Resolves which document the editor route shows, from the URL — the React
 * half of `lib/reason-docs/route-selection`, which owns the rules and their
 * tests.
 *
 * The sidebar panels (`ReasonDocsSidebarPanels`) route a click to
 * `/reason-editor?doc=<id>` for an owned document or `?topic=<id>` for a
 * public topic starter. Provider state alone already covers a client-side
 * hop, but not a reload, a pasted link, or a hard navigation — `/videos`
 * renders its own layout branch, so a click there can land on a freshly
 * booted editor with an empty provider. Reading the selection back off the
 * URL is what makes "click a file, get *that* file in CardMirror" hold from
 * every sidebar rather than only from the ones that hop client-side.
 *
 * Renders nothing; mount once, inside a `<Suspense>` (it reads
 * `useSearchParams`).
 */

import { useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import {
  parseSelectionParams,
  resolveSelection,
  selectionParamsKey,
} from "@/lib/reason-docs/route-selection"
import { useReasonDocs } from "./ReasonDocsProvider"

export function ReasonDocsRouteSync() {
  const searchParams = useSearchParams()
  const { documents, topicItems, activeId, topicDocument, loaded, openDocument, selectTopicDocument } = useReasonDocs()

  const params = parseSelectionParams(searchParams)
  const paramsKey = selectionParamsKey(params)
  // One application per URL: once it has opened that file the reader is free
  // to pick another from the sidebar without this dragging them back. The
  // sidebar rewrites the query on every pick, which is what re-arms it.
  const appliedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    // Documents and topic starters arrive together with `loaded`; resolving
    // before then would look the id up in an empty list.
    if (!loaded) return

    const applyParams = appliedKeyRef.current !== paramsKey
    appliedKeyRef.current = paramsKey

    const selection = resolveSelection({
      ...params,
      documentIds: documents.filter((d) => !d.isFolder).map((d) => d.id),
      topicIds: topicItems.filter((t) => !t.isFolder).map((t) => t.id),
      applyParams,
      hasSelection: activeId != null || topicDocument != null,
    })
    if (!selection) return

    if (selection.kind === "topic") {
      const item = topicItems.find((t) => t.id === selection.id)
      if (item) selectTopicDocument(item)
      return
    }
    openDocument(selection.id)
    // `params` is a fresh object each render; `paramsKey` is its stable
    // identity, so the effect keys off that instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loaded,
    paramsKey,
    documents,
    topicItems,
    activeId,
    topicDocument,
    openDocument,
    selectTopicDocument,
  ])

  return null
}
