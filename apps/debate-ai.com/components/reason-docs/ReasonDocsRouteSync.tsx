"use client"

/**
 * Resolves which document the editor route shows, from the URL, and keeps the
 * URL naming whichever document is open — the React half of
 * `lib/reason-docs/route-selection`, which owns the rules and their tests.
 *
 * The sidebar panels (`ReasonDocsSidebarPanels`) route a click to
 * `/reason-editor/<the file's name>`. Provider state alone already covers a
 * client-side hop, but not a reload, a pasted link, or a hard navigation —
 * `/videos` renders its own layout branch, so a click there can land on a
 * freshly booted editor with an empty provider. Reading the selection back
 * off the URL is what makes "click a file, get *that* file in CardMirror"
 * hold from every sidebar rather than only from the ones that hop
 * client-side.
 *
 * The write-back half is why this also runs while the reader is on the route:
 * a `?doc=12` link from before named files existed, and a link written before
 * the file was renamed, both get rewritten to the file's current name once
 * the catalogue says what that is. The rewrite goes through
 * `history.replaceState` rather than the router on purpose — `/reason-editor`
 * and `/reason-editor/<slug>` are different Next routes, so routing between
 * them would remount CardMirror (losing the editor's undo history) on every
 * tab switch. Renaming the address is not navigating.
 *
 * Renders nothing; mount once, inside a `<Suspense>` (it reads
 * `useSearchParams`).
 */

import { useEffect, useMemo, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import {
  canonicalEditorUrl,
  parseSelectionParams,
  resolveSelection,
  selectionParamsKey,
  type ReasonDocsCatalog,
} from "@/lib/reason-docs/route-selection"
import { useReasonDocs } from "./ReasonDocsProvider"

export function ReasonDocsRouteSync() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { documents, topicItems, activeId, topicDocument, loaded, openDocument, selectTopicDocument } = useReasonDocs()

  const params = parseSelectionParams(searchParams, pathname)
  const paramsKey = selectionParamsKey(params)
  // One application per URL: once it has opened that file the reader is free
  // to pick another from the sidebar without this dragging them back. The
  // sidebar rewrites the URL on every pick, which is what re-arms it.
  const appliedKeyRef = useRef<string | null>(null)

  // Folders are not openable, so they are not addressable either.
  const catalog: ReasonDocsCatalog = useMemo(
    () => ({
      documents: documents.filter((d) => !d.isFolder).map((d) => ({ id: d.id, title: d.title })),
      topics: topicItems.filter((t) => !t.isFolder).map((t) => ({ id: t.id, title: t.title })),
    }),
    [documents, topicItems],
  )

  useEffect(() => {
    // Documents and topic starters arrive together with `loaded`; resolving
    // before then would look the file up in an empty list.
    if (!loaded) return

    const applyParams = appliedKeyRef.current !== paramsKey
    appliedKeyRef.current = paramsKey

    const selection = resolveSelection({
      ...params,
      catalog,
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
    catalog,
    documents,
    topicItems,
    activeId,
    topicDocument,
    openDocument,
    selectTopicDocument,
  ])

  // Name the open file in the address bar. Compares against
  // `window.location`, which is what the previous run of this effect wrote,
  // rather than the router's pathname — the two are the same only if the
  // router mirrors a `replaceState`, and a stale comparison would rewrite
  // the same URL on every render.
  useEffect(() => {
    if (!loaded || typeof window === "undefined") return
    const selection = topicDocument
      ? ({ kind: "topic", id: topicDocument.id } as const)
      : activeId != null
        ? ({ kind: "document", id: activeId } as const)
        : null
    const next = canonicalEditorUrl(selection, catalog, {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    })
    if (next) window.history.replaceState(null, "", next)
  }, [loaded, activeId, topicDocument, catalog])

  return null
}
