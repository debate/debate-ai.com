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
   * CardMirror's native format, `"html"` for one written in the editor.
   * Absent on a row read before the column existed, which reads as HTML.
   */
  format?: string;
  /** Id of the containing folder, or null at the top level. */
  parentId: number | null;
  /** True when the row is a folder. */
  isFolder: boolean;
  /** When the row last changed: an ISO string or epoch ms. */
  updatedAt: string | number;
}
