/**
 * schema-extensions — the bridge that lets a single TipTap editor speak
 * CardMirror's debate-card schema.
 *
 * CardMirror defines its document model as raw ProseMirror `NodeSpec` /
 * `MarkSpec` objects (see ../engine/schema). TipTap, however, builds its
 * schema from *extensions*. This module generates one TipTap Node/Mark
 * extension per CardMirror node/mark, delegating every schema concern —
 * `parseHTML` (parseDOM), `renderHTML` (toDOM), attributes, content
 * expressions, mark exclusions — straight back to the original spec.
 *
 * Why delegate instead of re-authoring each node as a hand-written
 * TipTap extension:
 *   - Fidelity: CardMirror's toDOM/parseDOM encode the exact DOM shape
 *     the .docx importer/exporter and the editor CSS depend on. Reusing
 *     them verbatim means the TipTap editor and the headless engine
 *     render identically, so HTML/JSON round-trips between them are
 *     lossless.
 *   - Maintainability: when the engine schema changes upstream, this
 *     adapter picks it up with no edits.
 *
 * Ordering matters and is preserved: `Object.keys` iterates in
 * insertion order, so marks keep the rank order declared in marks.ts
 * (earlier = lower rank = outer DOM wrapper) and nodes keep nodes.ts
 * order. The extension array returned here is therefore [nodes…, marks…]
 * in source order.
 */

import { Mark as TiptapMark, Node as TiptapNode } from '@tiptap/core';
import type { AnyExtension, Attributes } from '@tiptap/core';
import type { DOMOutputSpec, MarkSpec, NodeSpec, ParseRule } from '@tiptap/pm/model';

import { nodes as cmNodes } from '../engine/schema/nodes.js';
import { marks as cmMarks } from '../engine/schema/marks.js';

/** NodeSpec plus the prosemirror-tables `tableRole` field CardMirror
 *  sets on its table nodes (not part of the base NodeSpec type). */
type CardMirrorNodeSpec = NodeSpec & { tableRole?: string };

/**
 * Translate a ProseMirror attribute map (`{ name: { default, validate }
 * }`) into TipTap's attribute shape. We mark every attribute
 * `rendered: false`: the raw spec's `toDOM`/`parseDOM` already own
 * serialization in both directions, so TipTap should treat these as
 * opaque data carried on the node/mark (it still tracks defaults, which
 * keeps `updateAttributes`, JSON round-trips, and command targeting
 * working).
 */
function specAttrsToTiptap(
  attrs: Record<string, { default?: unknown }> | undefined,
): Attributes {
  const out: Attributes = {};
  if (!attrs) return out;
  for (const key of Object.keys(attrs)) {
    const def = attrs[key];
    out[key] = {
      default: def && 'default' in def ? def.default : null,
      rendered: false,
    };
  }
  return out;
}

/** Build a TipTap Node extension that defers to a CardMirror NodeSpec. */
export function nodeExtensionFromSpec(
  name: string,
  spec: CardMirrorNodeSpec,
): AnyExtension {
  const config: Record<string, unknown> = {
    name,
    group: spec.group,
    content: spec.content,
    inline: spec.inline,
    atom: spec.atom,
    selectable: spec.selectable,
    draggable: spec.draggable,
    code: spec.code,
    defining: spec.defining,
    isolating: spec.isolating,
    marks: spec.marks,
    addAttributes() {
      return specAttrsToTiptap(spec.attrs as Record<string, { default?: unknown }>);
    },
    parseHTML() {
      return (spec.parseDOM as ParseRule[] | undefined) ?? [];
    },
    renderHTML({ node }: { node: Parameters<NonNullable<NodeSpec['toDOM']>>[0] }) {
      if (typeof spec.toDOM === 'function') {
        return spec.toDOM(node) as DOMOutputSpec;
      }
      return ['div', 0] as unknown as DOMOutputSpec;
    },
  };
  // The single top-level node. Only `doc` carries it; TipTap requires
  // exactly one and we deliberately omit TipTap's default Document.
  if (name === 'doc') config['topNode'] = true;
  // prosemirror-tables role, surfaced so table-aware commands/plugins
  // can locate cells/rows when those features are layered on.
  if (spec.tableRole) config['tableRole'] = spec.tableRole;

  return TiptapNode.create(config as never) as AnyExtension;
}

/** Build a TipTap Mark extension that defers to a CardMirror MarkSpec. */
export function markExtensionFromSpec(name: string, spec: MarkSpec): AnyExtension {
  const config: Record<string, unknown> = {
    name,
    inclusive: spec.inclusive,
    excludes: spec.excludes,
    spanning: spec.spanning,
    addAttributes() {
      return specAttrsToTiptap(spec.attrs as Record<string, { default?: unknown }>);
    },
    parseHTML() {
      return (spec.parseDOM as ParseRule[] | undefined) ?? [];
    },
    renderHTML({ mark }: { mark: Parameters<NonNullable<MarkSpec['toDOM']>>[0] }) {
      if (typeof spec.toDOM === 'function') {
        return spec.toDOM(mark, true) as DOMOutputSpec;
      }
      return ['span', 0] as unknown as DOMOutputSpec;
    },
  };
  return TiptapMark.create(config as never) as AnyExtension;
}

/**
 * The complete set of schema extensions for the CardMirror document
 * model, in source order (nodes then marks). Feed these into a TipTap
 * editor *instead of* StarterKit — they fully define the schema.
 */
export function buildSchemaExtensions(): AnyExtension[] {
  const nodeExts = Object.keys(cmNodes).map((name) =>
    nodeExtensionFromSpec(name, cmNodes[name] as CardMirrorNodeSpec),
  );
  const markExts = Object.keys(cmMarks).map((name) =>
    markExtensionFromSpec(name, cmMarks[name] as MarkSpec),
  );
  return [...nodeExts, ...markExts];
}

/** Names of every node/mark in the CardMirror schema — handy for
 *  toolbars and command wiring that need to reference types by name. */
export const cardMirrorNodeNames = Object.keys(cmNodes);
export const cardMirrorMarkNames = Object.keys(cmMarks);
