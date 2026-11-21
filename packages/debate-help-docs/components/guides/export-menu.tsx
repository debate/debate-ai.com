"use client"
/**
 * @file export-menu.tsx
 * @description The "Export" menu on the Synergy Slayer pages and in their
 * reading mode: saves what the reader sees (one page, or the whole loaded
 * paper in reading mode) as a PDF, a Word `.docx`, Markdown, or a Google Doc.
 *
 * - **PDF** prints a clean copy of the text from a hidden frame; the browser's
 *   print dialog saves it ("Save as PDF").
 * - **Word (.docx)** runs the text through Debate Editor's own `.docx` writer
 *   (`@debate-ai/editor`, loaded on click), so the file opens in Verbatim
 *   with underlining and highlights. If the editor can't read the HTML, a
 *   Word-readable `.doc` of the same HTML is saved instead.
 * - **Markdown (.md)** converts the rendered text (`htmlToMarkdown`), keeping
 *   `==highlights==` and `<u>underlining</u>`.
 * - **Google Doc** copies the formatted text and opens a new Google Doc
 *   (docs.new) to paste it into: there's no Google sign-in on the docs site.
 *
 * The conversions live in `@debate-ai/reading-mode/export`.
 */
import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Download, FileDown, FileText, FileType, Printer } from "lucide-react"
import {
  exportFileName,
  exportableHtml,
  htmlToMarkdown,
  standaloneHtmlDocument,
} from "@debate-ai/reading-mode/export"
import { cn } from "../../lib/utils"
import { buttonVariants } from "../ui/button"

type ExportKind = "pdf" | "docx" | "md" | "gdoc"

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Prints `documentHtml` from a hidden frame, so the site's chrome stays out of the PDF. */
function printDocument(documentHtml: string) {
  const frame = document.createElement("iframe")
  frame.setAttribute("aria-hidden", "true")
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;"
  document.body.appendChild(frame)
  const remove = () => setTimeout(() => frame.remove(), 1000)
  frame.onload = () => {
    const win = frame.contentWindow
    if (!win) return remove()
    win.addEventListener("afterprint", remove)
    win.focus()
    win.print()
  }
  frame.srcdoc = documentHtml
}

/** A `.docx` from Debate Editor's writer, or null when it couldn't read the HTML. */
async function docxBlob(html: string): Promise<Blob | null> {
  try {
    const [{ parseHtml }, { exportDocxBlob }] = await Promise.all([
      import("@debate-ai/editor/html-bridge"),
      import("@debate-ai/editor/engine"),
    ])
    const parsed = parseHtml(html)
    if (!parsed.ok) return null
    return await exportDocxBlob(parsed.doc)
  } catch (error) {
    console.warn("[docs export] .docx writer failed, saving a Word HTML file instead", error)
    return null
  }
}

async function copyRichText(html: string, text: string) {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ])
  } else {
    await navigator.clipboard.writeText(text)
  }
}

/**
 * The Export button and its menu. `getRoot` returns the element holding the
 * text to export (looked up on click, so it can be content loaded later).
 */
export function ExportMenu({
  title,
  getRoot,
  align = "start",
}: {
  title: string
  getRoot: () => Element | null
  align?: "start" | "end"
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<ExportKind | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Leave reading mode open: this Escape was for the menu.
        event.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey, true)
    }
  }, [open])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  const run = async (kind: ExportKind) => {
    setOpen(false)
    const root = getRoot()
    if (!root) {
      setNotice("Nothing to export yet")
      return
    }
    setBusy(kind)
    try {
      const html = exportableHtml(root)
      if (kind === "pdf") {
        printDocument(standaloneHtmlDocument(title, html))
        setNotice("Choose “Save as PDF” in the print dialog")
      } else if (kind === "md") {
        download(new Blob([htmlToMarkdown(root, title)], { type: "text/markdown;charset=utf-8" }), exportFileName(title, "md"))
      } else if (kind === "docx") {
        const blob = await docxBlob(`<h1>${title.replace(/</g, "&lt;")}</h1>${html}`)
        if (blob) download(blob, exportFileName(title, "docx"))
        else download(new Blob([standaloneHtmlDocument(title, html)], { type: "application/msword" }), exportFileName(title, "doc"))
      } else {
        // Copy while this page still has focus (the clipboard needs it), then open the doc.
        await copyRichText(standaloneHtmlDocument(title, html), htmlToMarkdown(root, title))
        const tab = window.open("https://docs.new", "_blank")
        if (tab) tab.opener = null
        setNotice(tab === null ? "Copied. Open docs.new and paste (Ctrl+V)" : "Copied. Paste it into the new Google Doc (Ctrl+V)")
      }
    } catch (error) {
      console.warn("[docs export] failed", error)
      setNotice("Export failed")
    } finally {
      setBusy(null)
    }
  }

  const items: { kind: ExportKind; label: string; icon: typeof FileText }[] = [
    { kind: "pdf", label: "PDF", icon: Printer },
    { kind: "docx", label: "Word (.docx)", icon: FileType },
    { kind: "md", label: "Markdown (.md)", icon: FileText },
    { kind: "gdoc", label: "Google Doc", icon: FileDown },
  ]

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy !== null}
        title="Export as PDF, Word, Markdown or a Google Doc"
        className={cn(buttonVariants({ size: "sm", className: "gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground" }))}
        onClick={() => setOpen((value) => !value)}
      >
        {notice ? <Check /> : <Download />}
        {notice ?? "Export"}
        <ChevronDown />
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-50 mt-1 min-w-44 rounded-md border bg-fd-popover p-1 text-sm text-fd-popover-foreground shadow-md",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-fd-accent hover:text-fd-accent-foreground"
              onClick={() => void run(kind)}
            >
              <Icon className="size-3.5 text-fd-muted-foreground" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** The page toolbar's Export menu: exports this page's text (`.synergy-slayer-doc`). */
export function PageExportMenu({ title }: { title: string }) {
  return <ExportMenu title={title} getRoot={() => document.querySelector(".synergy-slayer-doc")} />
}
