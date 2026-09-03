/**
 * AI helpers that take an existing `image` node in the doc and
 * produce a follow-up block beneath it:
 *
 *   - `runGenerateAltText` — sends the image to Claude with a
 *     description prompt; inserts a `[ALT TEXT: …]` paragraph
 *     (in the user's omission-bracket style) right after the
 *     textblock containing the image.
 *   - `runGenerateTable` — sends the image to Claude asking for a
 *     structured JSON description of the table; converts the JSON
 *     into a real PM `table` / `table_row` / `table_cell` tree
 *     (with bold / italic inline marks + colspan / rowspan
 *     merges) and inserts it after the image's textblock.
 *
 * Both are gated on the `aiFeaturesEnabled` setting and the user
 * having an Anthropic API key configured. Errors surface as
 * toasts; the doc is never partially modified — every insertion
 * happens in a single transaction at the end of the API call.
 */

import type { Node as PMNode, Mark } from 'prosemirror-model';
import type { Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { schema } from '../../schema/index.js';
import {
  settings,
  condenseWarningCloseFor,
  type CondenseWarningDelimiter,
} from '../settings.js';
import { showToast } from '../toast.js';
import { promptForChoice } from '../text-prompt.js';
import { aiFailureNotice,
  LlmError,
  callLlm,
  VISION_MEDIA_TYPES,
  type LlmContentBlock,
  activeApiKey,
} from './llm.js';
import { AiActivity } from './ai-activity.js';
import { claimRegion } from './edit-coordinator.js';

/** Resolve the user-configured omission-bracket pair. Matches the
 *  same delimiter setting `Condense with warning` uses, so a doc
 *  configured for `<<…>>` omissions gets `<<ALT TEXT: …>>`. */
function currentOmissionBrackets(): { open: string; close: string } {
  const delim = settings.get('condenseWarningDelimiter') as CondenseWarningDelimiter;
  if (delim === 'custom') {
    // 'custom' is reserved for paragraph-replacement strings on the
    // warning command. For alt-text we fall back to the most common
    // bracket pair rather than trying to wrap a multi-character
    // marker around inline text.
    return { open: '[', close: ']' };
  }
  return { open: delim, close: condenseWarningCloseFor(delim) };
}

/** Common preflight: AI enabled? Key set? Returns the key or null
 *  (with a toast already shown). */
function preflight(): string | null {
  if (!settings.get('aiFeaturesEnabled')) {
    showToast('AI features are disabled — enable them in Settings.');
    return null;
  }
  const apiKey = activeApiKey();
  if (!apiKey) {
    showToast('Set an API key in Settings to use AI features.');
    return null;
  }
  return apiKey;
}

/** Anthropic's vision endpoint accepts only common raster formats.
 *  SVG / EMF / TIFF / etc. round-trip through our schema but the
 *  API rejects them, so we bail early with a clear message. */
const VISION_SUPPORTED = VISION_MEDIA_TYPES;

function unsupportedToast(contentType: string): void {
  showToast(`AI vision doesn't support ${contentType}. Try PNG / JPEG / GIF / WebP.`);
}

/** Locate the textblock containing the image (a `paragraph`,
 *  `card_body`, `cite_paragraph`, etc.) so an AI follow-up can be
 *  inserted as a SIBLING of the same type right after it. Inserting
 *  a node the parent's schema doesn't accept would let PM's
 *  structural fitting close-and-reopen ancestors and drift the
 *  insertion to the bottom of the doc; a sibling of the SAME type
 *  at the textblock's `after()` position always fits the parent and
 *  lands where the user expects. */
function findImageContainerInsertion(
  view: EditorView,
  imagePos: number,
): { insertPos: number; sameTypeBlock: PMNode } | null {
  const $pos = view.state.doc.resolve(imagePos);
  if ($pos.depth < 1) return null;
  const containingBlock = $pos.node($pos.depth);
  if (!containingBlock.isTextblock) return null;
  return {
    insertPos: $pos.after($pos.depth),
    sameTypeBlock: containingBlock,
  };
}

/** The image node's doc range, for anchoring the AI-activity cues. */
function imageRange(view: EditorView, imagePos: number): { from: number; to: number } {
  const node = view.state.doc.nodeAt(imagePos);
  return { from: imagePos, to: imagePos + (node?.nodeSize ?? 1) };
}

// ============================================================
// Alt-text generation
// ============================================================

const ALT_TEXT_SYSTEM_PROMPT = `You write short, plain-English alt text for images embedded in debate evidence documents. Keep the description to ONE sentence, under 25 words, factual, no commentary. Do not start with "An image of" or similar filler. Just describe what's visible.

You may also receive surrounding text from the document (the card's tag, cite, and the paragraphs immediately before and after the image) as context. Use it to decide which features of the image are salient enough to mention — but the alt text describes the IMAGE itself, not the surrounding text. Do not quote or summarize the context in the alt text.`;

interface ImageContext {
  tag: string;
  cite: string;
  paragraphBefore: string;
  paragraphAfter: string;
}

/** Gather the four pieces of surrounding context we ship with the
 *  image: the enclosing card's tag and cite (if any), plus the
 *  textblock siblings immediately before and after the image's
 *  containing textblock. Each piece may be empty — the caller
 *  filters empties out before building the prompt. */
function gatherImageContext(view: EditorView, imagePos: number): ImageContext {
  const ctx: ImageContext = { tag: '', cite: '', paragraphBefore: '', paragraphAfter: '' };
  const doc = view.state.doc;
  const $pos = doc.resolve(imagePos);

  // Locate the textblock containing the image. `resolve(imagePos)`
  // lands at the image's position; depth points at the textblock
  // when the parent is a textblock containing inline content.
  let blockDepth = $pos.depth;
  while (blockDepth > 0 && !$pos.node(blockDepth).isTextblock) blockDepth--;
  if (blockDepth === 0) return ctx;

  // Walk ancestors to find the enclosing `card`, if any.
  for (let d = blockDepth - 1; d >= 0; d--) {
    const node = $pos.node(d);
    if (node.type.name === 'card') {
      node.forEach((child) => {
        if (child.type.name === 'tag' && !ctx.tag) {
          ctx.tag = child.textContent.trim();
        } else if (child.type.name === 'cite_paragraph' && !ctx.cite) {
          ctx.cite = child.textContent.trim();
        }
      });
      break;
    }
  }

  // Sibling textblocks at the same level as the image's textblock.
  const parent = $pos.node(blockDepth - 1);
  const idx = $pos.index(blockDepth - 1);
  const siblingTextAt = (i: number): string => {
    if (i < 0 || i >= parent.childCount) return '';
    const child = parent.child(i);
    if (!child.isTextblock) return '';
    return child.textContent.trim();
  };
  ctx.paragraphBefore = siblingTextAt(idx - 1);
  ctx.paragraphAfter = siblingTextAt(idx + 1);

  return ctx;
}

/** Render the gathered context as a single text block to prepend
 *  to the user message. Returns `''` when nothing useful was
 *  gathered (e.g., a doc-level paragraph with no neighbors). */
function formatImageContextForPrompt(ctx: ImageContext): string {
  const lines: string[] = [];
  if (ctx.tag) lines.push(`Card tag: ${ctx.tag}`);
  if (ctx.cite) lines.push(`Cite: ${ctx.cite}`);
  if (ctx.paragraphBefore) lines.push(`Paragraph before the image: ${ctx.paragraphBefore}`);
  if (ctx.paragraphAfter) lines.push(`Paragraph after the image: ${ctx.paragraphAfter}`);
  if (lines.length === 0) return '';
  return `Context from the surrounding document:\n${lines.join('\n')}`;
}

/** Apply the alt-text result to the doc: write `altText` to the
 *  image node's `alt` attribute AND insert a sibling textblock
 *  containing the `[ALT TEXT: …]` bracket below the image's
 *  containing textblock. Both writes happen in a single transaction
 *  so undo lands the doc back where it started.
 *
 *  Returns true on success, false if the insertion point couldn't be
 *  resolved (in which case a toast has already been shown). */
function applyAltTextResult(
  view: EditorView,
  imagePos: number,
  altText: string,
  options: { writeAttribute: boolean },
  dispatch: (tr: Transaction) => void = (tr) => view.dispatch(tr),
): boolean {
  const { open, close } = currentOmissionBrackets();
  const labelText = `${open}ALT TEXT: ${altText}${close}`;
  const target = findImageContainerInsertion(view, imagePos);
  if (!target) {
    showToast('Could not locate insertion point.');
    return false;
  }
  // Confirm the image is still where we expect — the user could have
  // typed during the API roundtrip and shifted positions. If it moved
  // or vanished, drop the result instead of mutating the wrong node.
  const live = view.state.doc.nodeAt(imagePos);
  if (!live || live.type.name !== 'image') {
    showToast('Image moved while generating — alt text not applied.');
    return false;
  }
  const sibling = target.sameTypeBlock.type.create(null, schema.text(labelText));
  let tr = view.state.tr;
  if (options.writeAttribute) {
    // setNodeMarkup on the atomic image keeps the doc size unchanged,
    // so the insertPos resolved above remains valid afterwards.
    tr = tr.setNodeMarkup(imagePos, undefined, { ...live.attrs, alt: altText });
  }
  tr = tr.insert(target.insertPos, sibling);
  dispatch(tr.scrollIntoView());
  return true;
}

export function runGenerateAltText(
  view: EditorView,
  imagePos: number,
  imageNode: PMNode,
): void {
  const contentType = String(imageNode.attrs['contentType'] ?? '');
  const data = String(imageNode.attrs['data'] ?? '');
  const existingAlt = String(imageNode.attrs['alt'] ?? '').trim();

  // If the image already has alt text on its attribute, give the user
  // a chance to keep it (free, no API call) before spending tokens. If
  // they choose to regenerate, we fall through to the AI path below.
  // If they cancel, we leave the doc untouched.
  if (existingAlt) {
    void (async () => {
      const choice = await promptForChoice<'keep' | 'regenerate'>({
        message: 'This image already has alt text.',
        detail: existingAlt,
        choices: [
          { value: 'keep', label: 'Keep current', primary: true },
          { value: 'regenerate', label: 'Regenerate with AI' },
        ],
      });
      if (choice === null) return;
      if (choice === 'keep') {
        // Copy the existing alt text into a visible bracket below the
        // image. The attribute is already correct — no need to write it.
        applyAltTextResult(view, imagePos, existingAlt, { writeAttribute: false });
        return;
      }
      // 'regenerate' — fall through to the AI path. Re-validate the
      // preconditions (key, supported format) at this point since the
      // user has just committed to a network call.
      runAiAltTextRequest(view, imagePos, contentType, data);
    })();
    return;
  }

  // No existing alt text — go straight to AI.
  runAiAltTextRequest(view, imagePos, contentType, data);
}

/** Internal worker: actually hit the Anthropic API to describe the
 *  image, then apply the result to BOTH the attribute and the bracket
 *  below the image. Split out from `runGenerateAltText` so the
 *  "regenerate" branch of the existing-alt-text dialog can call it
 *  without re-running the upfront checks. */
function runAiAltTextRequest(
  view: EditorView,
  imagePos: number,
  contentType: string,
  data: string,
): void {
  const apiKey = preflight();
  if (!apiKey) return;

  if (!VISION_SUPPORTED.has(contentType) || !data) {
    unsupportedToast(contentType || 'unknown');
    return;
  }

  // Lease the image node so the alt-text bracket lands at the image even
  // if the doc shifts during the request, and the image can't be deleted
  // out from under the op.
  const lease = claimRegion(view, imageRange(view, imagePos), { label: 'image-alt' });
  if (!lease) {
    showToast('Another AI edit is working on this image — try again in a moment.');
    return;
  }

  const activity = new AiActivity(view, imageRange(view, imagePos), 'selection');
  activity.start();

  const contextText = formatImageContextForPrompt(gatherImageContext(view, imagePos));

  void (async () => {
    try {
      const userContent: LlmContentBlock[] = [];
      if (contextText) userContent.push({ type: 'text', text: contextText });
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: contentType, data },
      });
      userContent.push({ type: 'text', text: 'Write the alt text for this image.' });
      const reply = await callLlm({
        apiKey,
        system: ALT_TEXT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      });
      const altText = reply.text.trim().replace(/\s+/g, ' ');
      if (!altText) {
        showToast('AI returned an empty response.');
        return;
      }
      // Insert as a SIBLING textblock of the same type as the one
      // containing the image (paragraph, card_body, etc.) so PM's
      // structural fitting doesn't bounce the new node out of the
      // surrounding container. Also writes the result back to
      // `image.attrs.alt` so OOXML export preserves it. The image's
      // current position comes from the lease (edits elsewhere may have
      // shifted it); null means it was removed.
      const region = lease.region();
      if (!region) {
        showToast('Image moved while generating — alt text not applied.');
        return;
      }
      applyAltTextResult(view, region.from, altText, { writeAttribute: true }, (tr) => lease.apply(tr));
    } catch (err) {
      if (err instanceof LlmError) {
        aiFailureNotice('Alt text', err);
      } else {
        aiFailureNotice('Alt text', err);
      }
    } finally {
      lease.release();
      activity.stop();
    }
  })();
}

