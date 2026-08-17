/**
 * Render tests for the outline navigation panel.
 *
 * The package's Vitest environment is `node`, so these render through
 * `react-dom/server`. A static render never runs effects, which means the
 * panel is exercised in its pre-hydration state: no persisted collapse set
 * has been read yet, and the outline is whatever the supplied editor's
 * document yields.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Editor } from "@tiptap/core";
import { Node as PMNode, Schema } from "@tiptap/pm/model";

import { OutlinePanel } from "../src/react/OutlinePanel";

/**
 * A schema with just enough of the CardMirror shape for the outline builder:
 * a pocket/hat heading pair plus a paragraph body.
 */
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    pocket: { group: "block", content: "text*", attrs: { id: { default: null } } },
    hat: { group: "block", content: "text*", attrs: { id: { default: null } } },
    text: {},
  },
});

function buildDoc(): PMNode {
  return schema.node("doc", null, [
    schema.node("pocket", { id: "p1" }, [schema.text("Warming Advantage")]),
    schema.node("hat", { id: "h1" }, [schema.text("Uniqueness")]),
    schema.node("paragraph", null, [schema.text("body text")]),
  ]);
}

/** Minimal stand-in for the TipTap editor: the panel only reads `state.doc`. */
function fakeEditor(doc: PMNode): Editor {
  return {
    state: { doc },
    on() {},
    off() {},
  } as unknown as Editor;
}

describe("OutlinePanel", () => {
  it("renders an empty state when there is no editor", () => {
    const html = renderToStaticMarkup(<OutlinePanel editor={null} />);
    expect(html).toContain("Outline");
    expect(html).toContain("No headings yet");
  });

  it("lists the document's headings with their node type", () => {
    const html = renderToStaticMarkup(<OutlinePanel editor={fakeEditor(buildDoc())} />);
    expect(html).toContain("Warming Advantage");
    expect(html).toContain("Uniqueness");
    expect(html).toContain("pocket");
    expect(html).toContain("hat");
    expect(html).toContain("2 headings");
  });

  it("offers collapse-all while nothing is collapsed", () => {
    const html = renderToStaticMarkup(<OutlinePanel editor={fakeEditor(buildDoc())} />);
    expect(html).toContain("Collapse all");
    expect(html).not.toContain("Expand all");
  });

  it("labels the panel as a navigation landmark", () => {
    const html = renderToStaticMarkup(<OutlinePanel editor={null} />);
    expect(html).toContain('aria-label="Document outline"');
  });

  it("applies a caller-supplied class alongside its own", () => {
    const html = renderToStaticMarkup(<OutlinePanel editor={null} className="w-64" />);
    expect(html).toContain('class="reason-outline w-64"');
  });
});
