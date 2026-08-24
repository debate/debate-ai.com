/**
 * Load-time document migrations.
 *
 * These run on `parseNative` (see `native/index.ts`) right after a doc is
 * deserialized, so older `.cmir` files are repaired in place before they reach
 * the editor. Each migration is a pure `doc -> doc` walk that returns the same
 * node when nothing changed (so callers can skip a no-op dispatch).
 */

import { Fragment, type Node as PMNode } from 'prosemirror-model';
import { schema } from './index.js';

/**
 * Split any `analytic` that sits INSIDE a card out into its own trailing
 * `analytic_unit`.
 *
 * `analytic` used to be legal card content (the "cite-slot" alternative). It no
 * longer is — an analytic anchors its own `analytic_unit` — so older docs (and
 * `.docx` imports that put an Analytic paragraph under a tag) can contain
 * `card[ tag, …, analytic, … ]`, which is now schema-invalid. This rewrites such
 * a card the same way pasting an analytic into a card does: the tag and the
 * children BEFORE the first analytic stay in the card; each analytic becomes the
 * head of a new `analytic_unit` that absorbs the children that follow it, up to
 * the next analytic. Several in-card analytics yield several units.
 *
 *   card[ tag, body, analytic A1, body, cite, analytic A2, body ]
 *     ->
 *   card[ tag, body ]
 *   analytic_unit[ analytic A1, body, cite ]
 *   analytic_unit[ analytic A2, body ]
 *
 * All card-content types (`card_body`/`undertag`/`cite_paragraph`/`table`) are
 * also valid `analytic_unit` content, so the absorbed children pass through
 * unchanged. Heading ids (tag + analytics) are preserved.
 *
 * Cards live only at the doc root, so a doc-level walk suffices.
 */
export function splitInCardAnalytics(doc: PMNode): PMNode {
  let changed = false;
  const out: PMNode[] = [];
  doc.forEach((child) => {
    if (child.type.name === 'card' && cardHasAnalytic(child)) {
      changed = true;
      out.push(...splitCardOnAnalytics(child));
    } else {
      out.push(child);
    }
  });
  if (!changed) return doc;
  return doc.type.create(doc.attrs, Fragment.fromArray(out), doc.marks);
}

/**
 * Flatten any zones nested INSIDE a live zone. A `transclusion_ref` is live only
 * in the document it was created in; a zone nested inside another (possible in
 * docs saved before this invariant, or synced from such a peer) is unwrapped to
 * its plain snapshot while the top-level zone stays live. Mirrors the create /
 * refresh flatten so old docs heal on load. (Zones only ever appear at the doc
 * root or inside another zone, so a doc-level walk that recurses into zone
 * content is complete.)
 */
export function flattenNestedZones(doc: PMNode): PMNode {
  let changed = false;
  const out: PMNode[] = [];
  doc.forEach((child) => {
    if (child.type.name === 'transclusion_ref') {
      const flat = unwrapZonesIn(child.content);
      if (flat !== child.content) {
        changed = true;
        out.push(child.type.create(child.attrs, flat, child.marks));
      } else {
        out.push(child);
      }
    } else {
      out.push(child);
    }
  });
  if (!changed) return doc;
  return doc.type.create(doc.attrs, Fragment.fromArray(out), doc.marks);
}

/**
 * Drop any live zone that carries NO content. An empty `transclusion_ref`
 * renders invisibly (no cards, and the rail only shows on hover) yet is still a
 * real node — counted by "refresh all" and re-filled by a refresh, so it reads
 * as a phantom zone that materialises out of nowhere. These arise when a zone's
 * cards are all deleted in place; heal them on load. (Zones live at the doc
 * root; any nested one is unwrapped by flattenNestedZones first.)
 */
export function dropEmptyZones(doc: PMNode): PMNode {
  let changed = false;
  const out: PMNode[] = [];
  doc.forEach((child) => {
    if (child.type.name === 'transclusion_ref' && child.content.size === 0) {
      changed = true; // drop the empty zone entirely
      return;
    }
    out.push(child);
  });
  return changed ? doc.type.create(doc.attrs, Fragment.fromArray(out), doc.marks) : doc;
}

/**
 * Heal structurally invalid `analytic_unit`s. The schema requires
 * `analytic (card_body | undertag | cite_paragraph | table)*` — one analytic
 * head, optional tail — but files written by older builds can carry units that
 * violate it (a delete/drag path that hollowed the unit without removing the
 * shell). `nodeFromJSON` accepted these silently for years; the beta.21
 * reject-invalid check turned them into "file is damaged" refusals (first
 * field report: beta.17 → beta.22, an EMPTY unit `<>`). Now a known-legacy
 * shape, so it heals — one normalize loop covers every variant losslessly:
 *
 *   - empty unit                → dropped (nothing inside to lose)
 *   - headless children         → float up to the parent (all legal there)
 *   - analytic mid-tail         → re-heads its own unit, absorbing what
 *                                 follows (same absorb rule as
 *                                 `splitCardOnAnalytics`)
 *
 * Zones are walked one level deep (they're flat by the time this runs —
 * `flattenNestedZones` precedes it in the parseNative chain).
 */