// ============================================================
// Table-from-image generation
// ============================================================

interface CellSpec {
  text: string;
  bold?: boolean;
  italic?: boolean;
  colspan?: number;
  rowspan?: number;
}

interface RowSpec { cells: CellSpec[] }
interface TableSpec { rows: RowSpec[] }

/** The table JSON schema + formatting rules, shared by the extraction
 *  prompt and the repair prompt so they can never drift apart.
 *
 *  Cells are kept COMPACT — only non-default fields are emitted —
 *  because emitting all five keys on every cell (~80 bytes of
 *  `false`/`1` boilerplate per plain cell) pushes large tables past
 *  the token limit. The validator defaults any missing field, so
 *  `{ "text": "..." }` is a complete plain cell. */
const TABLE_SCHEMA_AND_RULES = `the JSON schema (cells keep ONLY the fields they need):
{
  "rows": [
    { "cells": [ { "text": "string", "bold": true, "italic": true, "colspan": 2, "rowspan": 2 } ] }
  ]
}

Rules:
- One "rows" entry per visible row; one "cells" entry per visible cell.
- OMIT cells that are spanned over by a merge from a previous cell (they are represented by colspan/rowspan on the merging cell).
- "text" is the visible cell content as a plain string. Use a single space to separate words across line wraps.
- Keep the JSON COMPACT to avoid running out of room: include "bold"/"italic" ONLY when they are true, and "colspan"/"rowspan" ONLY when they are greater than 1. Omit them otherwise — a plain, unmerged cell is just { "text": "..." }.
- (When you do include bold/italic, they reflect the dominant style of the whole cell.)
- Do NOT include keys other than the five above.
- Do NOT include any text outside the JSON.`;

