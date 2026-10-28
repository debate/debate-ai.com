"use client"

/**
 * The SVAR file manager over the sidebar's files — ported from quick search's
 * REASON sidebar (`react-reason-editor-sidebar`'s `FileManagerModal`), which
 * is the same `@svar-ui/react-filemanager` widget. That port only handled
 * opening and creating; this one routes every action SVAR offers back to the
 * real rows, so the file manager is a full way to organise files rather than
 * a view of them:
 *
 *  - open (double-click / Enter) → the file opens in this app's editor;
 *  - add file / add folder / upload → `createDocument` / `importFiles`;
 *  - rename, delete, move (drag, cut + paste), copy (copy + paste) → the
 *    provider's rename, delete, move and duplicate;
 *  - download → the same `.docx` download the sidebar menu offers.
 *
 * The public Topic Starters sit under a read-only "Topic Starters" folder
 * (`lib/reason-docs/file-manager-data.ts`). Copying or moving out of it saves
 * your own copy; copying or moving one of your files into it publishes it
 * (admins only); renaming or deleting inside it is refused.
 *
 * Loaded on demand by `FileManagerDialog`: SVAR's widget and its stylesheet
 * are only fetched once someone opens the file manager.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Filemanager, Willow, WillowDark, type IApi } from "@svar-ui/react-filemanager"
import "@svar-ui/react-filemanager/all.css"
import "./filemanager.css"
import { toast } from "sonner"
import {
  buildFileManagerData,
  isTopicPath,
  ownedFolderIdOf,
  type FileManagerRef,
} from "../../lib/reason-docs/file-manager-data"
import type { ReasonDocument } from "../types"
import type { TopicStarterItem } from "../topic-starters/TopicStarterTree"

export interface FileManagerHandlers {
  onOpenDocument: (id: number) => void
  onOpenTopic: (item: TopicStarterItem) => void
  onCreate: (parentId: number | null, isFolder: boolean) => void
  onUpload: (files: File[], parentId: number | null) => void
  onRename: (id: number, title: string) => void
  onDelete: (id: number) => void
  onMove: (id: number, parentId: number | null) => void
  onDuplicate: (id: number, parentId: number | null) => void
  onDownload: (id: number) => void
  onDownloadTopic: (item: TopicStarterItem) => void
  onSaveTopicCopy: (item: TopicStarterItem, parentId: number | null) => void
  onPublish: (id: number, topicParentId: number | null) => void
}

export interface FileManagerViewProps extends FileManagerHandlers {
  documents: ReasonDocument[]
  topics: TopicStarterItem[]
  /** Called after a file is opened, so the dialog can close. */
  onDone: () => void
}

const READ_ONLY = "Topic Starters are read-only. Save a copy to your files to change one."

/** True when the page is in dark mode, so SVAR's skin matches the app's. */
function useDarkMode(): boolean {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    const read = () => setDark(root.classList.contains("dark"))
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])
  return dark
}

