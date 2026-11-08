/**
 * Shared shape for the native REASON editor route — mirrors the `documents`
 * table plus the `parentId`/`isFolder` columns backing the file-tree sidebar.
 */
export interface ReasonDocument {
  /** Row id. */
  id: number;
  /** File or folder name. */
  title: string;
  /** The document body. */
  content: string;
  /**
   * How `content` is encoded — `"cmir"` for an uploaded file kept in
   * Debate Editor's native format, `"html"` for one written in the editor.
   * Absent on a row read before the column existed, which reads as HTML.
   */
  format?: string;
  /** Id of the containing folder, or null at the top level. */
  parentId: number | null;
  /** True when the row is a folder. */
  isFolder: boolean;
  /** When the row last changed: an ISO string or epoch ms. */
  updatedAt: string | number;
  /** When the row was made: an ISO string or epoch ms. Absent on rows read
   *  from an older cache. */
  createdAt?: string | number | null;
  /** Who wrote the file — the owner, or the original author of a copy. */
  author?: string | null;
  /** Evidence cards in the file; null until counted. */
  quoteCount?: number | null;
  /** Blocks (Verbatim heading 3) in the file; null until counted. */
  blockCount?: number | null;
  /** Estimated printed pages; null until counted. */
  pageCount?: number | null;
  /** Characters of text in the file; null until counted. */
  charCount?: number | null;
}