const TABLE_SYSTEM_PROMPT = `You extract tables from images. Return ONLY valid JSON in ${TABLE_SCHEMA_AND_RULES}`;

/** Repair prompt — given a previous model's output that FAILED schema
 *  validation, reformat it into valid JSON without inventing content. */
const TABLE_REPAIR_SYSTEM_PROMPT = `You repair malformed table data. You are given another model's output that was supposed to be table JSON but FAILED validation (wrong shape, extra keys, markdown table, prose, truncation, etc.). Rewrite it as valid JSON matching exactly ${TABLE_SCHEMA_AND_RULES}

Preserve all of the table's content and structure from the input as faithfully as possible — do not add, drop, or invent rows, cells, or text. Just fix the format. Return ONLY the corrected JSON.`;

/** Extract a JSON object from a model response that may have extra
 *  prose, code fences, or trailing commentary. Returns null when no
 *  parsable JSON is found. */
function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  // Try direct parse first.
  try { return JSON.parse(trimmed); } catch { /* fall through */ }
  // Strip a markdown code fence if present.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1]!); } catch { /* fall through */ }
  }
  // Pull the first {…} balanced span.
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(trimmed.slice(start, end + 1)); } catch { /* fall through */ }
  }
  return null;
}

function validateTableSpec(raw: unknown): TableSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const rowsRaw = (raw as { rows?: unknown }).rows;
  if (!Array.isArray(rowsRaw) || rowsRaw.length === 0) return null;
  const rows: RowSpec[] = [];
  for (const r of rowsRaw) {
    if (!r || typeof r !== 'object') return null;
    const cellsRaw = (r as { cells?: unknown }).cells;
    if (!Array.isArray(cellsRaw)) return null;
    const cells: CellSpec[] = [];
    for (const c of cellsRaw) {
      if (!c || typeof c !== 'object') return null;
      const cellObj = c as Record<string, unknown>;
      const text = typeof cellObj['text'] === 'string' ? cellObj['text'] : '';
      const colspan = typeof cellObj['colspan'] === 'number' && cellObj['colspan'] >= 1
        ? Math.floor(cellObj['colspan'] as number) : 1;
      const rowspan = typeof cellObj['rowspan'] === 'number' && cellObj['rowspan'] >= 1
        ? Math.floor(cellObj['rowspan'] as number) : 1;
      cells.push({
        text,
        bold: cellObj['bold'] === true,
        italic: cellObj['italic'] === true,
        colspan,
        rowspan,
      });
    }
    rows.push({ cells });
  }
  return { rows };
}

