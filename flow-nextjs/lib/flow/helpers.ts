import type { Box, Flow, DebateStyle } from "./types";
import { debateStyles } from "./types";

export function newBox(
  index: number,
  level: number,
  focus: boolean = false,
  placeholder?: string
): Box {
  return {
    content: "",
    children: [],
    index,
    level,
    focus,
    placeholder,
  };
}

export function newFlow(
  id: string,
  name: string,
  index: number,
  debateStyleName: string = "Policy Debate",
  type: "primary" | "secondary" = "primary"
): Flow {
  const style = debateStyles.find((s) => s.name === debateStyleName);
  const format = type === "primary" ? style?.primary : style?.secondary;

  if (!format) {
    // Fallback to basic format
    return {
      id,
      name,
      content: "",
      level: 0,
      columns: ["Speech 1", "Speech 2", "Speech 3"],
      invert: false,
      focus: true,
      index,
      lastFocus: [],
      children: [newBox(0, 1, false)],
      debateStyle: debateStyleName,
    };
  }

  const children: Box[] = format.starterBoxes
    ? format.starterBoxes.map((placeholder, idx) =>
        newBox(idx, 1, false, placeholder)
      )
    : [newBox(0, 1, false)];

  return {
    id,
    name,
    content: "",
    level: 0,
    columns: format.columns,
    invert: format.invert,
    focus: true,
    index,
    lastFocus: [],
    children,
    debateStyle: debateStyleName,
  };
}

export function boxFromPath(
  root: Flow,
  path: number[]
): Box | Flow | null {
  if (path.length === 0) {
    return root;
  }

  let current: Flow | Box = root;
  for (let i = 0; i < path.length; i++) {
    const idx = path[i];
    if (current.children && current.children[idx]) {
      current = current.children[idx];
    } else {
      return null;
    }
  }

  return current;
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
