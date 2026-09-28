/** Shared shape for the native REASON editor route — mirrors the
 *  `documents` table (lib/database/schema.ts) plus the `parentId`/`isFolder`
 *  columns backing the file-tree sidebar. */
export interface ReasonDocument {
  id: number
  title: string
  content: string
  /** How `content` is encoded — `"cmir"` for an uploaded file kept in
   *  CardMirror's native format, `"html"` for one written in the editor. See
   *  `lib/cardmirror/format.ts`; absent on a row read before the column
   *  existed, which reads as HTML. */
  format?: string
  parentId: number | null
  isFolder: boolean
  updatedAt: string | number
}