/** Extract + validate a table spec from a raw model reply. Returns null
 *  when the reply isn't (or doesn't contain) a valid table description. */
function parseTableSpec(text: string): TableSpec | null {
  return validateTableSpec(extractJsonObject(text));
}

/** Build a PM `table` node from the validated spec. */
function buildTableNode(spec: TableSpec): PMNode {
  const tableType = schema.nodes['table']!;
  const rowType = schema.nodes['table_row']!;
  const cellType = schema.nodes['table_cell']!;
  const paraType = schema.nodes['paragraph']!;
  const boldMark = schema.marks['bold'];
  const italicMark = schema.marks['italic'];

  const rowNodes: PMNode[] = [];
  for (const row of spec.rows) {
    const cellNodes: PMNode[] = [];
    for (const cell of row.cells) {
      const marks: Mark[] = [];
      if (cell.bold && boldMark) marks.push(boldMark.create());
      if (cell.italic && italicMark) marks.push(italicMark.create());
      // table_cell content is `paragraph+`. Cells always have at
      // least one paragraph; empty cells get a single empty para.
      const paraContent = cell.text
        ? [schema.text(cell.text, marks.length ? marks : null)]
        : [];
      const paragraph = paraType.create(null, paraContent);
      cellNodes.push(cellType.createChecked(
        { colspan: cell.colspan ?? 1, rowspan: cell.rowspan ?? 1 },
        [paragraph],
      ));
    }
    rowNodes.push(rowType.createChecked(null, cellNodes));
  }
  // createChecked throughout (audit tier 4): this builds nodes from
  // MODEL-derived JSON and inserts them as closed content, which the
  // step machinery splices past validation — safe today only because
  // the current schema happens to allow every shape validateTableSpec
  // admits (e.g. empty rows). Checked construction turns a future
  // schema tightening into a loud throw at build time instead of a
  // silently-invalid doc.
  return tableType.createChecked(null, rowNodes);
}