export function healAnalyticUnits(doc: PMNode): PMNode {
  const healed = healUnitsIn(doc.content);
  return healed === doc.content ? doc : doc.type.create(doc.attrs, healed, doc.marks);
}

function unitNeedsHeal(unit: PMNode): boolean {
  if (unit.childCount === 0) return true;
  let bad = unit.firstChild!.type.name !== 'analytic';
  unit.forEach((c, _off, idx) => {
    if (idx > 0 && c.type.name === 'analytic') bad = true;
  });
  return bad;
}

function healUnitsIn(frag: Fragment): Fragment {
  let changed = false;
  const out: PMNode[] = [];
  frag.forEach((child) => {
    if (child.type.name === 'transclusion_ref') {
      const inner = healUnitsIn(child.content);
      if (inner !== child.content) {
        changed = true;
        out.push(child.type.create(child.attrs, inner, child.marks));
      } else {
        out.push(child);
      }
      return;
    }
    if (child.type.name === 'analytic_unit' && unitNeedsHeal(child)) {
      changed = true;
      const kids: PMNode[] = [];
      child.forEach((c) => kids.push(c));
      let i = 0;
      // Children before the first analytic float up to the parent level.
      while (i < kids.length && kids[i]!.type.name !== 'analytic') {
        out.push(kids[i]!);
        i++;
      }
      // Each analytic re-heads a unit that absorbs what follows it.
      while (i < kids.length) {
        const unitChildren: PMNode[] = [kids[i]!];
        i++;
        while (i < kids.length && kids[i]!.type.name !== 'analytic') {
          unitChildren.push(kids[i]!);
          i++;
        }
        out.push(child.type.create(child.attrs, Fragment.fromArray(unitChildren), child.marks));
      }
      return;
    }
    out.push(child);
  });
  return changed ? Fragment.fromArray(out) : frag;
}

/**
 * Heal structurally invalid `card`s — the card sibling of
 * `healAnalyticUnits`. The schema requires
 * `tag (card_body | undertag | cite_paragraph | table)*`, but a hollowed
 * shell turns into a "file is damaged" refusal at the beta.21 check
 * (field report 2026-07-26: an EMPTY card `<>` saved mid-session in a
 * working doc — second member of the empty-shell family after the
 * beta.22 unit report). Same normalize loop, same variants, lossless:
 *
 *   - empty card        → dropped (nothing inside to lose)
 *   - headless children → float up to the parent (all legal there)
 *   - tag mid-tail      → re-heads its own card, absorbing what
 *                         follows (same absorb rule as
 *                         `splitCardOnAnalytics`)
 *
 * Zones are walked one level deep, mirroring `healAnalyticUnits`.
 */
export function healCards(doc: PMNode): PMNode {
  const healed = healCardsIn(doc.content);
  return healed === doc.content ? doc : doc.type.create(doc.attrs, healed, doc.marks);
}

function cardNeedsHeal(card: PMNode): boolean {
  if (card.childCount === 0) return true;
  let bad = card.firstChild!.type.name !== 'tag';
  card.forEach((c, _off, idx) => {
    if (idx > 0 && c.type.name === 'tag') bad = true;
  });
  return bad;
}

function healCardsIn(frag: Fragment): Fragment {
  let changed = false;
  const out: PMNode[] = [];
  frag.forEach((child) => {
    if (child.type.name === 'transclusion_ref') {
      const inner = healCardsIn(child.content);
      if (inner !== child.content) {
        changed = true;
        out.push(child.type.create(child.attrs, inner, child.marks));
      } else {
        out.push(child);
      }
      return;
    }
    if (child.type.name === 'card' && cardNeedsHeal(child)) {
      changed = true;
      const kids: PMNode[] = [];
      child.forEach((c) => kids.push(c));
      let i = 0;
      // Children before the first tag float up to the parent level.
      while (i < kids.length && kids[i]!.type.name !== 'tag') {
        out.push(kids[i]!);
        i++;
      }
      // Each tag re-heads a card that absorbs what follows it.
      while (i < kids.length) {
        const cardChildren: PMNode[] = [kids[i]!];
        i++;
        while (i < kids.length && kids[i]!.type.name !== 'tag') {
          cardChildren.push(kids[i]!);
          i++;
        }
        out.push(child.type.create(child.attrs, Fragment.fromArray(cardChildren), child.marks));
      }
      return;
    }
    out.push(child);
  });
  return changed ? Fragment.fromArray(out) : frag;
}

