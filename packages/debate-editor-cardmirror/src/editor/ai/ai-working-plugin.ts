/**
 * AI-working highlight plugin.
 *
 * While an AI operation runs, the part of the document it's working on is
 * boxed in purple, mirroring the blue pickup box shown while dragging a
 * card out of the editor (`.pmd-editor-pickup-highlight`) but in the
 * "Thinking…" pill's accent — so it's obvious WHAT the AI is working on
 * even after the text selection clears. The box matches the operation's
 * SCOPE:
 *   - `container` — outline the enclosing card/unit (card cutting, where
 *     the whole card is the unit of work).
 *   - `selection` — mark exactly the range the user selected (cite
 *     repair, text/formatting repair, an image), so the box isn't
 *     misleadingly expanded to the whole card.
 *
 * View-only decoration: never a mark, never serialized. Multiple ops can
 * be working at once (the edit coordinator makes concurrent AI edits safe),
 * so the plugin keeps ONE decoration per active op, keyed by a token:
 * `setAiWorking(view, token, range, scope)` sets/updates that op's box,
 * `…(view, token, null)` clears just it. Each op keeps its own cue.
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';

interface Range {
  from: number;
  to: number;
}
export type AiWorkingScope = 'container' | 'selection';

interface Entry {
  from: number;
  to: number;
  scope: AiWorkingScope;
}
/** token → its worked-on range; remapped through every edit. */
type State = Map<string, Entry>;

// undefined meta → map ranges through the edit; payload → set/clear a token.
type Meta = { token: string; range: Range | null; scope: AiWorkingScope };

const aiWorkingKey = new PluginKey<State>('ai-working');

// Same containers the drag-pickup recognizes: the card/unit is the
// preferred target; the structural wrappers are a fallback.
const UNIT_TYPES = new Set(['card', 'analytic_unit']);
const WRAPPER_TYPES = new Set(['pocket', 'hat', 'block']);

/** The enclosing container node's [before, after] range for `from`,
 *  preferring the innermost card/unit, else a structural wrapper. */
function containerRange(doc: PMNode, range: Range): Range | null {
  const inside = Math.min(Math.max(range.from + 1, 0), doc.content.size);
  const $p = doc.resolve(inside);
  for (const types of [UNIT_TYPES, WRAPPER_TYPES]) {
    for (let d = $p.depth; d >= 1; d--) {
      if (types.has($p.node(d).type.name)) {
        return { from: $p.before(d), to: $p.after(d) };
      }
    }
  }
  return null;
}

function nodeOrInline(doc: PMNode, range: Range): Decoration | null {
  if (range.to <= range.from) return null;
  // A range that exactly wraps one non-text node (e.g. an image) → box
  // the node; anything else (a text selection) → tint just that text.
  try {
    const after = doc.resolve(range.from).nodeAfter;
    if (after && !after.isText && range.to === range.from + after.nodeSize) {
      return Decoration.node(range.from, range.to, { class: 'pmd-ai-working' });
    }
  } catch {
    /* fall through to inline */
  }
  return Decoration.inline(range.from, range.to, { class: 'pmd-ai-working-inline' });
}

function decorationsFor(doc: PMNode, range: Range, scope: AiWorkingScope): Decoration[] {
  if (scope === 'container') {
    const box = containerRange(doc, range);
    if (box) return [Decoration.node(box.from, box.to, { class: 'pmd-ai-working' })];
    // No enclosing container — fall back to marking the range itself.
  }
  const deco = nodeOrInline(doc, range);
  return deco ? [deco] : [];
}

export const aiWorkingPlugin = new Plugin<State>({
  key: aiWorkingKey,
  state: {
    init: () => new Map(),
    apply(tr, prev) {
      let next = prev;
      if (tr.docChanged && prev.size) {
        next = new Map();
        for (const [token, e] of prev) {
          next.set(token, { ...e, from: tr.mapping.map(e.from, 1), to: tr.mapping.map(e.to, -1) });
        }
      }
      const meta = tr.getMeta(aiWorkingKey) as Meta | undefined;
      if (meta) {
        if (next === prev) next = new Map(prev);
        if (meta.range === null) next.delete(meta.token);
        else next.set(meta.token, { from: meta.range.from, to: meta.range.to, scope: meta.scope });
      }
      return next;
    },
  },
  props: {
    decorations(state) {
      const entries = aiWorkingKey.getState(state);
      if (!entries || entries.size === 0) return null;
      const decos: Decoration[] = [];
      for (const e of entries.values()) {
        decos.push(...decorationsFor(state.doc, { from: e.from, to: e.to }, e.scope));
      }
      return decos.length ? DecorationSet.create(state.doc, decos) : null;
    },
  },
});

/** Mark the part of the document the AI is working on for the op identified
 *  by `token` (or clear just that op with a null range). `scope` chooses the
 *  container box vs. the selected range. Each token is independent, so
 *  concurrent AI ops each keep their own box. */
export function setAiWorking(
  view: EditorView,
  token: string,
  range: Range | null,
  scope: AiWorkingScope = 'container',
): void {
  try {
    view.dispatch(view.state.tr.setMeta(aiWorkingKey, { token, range, scope }));
  } catch {
    // View torn down — nothing to set.
  }
}