export function runGenerateTable(
  view: EditorView,
  imagePos: number,
  imageNode: PMNode,
): void {
  const apiKey = preflight();
  if (!apiKey) return;

  const contentType = String(imageNode.attrs['contentType'] ?? '');
  const data = String(imageNode.attrs['data'] ?? '');
  if (!VISION_SUPPORTED.has(contentType) || !data) {
    unsupportedToast(contentType || 'unknown');
    return;
  }

  // Lease the image node so the extracted table inserts at the image even
  // if the doc shifts during the (possibly two-call) request.
  const lease = claimRegion(view, imageRange(view, imagePos), { label: 'image-table' });
  if (!lease) {
    showToast('Another AI edit is working on this image — try again in a moment.');
    return;
  }

  const activity = new AiActivity(view, imageRange(view, imagePos), 'selection');
  activity.start();

  void (async () => {
    try {
      const reply = await callLlm({
        apiKey,
        system: TABLE_SYSTEM_PROMPT,
        // Big headroom — a large table is a lot of JSON, and a low
        // cap truncates it silently (stop_reason 'max_tokens',
        // cut-off JSON that fails to parse). The compact schema
        // above shrinks the output; this is the safety margin.
        maxTokens: 16384,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: contentType, data } },
              { type: 'text', text: 'Extract the table from this image.' },
            ],
          },
        ],
      });
      let spec = parseTableSpec(reply.text);
      if (!spec) {
        if (reply.stopReason === 'max_tokens') {
          // Truncated by the token limit — the JSON is genuinely cut off,
          // so the data is incomplete. A repair pass can't recover missing
          // rows, so don't pretend; tell the user it was too big.
          showToast('That table is too large for the AI to extract in one go.');
          return;
        }
        // Not truncated, just malformed (markdown, prose, wrong keys, …).
        // Hand the broken output to a second pass to reformat into the
        // schema — a text-only call (no image), purely a formatting fix.
        // The "Thinking…" tooltip stays up across both calls.
        const repair = await callLlm({
          apiKey,
          system: TABLE_REPAIR_SYSTEM_PROMPT,
          maxTokens: 16384,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Previous output that failed validation:\n\n${reply.text}`,
                },
              ],
            },
          ],
        });
        spec = parseTableSpec(repair.text);
      }
      if (!spec) {
        showToast('AI response wasn\'t a valid table description.');
        return;
      }
      const tableNode = buildTableNode(spec);
      // The image's current position comes from the lease (edits elsewhere
      // may have shifted it); null means it was removed mid-request.
      const region = lease.region();
      if (!region) {
        showToast('Image moved while extracting — table not inserted.');
        return;
      }
      const target = findImageContainerInsertion(view, region.from);
      if (!target) {
        showToast('Could not locate insertion point.');
        return;
      }
      const tr = view.state.tr.insert(target.insertPos, tableNode);
      lease.apply(tr.scrollIntoView());
    } catch (err) {
      if (err instanceof LlmError) {
        aiFailureNotice('Image to table', err);
      } else {
        aiFailureNotice('Image to table', err);
      }
    } finally {
      lease.release();
      activity.stop();
    }
  })();
}
