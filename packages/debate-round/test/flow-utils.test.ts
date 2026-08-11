import { describe, expect, it } from "vitest";
import { boxFromPath, newBox, newFlow } from "../src/utils/flow-utils";
import {
  debateStyleMap,
  debateStyles,
} from "debate-timer/src/formats/debate-format-times";
import type { Box } from "debate-core/src/types/flow";

const POLICY_INDEX = debateStyleMap.indexOf("policy");

describe("newBox", () => {
  it("creates an empty box at the requested index and level", () => {
    expect(newBox(3, 2)).toEqual({
      content: "",
      children: [],
      index: 3,
      level: 2,
      focus: false,
      empty: false,
    });
  });

  it("can be created focused", () => {
    expect(newBox(0, 1, true).focus).toBe(true);
  });
});

describe("newFlow", () => {
  it("uses the primary column set for the primary side", () => {
    const flow = newFlow(0, "primary", false, POLICY_INDEX)!;
    expect(flow.columns).toEqual(debateStyles.policy.primary.columns);
  });

  it("uses the secondary column set for the secondary side", () => {
    const flow = newFlow(1, "secondary", false, POLICY_INDEX)!;
    expect(flow.columns).toEqual(debateStyles.policy.secondary!.columns);
  });

  it("seeds one chained row per column depth", () => {
    const flow = newFlow(0, "primary", false, POLICY_INDEX)!;
    const columnCount = debateStyles.policy.primary.columns.length;

    let depth = 1;
    let box: Box | undefined = flow.children[0];
    while (box?.children?.length) {
      depth += 1;
      box = box.children[0];
    }

    expect(flow.children).toHaveLength(100);
    expect(depth).toBe(columnCount);
  });

  it("returns null for a style with no secondary side", () => {
    const styleWithoutSecondary = debateStyleMap.findIndex(
      (key) => !debateStyles[key].secondary,
    );
    if (styleWithoutSecondary === -1) return; // every format is two-sided
    expect(newFlow(0, "secondary", false, styleWithoutSecondary)).toBeNull();
  });
});

describe("boxFromPath", () => {
  const root = {
    children: [
      { ...newBox(0, 1), children: [newBox(0, 2), newBox(1, 2)] },
      newBox(1, 1),
    ],
  };

  it("walks a path down to the addressed box", () => {
    expect(boxFromPath(root, [0, 1])).toMatchObject({ index: 1, level: 2 });
  });

  it("returns the root for an empty path", () => {
    expect(boxFromPath(root, [])).toBe(root);
  });

  it("returns null for an empty path when a scope is requested", () => {
    expect(boxFromPath(root, [], 1)).toBeNull();
  });

  it("stops short of the last segment when scoped to the parent", () => {
    expect(boxFromPath(root, [0, 1], 1)).toMatchObject({ index: 0, level: 1 });
  });

  it("returns null when the path leaves the tree", () => {
    expect(boxFromPath(root, [0, 9])).toBeNull();
  });
});