export default function FileManagerView({ documents, topics, onDone, ...handlers }: FileManagerViewProps) {
  const { data, refs } = useMemo(() => buildFileManagerData(documents, topics), [documents, topics])
  const dark = useDarkMode()

  // SVAR calls `init` once; everything it closes over is read through refs
  // so its handlers always see the current rows and callbacks.
  const refsRef = useRef(refs)
  refsRef.current = refs
  const topicsRef = useRef(topics)
  topicsRef.current = topics
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const init = useCallback((api: IApi) => {
    const refOf = (path: string): FileManagerRef | undefined => refsRef.current.get(path)
    const topicOf = (ref: FileManagerRef | undefined) =>
      ref?.kind === "topic" ? topicsRef.current.find((item) => item.id === ref.id) : undefined
    /** The catalogue folder a path inside Topic Starters names, or `null`
     *  for the Topic Starters folder itself. */
    const topicFolderIdOf = (path: string): number | null => {
      const ref = refOf(path)
      return ref?.kind === "topic" && ref.isFolder ? ref.id : null
    }

    api.on("open-file", ({ id }: { id: string }) => {
      const ref = refOf(id)
      if (!ref || ref.isFolder) return
      if (ref.kind === "document") handlersRef.current.onOpenDocument(ref.id)
      else {
        const item = topicOf(ref)
        if (item) handlersRef.current.onOpenTopic(item)
      }
      onDoneRef.current()
    })

    api.on("download-file", ({ id }: { id: string }) => {
      const ref = refOf(id)
      if (!ref || ref.isFolder) return
      if (ref.kind === "document") handlersRef.current.onDownload(ref.id)
      else {
        const item = topicOf(ref)
        if (item) handlersRef.current.onDownloadTopic(item)
      }
    })

    // Intercepted rather than observed: an action the catalogue refuses has
    // to be stopped before SVAR applies it to its own copy of the tree, or the
    // view would show a rename that never happened.
    api.intercept("create-file", ({ file, parent }: { file: { name?: string; type?: string; file?: File }; parent: string }) => {
      const parentId = ownedFolderIdOf(parent, refsRef.current)
      if (parentId === undefined) {
        toast.error(isTopicPath(parent) ? READ_ONLY : "Pick one of your folders first.")
        return false
      }
      if (file?.file) handlersRef.current.onUpload([file.file], parentId)
      else handlersRef.current.onCreate(parentId, file?.type === "folder")
      // The row appears when the provider's list updates; letting SVAR add its
      // own placeholder as well would show the file twice until then.
      return false
    })

    api.intercept("rename-file", ({ id, name }: { id: string; name: string }) => {
      const ref = refOf(id)
      if (!ref || ref.kind !== "document") {
        toast.error(READ_ONLY)
        return false
      }
      const title = name.trim()
      if (title) handlersRef.current.onRename(ref.id, title)
      return false
    })

    api.intercept("delete-files", ({ ids }: { ids: string[] }) => {
      const owned = ids.map(refOf).filter((ref): ref is FileManagerRef => ref?.kind === "document")
      if (owned.length < ids.length) toast.error(READ_ONLY)
      owned.forEach((ref) => handlersRef.current.onDelete(ref.id))
      return false
    })

    /** Move and copy share one router: what a transfer *means* depends on
     *  which area each row comes from and which area it lands in. */
    const transfer = (ids: string[], target: string, kind: "move" | "copy") => {
      const intoTopics = isTopicPath(target)
      const ownedTarget = ownedFolderIdOf(target, refsRef.current)
      for (const id of ids) {
        const ref = refOf(id)
        if (!ref) continue
        if (ref.kind === "topic") {
          if (intoTopics) {
            toast.error(READ_ONLY)
            continue
          }
          const item = topicOf(ref)
          if (item && ownedTarget !== undefined) handlersRef.current.onSaveTopicCopy(item, ownedTarget)
          continue
        }
        if (intoTopics) {
          if (ref.isFolder) toast.error("Only files can be added to Topic Starters.")
          else handlersRef.current.onPublish(ref.id, topicFolderIdOf(target))
          continue
        }
        if (ownedTarget === undefined) continue
        if (kind === "copy") handlersRef.current.onDuplicate(ref.id, ownedTarget)
        else handlersRef.current.onMove(ref.id, ownedTarget)
      }
      return false
    }
    api.intercept("move-files", ({ ids, target }: { ids: string[]; target: string }) => transfer(ids, target, "move"))
    api.intercept("copy-files", ({ ids, target }: { ids: string[]; target: string }) => transfer(ids, target, "copy"))
  }, [])

  const Theme = dark ? WillowDark : Willow
  return (
    <div className="debate-filemanager-shell flex min-h-0 flex-1 flex-col overflow-hidden rounded-md">
      <Theme>
        <Filemanager data={data} mode="table" init={init} />
      </Theme>
    </div>
  )
}
