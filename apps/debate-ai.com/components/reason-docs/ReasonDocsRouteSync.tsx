"use client"

/**
 * Resolves which document the editor route shows, from the URL — the React
 * half of `lib/reason-docs/route-selection`, which owns the rules and their
 * tests.
 *
 * The sidebar panels (`ReasonDocsSidebarPanels`) route a click to
 * `/reason-editor?doc=<file name>` for an owned document or `?topic=<file name>`
 * for a public one. Provider state alone already covers a client-side hop, but
 * not a reload, a pasted link, or a hard navigation — `/videos` renders its own
 * layout branch, so a click there can land on a freshly booted editor with an
 * empty provider. Reading the selection back off the URL is what makes "click a
 * file, get *that* file in CardMirror" hold from every sidebar rather than only
 * from the ones that hop client-side.
 *
 * A name this client can't place is asked of the server once
 * (`openPublicByRef` → `/api/topic-starters/by-path`) before the URL is allowed
 * to fall through to the first file: the public library is bigger than the
 * catalogue the sidebar loads, and a reader following a shared link may have no
 * documents of their own at all. That lookup is what makes a filename URL work
 * for anyone whenever the file it names is public.
 *
 * Renders nothing; mount once, inside a `<Suspense>` (it reads
 * `useSearchParams`).
 */

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  parseSelectionParams,
  resolveSelection,
  selectionParamsKey,
} from "@/lib/reason-docs/route-selection"
import { useReasonDocs } from "./ReasonDocsProvider"

export function ReasonDocsRouteSync() {
  const searchParams = useSearchParams()
  const {
    documents,
    topicItems,
    activeId,
    topicDocument,
    loaded,
    openDocument,
    selectTopicDocument,
    openPublicByRef,
  } = useReasonDocs()

  const params = parseSelectionParams(searchParams)
  const paramsKey = selectionParamsKey(params)
  // One application per URL: once it has opened that file the reader is free
  // to pick another from the sidebar without this dragging them back. The
  // sidebar rewrites the query on every pick, which is what re-arms it.
  const appliedKeyRef = useRef<string | null>(null)
  // Refs whose server lookup already came back empty. Re-resolving without the
  // lookup is what lets the URL fall through to the normal fallback instead of
  // asking for the same missing name on every render.
  const [deadRefs, setDeadRefs] = useState<readonly string[]>([])
  const lookupsRef = useRef(new Set<string>())

  useEffect(() => {
    // Documents and topic starters arrive together with `loaded`; resolving
    // before then would look the name up in an empty list.
    if (!loaded) return

    const applyParams = appliedKeyRef.current !== paramsKey

    const selection = resolveSelection({
      ...params,
      documents,
      topics: topicItems,
      applyParams,
      hasSelection: activeId != null || topicDocument != null,
      allowLookup: !deadRefs.includes(params.topic ?? params.doc ?? ""),
    })
    if (!selection) {
      appliedKeyRef.current = paramsKey
      return
    }

    if (selection.kind === "lookup") {
      // Still unapplied: the URL has not opened anything yet, and must be
      // re-resolved once the lookup answers.
      if (lookupsRef.current.has(selection.ref)) return
      lookupsRef.current.add(selection.ref)
      void openPublicByRef(selection.ref).then((found) => {
        if (!found) setDeadRefs((prev) => (prev.includes(selection.ref) ? prev : [...prev, selection.ref]))
      })
      return
    }

    appliedKeyRef.current = paramsKey

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
    deadRefs,
    openDocument,
    selectTopicDocument,
    openPublicByRef,
  ])

  return null
}
