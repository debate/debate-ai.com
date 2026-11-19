"use client"

/**
 * `/import/docx` — where the browser extension's "Open in Debate AI editor"
 * (right-click on a link to a `.docx`) lands.
 *
 * Takes the file the extension fetched (or fetches the link itself when there
 * is no handoff), imports it into My Files › Imported as a Debate Editor file,
 * and opens it in the editor. When neither way gets the bytes — a site that
 * needs a sign-in the extension could not use, or the Firefox build without
 * permission for that site — the page says so and offers the link plus a file
 * picker, so the reader can download it and finish the import here.
 *
 * The handoff protocol is in `lib/my-files/docx-handoff.ts`.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "../../ui/primitives/button"
import { OrbitalLoader } from "../../ui/loaders/OrbitalLoader"
import { IMPORT_ACCEPT } from "../../lib/debate-editor/import-files"
import {
  fetchDocx,
  IMPORTED_FOLDER_TITLE,
  parseDocxImportParams,
  takeDocxFromExtension,
} from "../../lib/my-files/docx-handoff"
import { DEBATE_EXTENSION_ID } from "../../lib/topic-starters/local-cache"
import { editorHrefForSelection } from "../../lib/reason-docs/route-selection"
import { useReasonDocs } from "../ReasonDocsProvider"
import { usePersonalUsername } from "../use-personal-username"

type Status =
  | { kind: "fetching" }
  | { kind: "importing"; name: string }
  | { kind: "failed"; error: string }

export function DocxImportReceiver() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { importToImportedFolder, ensureLoaded, documents } = useReasonDocs()
  const username = usePersonalUsername()
  const [status, setStatus] = useState<Status>({ kind: "fetching" })
  const params = parseDocxImportParams(searchParams?.toString() ?? "")

  // The handoff is one-time — the extension forgets the file once it is
  // taken — so a second run of the effect (Strict Mode, a re-render with the
  // same URL) must not ask again.
  const startedRef = useRef(false)
  const documentsRef = useRef(documents)
  documentsRef.current = documents

  const importFile = useCallback(
    async (file: File) => {
      setStatus({ kind: "importing", name: file.name })
      const { created, failures } = await importToImportedFolder([file])
      const first = created[0]
      if (!first) {
        setStatus({ kind: "failed", error: failures[0] ?? `${file.name} could not be imported.` })
        return
      }
      // The folder row may not be in the tree yet on a page that never loaded
      // it, and the editor's address is the file's path inside it.
      const folder =
        first.parentId != null
          ? [{ id: first.parentId, title: IMPORTED_FOLDER_TITLE, parentId: null, isFolder: true }]
          : []
      const href = editorHrefForSelection(
        { kind: "document", id: first.id },
        [...folder, ...created, ...documentsRef.current],
        null,
        username,
      )
      router.replace(href)
    },
    [importToImportedFolder, router, username],
  )

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    ensureLoaded()
    void (async () => {
      let error = "No file was given to import."
      if (params.handoff) {
        const taken = await takeDocxFromExtension(DEBATE_EXTENSION_ID, params.handoff, params.name)
        if (taken.ok) return importFile(taken.file)
        error = taken.error
      }
      if (params.url) {
        const fetched = await fetchDocx(params.url, params.name)
        if (fetched.ok) return importFile(fetched.file)
        error = fetched.error
      }
      setStatus({ kind: "failed", error })
    })()
    // Runs once per visit: the params are read from the URL it opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      {status.kind !== "failed" ? (
        <>
          <OrbitalLoader size="md" />
          <p className="text-sm text-muted-foreground">
            {status.kind === "fetching"
              ? `Getting ${params.name}…`
              : `Adding ${status.name} to My Files › ${IMPORTED_FOLDER_TITLE}…`}
          </p>
        </>
      ) : (
        <>
          <h1 className="text-lg font-semibold">Couldn&apos;t open {params.name}</h1>
          <p className="text-sm text-muted-foreground">{status.error}</p>
          {params.url ? (
            <p className="text-sm">
              Download it from{" "}
              <a className="underline break-all" href={params.url} target="_blank" rel="noreferrer noopener">
                {params.url}
              </a>
              , then choose the downloaded file below.
            </p>
          ) : null}
          <label>
            <input
              type="file"
              accept={IMPORT_ACCEPT}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void importFile(file)
              }}
            />
            <Button asChild>
              <span>Choose a file to import</span>
            </Button>
          </label>
        </>
      )}
    </div>
  )
}
