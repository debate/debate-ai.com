/** Shared shape for the native REASON editor route — mirrors the
 *  `documents` table (lib/database/schema.ts) plus the `parentId`/`isFolder`
 *  columns backing the file-tree sidebar. */
export interface ReasonDocument {
  id: number
  title: string
  content: string
  parentId: number | null
  isFolder: boolean
  updatedAt: string | number
}