/**
 * Heal hollowed tables — the remaining members of the empty-shell
 * family, audited 2026-07-26 when the card variant surfaced. Two node
 * groups have required content: `table` (`table_row+`) and
 * `table_cell` / `table_header` (`paragraph+`). An empty TABLE drops
 * losslessly (every parent that can hold one — doc, card, unit, zone —
 * has a `*` tail). An empty CELL can't drop — that would shift the
 * row's columns — so it's filled with one empty paragraph, which is
 * what an empty cell renders as anyway. Full recursive walk: tables
 * nest inside cards / units / zones, cells inside rows.
 */
export function healTables(doc: PMNode): PMNode {
  function walk(node: PMNode): PMNode | null {
    if (node.type.name === 'table' && node.childCount === 0) return null;
    if (
      (node.type.name === 'table_cell' || node.type.name === 'table_header') &&
      node.childCount === 0
    ) {
      return node.type.create(
        node.attrs,
        Fragment.from(schema.nodes['paragraph']!.create()),
        node.marks,
      );
    }
    if (node.isText || node.childCount === 0) return node;
    let changed = false;
    const out: PMNode[] = [];
    node.forEach((child) => {
      const w = walk(child);
      if (w === null) {
        changed = true;
        return;
      }
      if (w !== child) changed = true;
      out.push(w);
    });
    return changed
      ? node.type.create(node.attrs, Fragment.fromArray(out), node.marks)
      : node;
  }
  return walk(doc) ?? doc;
}

/** Recursively replace every `transclusion_ref` in a fragment with its content
 *  (any depth). Returns the same fragment when there was nothing to unwrap. */
function unwrapZonesIn(frag: Fragment): Fragment {
  let changed = false;
  const out: PMNode[] = [];
  frag.forEach((child) => {
    const inner = child.content.size ? unwrapZonesIn(child.content) : child.content;
    const node = inner === child.content ? child : child.type.create(child.attrs, inner, child.marks);
    if (node.type.name === 'transclusion_ref') {
      changed = true;
      node.content.forEach((c) => out.push(c));
    } else {
      if (node !== child) changed = true;
      out.push(node);
    }
  });
  return changed ? Fragment.fromArray(out) : frag;
}

/**
 * Marks an inline image may carry. Everything else is visual
 * typography that cannot render on a replaced element without
 * artifacts — an inline mark span's height comes from font metrics,
 * not from its image child, so e.g. the emphasis box borders a
 * text-height band straight through the image — and is meaningless
 * beyond the editor: `emitImageRun` writes no run styling, so Word
 * shows nothing either way. `comment_range` stays because comment
 * spans must be continuous across an inline image (the exporter's
 * range reconciliation depends on it); `link` is functional, not
 * visual.
 *
 * The named-style normalizer enforces the same set on live
 * transactions; this module enforces it at load.
 */
export const IMAGE_ALLOWED_MARKS: ReadonlySet<string> = new Set([
  'comment_range',
  'link',
]);

/** Strip disallowed marks (see `IMAGE_ALLOWED_MARKS`) from every
 *  inline image. Same-node return when nothing changed. */
export function stripImageVisualMarks(doc: PMNode): PMNode {
  function walk(node: PMNode): PMNode {
    if (node.type.name === 'image') {
      const kept = node.marks.filter((m) => IMAGE_ALLOWED_MARKS.has(m.type.name));
      return kept.length === node.marks.length ? node : node.mark(kept);
    }
    if (node.isText || node.childCount === 0) return node;
    let changed = false;
    const out: PMNode[] = [];
    node.forEach((child) => {
      const w = walk(child);
      if (w !== child) changed = true;
      out.push(w);
    });
    return changed
      ? node.type.create(node.attrs, Fragment.fromArray(out), node.marks)
      : node;
  }
  return walk(doc);
}

function cardHasAnalytic(card: PMNode): boolean {
  let found = false;
  card.forEach((c) => {
    if (c.type.name === 'analytic') found = true;
  });
  return found;
}

function splitCardOnAnalytics(card: PMNode): PMNode[] {
  const kids: PMNode[] = [];
  card.forEach((c) => kids.push(c));

  const result: PMNode[] = [];
  let i = 0;

  // Children before the first analytic (the tag is always first) stay in the
  // card — all are still valid card content.
  const cardChildren: PMNode[] = [];
  while (i < kids.length && kids[i]!.type.name !== 'analytic') {
    cardChildren.push(kids[i]!);
    i++;
  }
  result.push(card.type.create(card.attrs, Fragment.fromArray(cardChildren), card.marks));

  // Each analytic heads a new unit, absorbing the children that follow it up to
  // the next analytic (or the end of the card).
  while (i < kids.length) {
    const unitChildren: PMNode[] = [kids[i]!]; // the analytic head
    i++;
    while (i < kids.length && kids[i]!.type.name !== 'analytic') {
      unitChildren.push(kids[i]!);
      i++;
    }
    result.push(
      schema.nodes['analytic_unit']!.create(null, Fragment.fromArray(unitChildren)),
    );
  }

  return result;
}
