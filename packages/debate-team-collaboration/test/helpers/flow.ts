/**
 * @fileoverview A small round flow for panel tests, and a way to make it the
 * round workspace's selected flow — what the panels' "Save current flow"
 * actions read.
 */
import { useFlowStore } from "@debate/round/src/state/store";
import type { Box, Flow } from "@debate/round/src/types/flow";

/** Builds a row's box chain from per-column content; "" leaves a column unflowed. */
export function row(contents: string[], overrides: Partial<Box> = {}): Box {
  let box: Box | undefined;
  for (let i = contents.length - 1; i >= 0; i--) {
    box = {
      content: contents[i],
      children: box ? [box] : [],
      index: 0,
      level: i + 1,
      focus: false,
      empty: !contents[i].trim(),
    };
  }
  return { ...box!, ...overrides };
}

/** A four-speech policy flow with a dropped turn, an answered disad and a heading. */
export function sampleFlow(id = 7): Flow {
  return {
    content: "Round 7",
    level: 0,
    columns: ["1AC", "1NC", "2AC", "2NC"],
    invert: false,
    focus: false,
    index: 0,
    lastFocus: [],
    id,
    children: [
      row(["Advantage 1: Warming", "", "", ""], { isHeading: true }),
      row(["Warming causes extinction", "Turn: growth solves", "", ""]),
      row(["", "Disad: spending link", "Non-unique", "Extend the link"]),
      row(["Solvency: plan works", "", "", ""]),
    ],
  };
}

/** Puts `flow` in the round workspace as its selected flow (or clears it). */
export function selectFlow(flow: Flow | null): void {
  useFlowStore.setState({ flows: flow ? [flow] : [], selected: 0 });
}
