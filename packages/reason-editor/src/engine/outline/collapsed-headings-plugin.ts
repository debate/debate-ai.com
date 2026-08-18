/**
 * Collapsed-headings decoration plugin — the "(b) a ProseMirror decoration
 * plugin that hides collapsed ranges in the actual editor view using
 * `getCollapsedRanges`" follow-up named under idea #9 ("Expandable Heading
 * Structure") in TODO.md's Product Feature Ideas list.
 *
 * `OutlineNavPanel` (follow-up (a), shipped) only controls which headings
 * are *listed* in the nav panel; it doesn't touch the live document view.
 * This plugin closes that gap: it holds a `collapsedIds` list in its own
 * plugin state (set via a `collapsedHeadingsKey`-tagged transaction meta,
 * mirroring `comments-plugin.ts`'s meta-driven state convention) and
 * decorates every top-level document node that falls inside a collapsed
 * range (per `getCollapsedRanges`) so it renders `display: none`.
 *
 * Headings are flat, undoc-level paragraphs (see `../schema/nodes.ts`), so
 * a `CollapsedRange`'s `from`/`to` always line up with top-level node
 * boundaries — no need to walk into nested content.
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { buildHeadingOutline, getCollapsedRanges, type CollapsedRange } from './heading-outline.js';

export interface CollapsedHeadingsPluginState {
  collapsedIds: string[];
}

export const collapsedHeadingsKey = new PluginKey<CollapsedHeadingsPluginState>('collapsedHeadings');

type CollapsedHeadingsMeta = { type: 'set'; collapsedIds: string[] };

/** Build a `meta` payload that sets the plugin's collapsed-id list. */
export function setCollapsedHeadingIdsMeta(collapsedIds: string[]): CollapsedHeadingsMeta {
  return { type: 'set', collapsedIds };
}

/** Read-only accessor — mirrors `comments-plugin.ts`'s `getCommentsState`. */
export function getCollapsedHeadingIds(state: EditorState): string[] {
  return collapsedHeadingsKey.getState(state)?.collapsedIds ?? [];
}

function buildHiddenDecorations(doc: PMNode, ranges: readonly CollapsedRange[]): Decoration[] {
  const decorations: Decoration[] = [];
  doc.forEach((node, offset) => {
    const end = offset + node.nodeSize;
    const isHidden = ranges.some((range) => offset >= range.from && end <= range.to);
    if (isHidden) {
      decorations.push(
        Decoration.node(offset, end, {
          class: 'reason-editor-collapsed-content',
          style: 'display: none;',
        }),
      );
    }
  });
  return decorations;
}

/**
 * Computes the `DecorationSet` that hides every collapsed heading's content
 * in `state`. Exported (not just used inline in `props.decorations`) so
 * tests can call it directly without going through ProseMirror's
 * `EditorProps` `this`-binding.
 */
export function computeCollapsedHeadingsDecorations(state: EditorState): DecorationSet {
  const collapsedIds = collapsedHeadingsKey.getState(state)?.collapsedIds ?? [];
  if (collapsedIds.length === 0) return DecorationSet.empty;

  const outline = buildHeadingOutline(state.doc);
  const ranges = getCollapsedRanges(state.doc, outline, collapsedIds);
  if (ranges.length === 0) return DecorationSet.empty;

  return DecorationSet.create(state.doc, buildHiddenDecorations(state.doc, ranges));
}

export const collapsedHeadingsPlugin: Plugin<CollapsedHeadingsPluginState> = new Plugin({
  key: collapsedHeadingsKey,
  state: {
    init(): CollapsedHeadingsPluginState {
      return { collapsedIds: [] };
    },
    apply(tr, prev): CollapsedHeadingsPluginState {
      const meta = tr.getMeta(collapsedHeadingsKey) as CollapsedHeadingsMeta | undefined;
      return meta ? { collapsedIds: meta.collapsedIds } : prev;
    },
  },
  props: {
    decorations: computeCollapsedHeadingsDecorations,
  },
});
