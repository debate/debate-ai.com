/**
 * @fileoverview The parts of the upload/download path that need no editor:
 * which file names import, what a download is called, and the error an
 * import refuses with.
 *
 * Split from `./stored-cmir` so the docs sidebar (mounted on every page) can
 * label its file picker and name a download without pulling CardMirror's
 * engine into the app shell's bundle; `./stored-cmir` re-exports all of it,
 * and is itself loaded on demand through `./lazy-stored-cmir`.
 *
 * @module lib/cardmirror/import-files
 */

/** Extensions the upload path knows how to turn into a `.cmir`. Anything
 *  else is refused by name rather than failing deep inside a parser. */
export const IMPORTABLE_EXTENSIONS = [
  ".docx",
  ".cmir",
  ".html",
  ".htm",
  ".md",
  ".txt",
] as const;

/** The `accept` attribute for a file picker that feeds `fileToStoredCmir`. */
export const IMPORT_ACCEPT = IMPORTABLE_EXTENSIONS.join(",");

/** A file the app refused to import, with a reason worth showing. */
export class CardMirrorImportError extends Error {
  override name = "CardMirrorImportError";
}

/** `"1AC Warming.docx"` → `".docx"`, lowercased; `""` when there is none. */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

/**
 * The filename a downloaded `.docx` gets, from a row's title.
 *
 * A title carrying one of {@link IMPORTABLE_EXTENSIONS} (an uploaded `.cmir`
 * or `.docx`, kept verbatim in the tree per `FileTree`'s `sourceLabel`) has
 * that extension stripped first, so converting it back to `.docx` doesn't
 * double up (`"Brief.cmir"` → `"Brief.docx"`, not `"Brief.cmir.docx"`). A
 * title with no recognized extension is used as-is (`"Notes"` →
 * `"Notes.docx"`). Path separators are replaced so the title can't be read as
 * a directory by whatever the browser hands it to.
 */
export function docxDownloadFilename(title: string): string {
  const extension = fileExtension(title);
  const base = (IMPORTABLE_EXTENSIONS as readonly string[]).includes(extension)
    ? title.slice(0, -extension.length)
    : title;
  const safe = base.trim().replace(/[\\/]/g, "-");
  return `${safe || "Untitled"}.docx`;
}
