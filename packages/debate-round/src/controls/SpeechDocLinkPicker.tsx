/**
 * @fileoverview Dropdown beside a speech's name that links the speech to one
 * of the user's recently modified editor documents as its speech doc (see
 * `state/speechDocLinks.ts`), or back to the flow's own speech doc. The
 * linked doc is what the timer bar's word counts are calculated from.
 *
 * @module controls/SpeechDocLinkPicker
 */

"use client"

import { useState } from "react"
import { Check, FileText, Link2, Loader2, Unlink } from "lucide-react"
import { Button } from "../ui/primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/primitives/dropdown-menu"
import { cn } from "../ui/lib/utils"
import type { Flow } from "../types/flow"
import {
  clearSpeechDocLink,
  recentEditorDocuments,
  setSpeechDocLink,
  speechDocLinkScope,
  type EditorDocumentSummary,
  type SpeechDocLink,
} from "../state/speechDocLinks"

type ListState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; docs: EditorDocumentSummary[] }
  | { kind: "error" }

export interface SpeechDocLinkPickerProps {
  flow: Flow | null | undefined
  speechName: string
  /** The speech's current link, from `useSpeechWordStats`. */
  link: SpeechDocLink | null
  className?: string
}

function formatUpdated(value: string | number): string {
  const ms = typeof value === "number" ? (value < 1e12 ? value * 1000 : value) : Date.parse(value)
  if (!Number.isFinite(ms)) return ""
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function SpeechDocLinkPicker({ flow, speechName, link, className }: SpeechDocLinkPickerProps) {
  const scope = speechDocLinkScope(flow)
  const [list, setList] = useState<ListState>({ kind: "idle" })

  const loadDocuments = () => {
    setList({ kind: "loading" })
    fetch("/api/doc/documents")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((rows) => setList({ kind: "loaded", docs: recentEditorDocuments(rows) }))
      .catch(() => setList({ kind: "error" }))
  }

  if (!scope) return null

  return (
    <DropdownMenu onOpenChange={(open) => open && loadDocuments()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-5 w-5 shrink-0", link ? "text-primary" : "text-muted-foreground", className)}
          title={link ? `${speechName} speech doc: ${link.title}` : `Link a document as the ${speechName} speech doc`}
          aria-label={`Choose ${speechName} speech doc`}
        >
          <Link2 className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs">{speechName} speech doc</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => clearSpeechDocLink(scope, speechName)} className="text-xs">
          <FileText className="mr-2 h-3.5 w-3.5" />
          <span className="flex-1">Flow speech doc</span>
          {!link && <Check className="h-3.5 w-3.5" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">
          Recently modified documents
        </DropdownMenuLabel>
        {list.kind === "loading" && (
          <DropdownMenuItem disabled className="text-xs">
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Loading…
          </DropdownMenuItem>
        )}
        {list.kind === "error" && (
          <DropdownMenuItem disabled className="text-xs">Couldn't load your documents.</DropdownMenuItem>
        )}
        {list.kind === "loaded" && list.docs.length === 0 && (
          <DropdownMenuItem disabled className="text-xs">No documents yet.</DropdownMenuItem>
        )}
        {list.kind === "loaded" &&
          list.docs.map((doc) => (
            <DropdownMenuItem
              key={doc.id}
              onClick={() => setSpeechDocLink(scope, speechName, doc)}
              className="text-xs"
            >
              <Link2 className="mr-2 h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">{doc.title}</span>
              <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">{formatUpdated(doc.updatedAt)}</span>
              {link?.docId === doc.id && <Check className="ml-1 h-3.5 w-3.5 shrink-0" />}
            </DropdownMenuItem>
          ))}
        {link && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => clearSpeechDocLink(scope, speechName)} className="text-xs">
              <Unlink className="mr-2 h-3.5 w-3.5" /> Unlink “{link.title}”
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
