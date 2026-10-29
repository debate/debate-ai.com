/** @fileoverview The drag payloads the sidebar's two file areas exchange. */
import { describe, expect, it } from "vitest"

import { DOCUMENT_DRAG_TYPE, TOPIC_DRAG_TYPE, draggedId } from "../../../src/lib/reason-docs/drag-data"

const data = (values: Record<string, string>) => ({ getData: (type: string) => values[type] ?? "" })

describe("draggedId", () => {
  it("reads the id a drag carries under one type and ignores the other", () => {
    expect(draggedId(data({ [DOCUMENT_DRAG_TYPE]: "12" }), DOCUMENT_DRAG_TYPE)).toBe(12)
    expect(draggedId(data({ [DOCUMENT_DRAG_TYPE]: "12" }), TOPIC_DRAG_TYPE)).toBeNull()
  })
  it("refuses anything that isn't a row id", () => {
    expect(draggedId(data({ [TOPIC_DRAG_TYPE]: "abc" }), TOPIC_DRAG_TYPE)).toBeNull()
    expect(draggedId(data({ [TOPIC_DRAG_TYPE]: "0" }), TOPIC_DRAG_TYPE)).toBeNull()
    expect(draggedId(null, TOPIC_DRAG_TYPE)).toBeNull()
  })
})
