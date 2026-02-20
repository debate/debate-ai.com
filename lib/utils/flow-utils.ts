import { debateStyles, debateStyleMap } from "../debate-data/debate-styles"

export function newBox(index: number, level: number, focus = false): Box {
  return {
    content: "",
    children: [],
    index,
    level,
    focus,
    empty: false,
  }
}

export function newFlow(
  index: number,
  type: "primary" | "secondary",
  switchSpeakers: boolean,
  debateStyleIndex: number,
): Flow | null {
  const debateStyle = debateStyles[debateStyleMap[debateStyleIndex]]

  if (type === "secondary" && !debateStyle.secondary) {
    return null
  }

  const flowConfig = type === "primary" ? debateStyle.primary : debateStyle.secondary!
  const columns = switchSpeakers && flowConfig.columnsSwitch ? flowConfig.columnsSwitch : flowConfig.columns

  const starterBoxes: Box[] = []

  // Create 100 chains of empty boxes, one for each "row"
  const INITIAL_ROWS = 100
  if (columns.length > 0) {
    for (let r = 0; r < INITIAL_ROWS; r++) {
      const currentChildren = starterBoxes
      const rootIndex = r

      // Create the root box for this row (Column 1)
      const rootBox: Box = {
        content: "",
        children: [],
        index: rootIndex,
        level: 1,
        focus: false,
        empty: columns.length > 1, // Empty if it has children
      }
      starterBoxes.push(rootBox)

      // If there are more columns, chain them
      let currentBox = rootBox
      for (let c = 1; c < columns.length; c++) {
        const isLast = c === columns.length - 1
        const childBox: Box = {
          content: "",
          children: [],
          index: 0, // In this chain, it's the only child
          level: c + 1,
          focus: false,
          empty: !isLast,
        }
        currentBox.children.push(childBox)
        currentBox = childBox
      }
    }
  }

  const flow: Flow = {
    content: flowConfig.name,
    level: 0,
    columns,
    invert: flowConfig.invert,
    focus: false,
    index,
    lastFocus: [],
    children: starterBoxes,
    id: Date.now() + Math.floor(Math.random() * 1000),
  }

  return flow
}

export function boxFromPath<T extends { children: Box[] }, B extends Box>(
  root: T,
  path: number[],
  scope = 0,
): B | T | null {
  if (path.length === 0 && scope >= 1) {
    return null
  }

  let current: T | Box = root
  for (let i = 0; i < path.length - scope; i++) {
    if (!current.children || !current.children[path[i]]) {
      return null
    }
    current = current.children[path[i]]
  }
  return current as B | T
}
