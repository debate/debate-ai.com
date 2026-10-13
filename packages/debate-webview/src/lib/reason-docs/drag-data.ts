/**
 * @fileoverview The drag payloads the sidebar's two file areas exchange.
 *
 * A row dragged out of Files carries {@link DOCUMENT_DRAG_TYPE}; a row dragged
 * out of Topic Starters carries {@link TOPIC_DRAG_TYPE}. Each tree reads both,
 * so a drop means the right thing wherever it lands:
 *
 *  - Files ← Files: re-file the row (move).
 *  - Files ← Topic Starters: save a copy of the public file into your files.
 *  - Topic Starters ← Files: publish your file to the catalogue (admins).
 *  - Either ← the desktop: `dataTransfer.files`, an upload.
 *
 * @module lib/reason-docs/drag-data
 */

export const DOCUMENT_DRAG_TYPE = "text/reason-document-id"
export const TOPIC_DRAG_TYPE = "text/topic-starter-id"

/** The minimum of `DataTransfer` the readers need, so tests can fake it. */
type DragData = Pick<DataTransfer, "getData">

/** The id a drag carries under `type`, or `null` when it carries none. */
export function draggedId(data: DragData | null | undefined, type: string): number | null {
  const raw = data?.getData(type)
  if (!raw) return null
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}
