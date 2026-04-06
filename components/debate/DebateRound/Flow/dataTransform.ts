/**
 * @fileoverview Data transformation utilities for Flow spreadsheet
 * Converts between nested Box structures and flat AG Grid row data
 */

/**
 * Convert flow children (nested Box structure) to flat row data for AG Grid
 *
 * @param boxes - Array of root-level boxes
 * @param columns - Column names from the flow
 * @returns Array of row objects with column values
 */
export function buildRowData(boxes: Box[], columns: string[]): any[] {
  const depth = columns.length
  const rows: any[] = []

  boxes.forEach((box, index) => {
    const row: any = {
      id: `row-${index}`,
      originalIndex: index,
      isHeading: box.isHeading ?? false,
    }

    // Flatten box chain into column values
    let current: Box | undefined = box
    for (let i = 0; i < depth; i++) {
      row[`col_${i}`] = current?.content ?? ""
      current = current?.children?.[0]
    }

    rows.push(row)
  })

  // Reconstruct parentHeadingId from heading flags
  let currentHeadingId: string | undefined
  for (const row of rows) {
    if (row.isHeading) {
      currentHeadingId = row.id
    } else if (currentHeadingId) {
      row.parentHeadingId = currentHeadingId
    }
  }

  return rows
}

/**
 * Convert flat row data back to nested Box structure
 *
 * @param rows - Array of row objects from AG Grid
 * @param columns - Column names from the flow
 * @returns Array of Box objects with nested children
 */
export function rowDataToBoxes(rows: any[], columns: string[]): Box[] {
  const depth = columns.length
  const boxes: Box[] = []

  rows.forEach((row) => {
    const values: string[] = []
    for (let i = 0; i < depth; i++) {
      values.push(row[`col_${i}`] ?? "")
    }

    // Build box chain from deepest to shallowest
    let box: Box = {
      content: values[depth - 1] ?? "",
      children: [],
      index: depth,
      level: depth,
      focus: false,
      empty: !(values[depth - 1] ?? "").trim(),
    }

    for (let i = depth - 2; i >= 0; i--) {
      box = {
        content: values[i] ?? "",
        children: [box],
        index: i,
        level: i + 1,
        focus: false,
        empty: !(values[i] ?? "").trim(),
      }
    }

    // Persist heading state on the root box
    if (row.isHeading) {
      box.isHeading = true
    }

    boxes.push(box)
  })

  return boxes
}
