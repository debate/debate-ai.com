import { describe, expect, it } from "vitest";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Fragment, type Node as PMNode } from "prosemirror-model";

import { NavigationPanel } from "../src/editor/nav-panel";
import { schema } from "../src/schema/index";

let nextId = 0;
const head = (name: string, text: string) =>
  schema.nodes[name]!.create({ id: `h${++nextId}` }, schema.text(text));
const card = (text: string) => schema.nodes["card"]!.create(null, [head("tag", text)]);
const doc = (...blocks: PMNode[]) => schema.nodes["doc"]!.create(null, Fragment.fromArray(blocks));

function mount(d: PMNode): { panel: NavigationPanel; levels: () => number[] } {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const view = new EditorView(document.createElement("div"), { state: EditorState.create({ doc: d }) });
  const panel = new NavigationPanel(host, { readOnly: true });
  panel.attach(view);
  const levels = () =>
    [...host.querySelectorAll<HTMLElement>(".pmd-nav-item")].map((li) =>
      Number(/pmd-nav-level-(\d)/.exec(li.className)![1]),
    );
  return { panel, levels };
}

describe("nav pane level buttons", () => {
  // A hat holding tags directly, with no block between: "3" must hide the
  // tags just as Word's "Show Heading 3" would, not match "4".
  const d = doc(
    head("pocket", "1AC"),
    head("hat", "Advantage"),
    card("Tag one"),
    card("Tag two"),
    head("hat", "Plan"),
    head("block", "Solvency"),
    card("Tag three"),
  );

  it("shows only levels 1 through N", () => {
    const { panel, levels } = mount(d);
    panel.setMaxLevel(4);
    expect(levels()).toEqual([1, 2, 4, 4, 2, 3, 4]);
    panel.setMaxLevel(3);
    expect(levels()).toEqual([1, 2, 2, 3]);
    panel.setMaxLevel(2);
    expect(levels()).toEqual([1, 2, 2]);
    panel.setMaxLevel(1);
    expect(levels()).toEqual([1]);
  });
});
