/**
 * AI repair text — ported from CardMirror's `ai/repair-text.ts`.
 *
 * Repair is a minimal-intervention task (fix OCR / PDF extraction
 * artifacts, change nothing else). Round-tripping the whole selection
 * through the model would maximize the chance it silently rewords
 * something and wastes output tokens on text that's 99% unchanged.
 * Instead the model returns `{ fixes: [{ find, replace }] }`, each
 * `find` a verbatim substring of the selection; we locate each in the
 * doc and apply it in place. The model literally cannot touch anything
 * it doesn't name.
 *
 * Locating: the selection is flattened to text with `\n` between blocks
 * (so the model doesn't read paragraph boundaries as run-together
 * words) plus a char→PM-position map. A `find` that spans a block
 * boundary maps to a doc range crossing it; `insertText` over that
 * range joins the blocks — which is exactly right for hyphenation split
 * across lines ("re-\nsearch").
 *
 * Unlike upstream, this v1 port runs a SINGLE pass (no two-pass re-read,
 * no flash-highlight animation, no edit-coordinator region lease, no
 * settings/toast/AiActivity dependencies — none of that infrastructure
 * exists in reason-editor). It snapshots the flattened selection text
 * and, right before applying, re-flattens and compares, refusing the
 * edit if the document changed while the request was in flight.
 */

import type { EditorView } from "@tiptap/pm/view";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import { callAnthropic } from "./anthropic-client.js";

export const DEFAULT_REPAIR_PROMPT = `You are a specialized text repair tool. Your task is to identify and fix common OCR and PDF text-extraction errors while preserving the original meaning and content exactly.

Focus exclusively on these types of errors:
1. Character substitutions and ligature issues (e.g., "fl" appearing as "ff", "fi" appearing as a missing-glyph box)
2. Number/letter confusions (e.g., "0" for "O", "l" for "1", "rn" for "m"). Note that some numbers should be preserved because they are footnotes.
3. Random line breaks or hyphenation (e.g., "re-\\nsearch" should be "research")
4. A stray space after (or before) a hyphen inside a word — VERY common in PDF extraction. Two sub-cases:
   - If the word is a genuinely hyphenated compound or prefixed term, KEEP the hyphen and remove only the stray space (e.g., "neo- Gramscian" should be "neo-Gramscian"; "vis-a- vis" should be "vis-a-vis"; "self- determination" should be "self-determination").
   - If it is an ordinary word that was split across a line, remove the hyphen AND the space (e.g., "re- search" should be "research").
5. Extra or missing spaces (e.g., "thisis" should be "this is")
   - This includes hyphenated compounds run together with the hyphen lost ("welldesigned" should be "well-designed") and words fused across a removed break ("polisis seen" should be "polis is seen"). The find MUST quote the run-together form exactly as it appears in the input — NEVER quote a hyphenated or spaced form you infer the text used to have.
6. Common punctuation errors (e.g., missing periods, commas appearing as periods)
7. Other typical OCR errors that are clearly unintentional

EXTREMELY IMPORTANT GUIDELINES:
- Make NO substantive changes to the text's meaning or content.
- NEVER add, remove, or modify actual content; NEVER rewrite for clarity or style.
- NEVER correct grammar, spelling, or word choice unless it is clearly an OCR error.
- If there is ANY uncertainty about a potential error, leave the text as is.
- A line break (shown as a newline in the input) is a real paragraph boundary. Do NOT merge across one unless it is a hyphenation artifact (a word split with a trailing hyphen).

BE EXHAUSTIVE. Scan the WHOLE input from the very first character to the very last — do not stop early or skim once you've found several errors. Pay special attention to spots that are easy to overlook:
- the FIRST word of every paragraph / sentence, including Capitalized words (errors there are easy to miss);
- the last paragraph and the final lines of the text;
- repeated errors — list EACH occurrence separately, even if you already fixed the same word elsewhere.
Re-read the text once more before you finish to catch anything you skipped.

Respond with ONLY a JSON object of exactly this shape — no prose, no code fences:

{"fixes": [{"find": "<text>", "replace": "<text>"}]}

Rules for the list:
- "find" MUST be copied VERBATIM from the input I give you — character for character, including any newlines (write them as actual \\n in the JSON string). Copy what the text says NOW, not what it should have said: to fix "welldesigned", the find is "welldesigned" — a find quoting "well-\\ndesigned" will not locate.
- The input contains quotation marks — escape every double quote inside "find" and "replace" as \\" so the JSON stays valid.
- Include enough surrounding context in "find" that it occurs only once (or, if a fix repeats, list it once per occurrence in reading order).
- "replace" is "find" with ONLY the OCR/PDF error corrected; everything else in it stays identical.
- List the fixes in the order they appear in the text.
- If there are no errors, return {"fixes": []}.`;

export interface RepairFix {
  find: string;
  replace: string;
}

/** Heuristic salvage for the model's most common JSON slip: an
 *  UNESCAPED double quote (or literal newline) inside a string value —
 *  debate evidence is full of quotation marks, and one missed escape
 *  used to kill the whole response. Walks the string tracking
 *  inside-string state; an interior `"` not followed (after
 *  whitespace) by a structural character is escaped. */
export function salvageJson(s: string): string {
  let out = "";
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (!inStr) {
      if (ch === '"') inStr = true;
      out += ch;
      continue;
    }
    if (ch === "\\") {
      out += ch + (s[i + 1] ?? "");
      i++;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j]!)) j++;
      const next = s[j];
      if (next === "," || next === "}" || next === "]" || next === ":" || next === undefined) {
        inStr = false;
        out += ch;
      } else {
        out += '\\"';
      }
      continue;
    }
    if (ch === "\n") {
      out += "\\n";
      continue;
    }
    if (ch === "\r") continue;
    out += ch;
  }
  return out;
}

/** Balanced top-level `{...}` chunks in `s`, tracked string-aware so
 *  braces inside values don't miscount. Prose between objects is
 *  skipped. */
export function extractJsonObjects(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let objStart = -1;
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      if (depth > 0) inStr = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === "}" && depth > 0) {
      depth--;
      if (depth === 0 && objStart >= 0) {
        out.push(s.slice(objStart, i + 1));
        objStart = -1;
      }
    }
  }
  return out;
}

/** Parse the model's JSON reply into a list of fixes. Tolerates code
 *  fences / surrounding prose (outermost `{...}` extraction), unescaped
 *  interior quotes (`salvageJson`), and MULTIPLE top-level JSON objects
 *  or trailing junk. Drops malformed entries; throws only when nothing
 *  parseable is present. */
export function parseRepairResponse(text: string): RepairFix[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Repair response had no JSON object.");
  }
  const raw = text.slice(start, end + 1);
  let parsed: unknown;
  let mergedFixes: unknown[] | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    try {
      parsed = JSON.parse(salvageJson(raw));
      console.warn("[repair] response JSON needed quote-escape salvage");
    } catch {
      const chunks = extractJsonObjects(salvageJson(raw));
      const merged: unknown[] = [];
      let parsedChunks = 0;
      for (const c of chunks) {
        try {
          const o = JSON.parse(c) as { fixes?: unknown };
          parsedChunks++;
          if (Array.isArray(o?.fixes)) merged.push(...o.fixes);
        } catch {
          // skip the unparseable chunk; others may still carry fixes
        }
      }
      if (parsedChunks === 0) {
        throw new Error(
          `Repair response was not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      console.warn(
        `[repair] response carried ${chunks.length} JSON objects — parsed ${parsedChunks}, merged fixes`,
      );
      mergedFixes = merged;
    }
  }
  const rawFixes = mergedFixes ?? (parsed as { fixes?: unknown })?.fixes;
  if (!Array.isArray(rawFixes)) return [];
  const out: RepairFix[] = [];
  for (const f of rawFixes) {
    if (
      f &&
      typeof (f as RepairFix).find === "string" &&
      typeof (f as RepairFix).replace === "string" &&
      (f as RepairFix).find.length > 0 &&
      (f as RepairFix).find !== (f as RepairFix).replace
    ) {
      out.push({ find: (f as RepairFix).find, replace: (f as RepairFix).replace });
    }
  }
  return out;
}

interface FlatSelection {
  text: string;
  /** `pos[i]` = the PM position immediately before flat char `i`. */
  pos: number[];
}

/** Flatten `[from, to)` to text with `\n` between blocks (so the model
 *  reads paragraph boundaries, not run-together words) and a
 *  char→position map. Images are skipped (repair is text-only). */
export function flattenSelection(doc: PMNode, from: number, to: number): FlatSelection {
  let text = "";
  const pos: number[] = [];
  let lastParent: PMNode | null = null;
  let prevTextEnd = from;
  doc.nodesBetween(from, to, (node, p, parent) => {
    if (!node.isText) return true;
    const t = node.text ?? "";
    const s = Math.max(from, p);
    const e = Math.min(to, p + t.length);
    if (e <= s) return false;
    if (lastParent !== null && parent !== lastParent && text.length > 0) {
      // Block boundary → newline, anchored at the end of the previous block.
      text += "\n";
      pos.push(prevTextEnd);
    }
    for (let i = s; i < e; i++) {
      text += t[i - p];
      pos.push(i);
    }
    prevTextEnd = e;
    lastParent = parent;
    return false;
  });
  return { text, pos };
}

/** Right edge (PM position) of the flat char at `idx-1`. */
function endPos(flat: FlatSelection, idx: number): number {
  if (idx < flat.pos.length) return flat.pos[idx]!;
  return (flat.pos[flat.pos.length - 1] ?? 0) + 1;
}

export interface LocatedFix {
  from: number;
  to: number;
  replace: string;
}

/** Fold the characters the model routinely fails to echo verbatim,
 *  keeping a map from each folded char back to its raw index (a
 *  multi-char fold like a ligature maps every output char to the same
 *  raw index). Curly quotes/dashes -> ASCII, ligatures expanded, NBSP /
 *  tab / newline -> space, soft hyphen and zero-width characters
 *  dropped. The pilcrow glyph is deliberately NOT folded: it is
 *  meaningful condensed-card content, and a folded match spanning one
 *  would silently delete it. */
function foldWithMap(s: string, lower = true): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    let out: string;
    if (ch === "‘" || ch === "’" || ch === "‚") out = "'";
    else if (ch === "“" || ch === "”" || ch === "„") out = '"';
    else if (ch === "—" || ch === "–" || ch === "‒") out = "-";
    else if (ch === " " || ch === "\t" || ch === "\n") out = " ";
    else if (ch === "ﬀ") out = "ff";
    else if (ch === "ﬁ") out = "fi";
    else if (ch === "ﬂ") out = "fl";
    else if (ch === "ﬃ") out = "ffi";
    else if (ch === "ﬄ") out = "ffl";
    else if (
      ch === "­" ||
      ch === "​" ||
      ch === "‌" ||
      ch === "‍" ||
      ch === "﻿"
    )
      out = "";
    else out = ch;
    // Case-fold too (searching only): the model misquotes
    // capitalization in context ("in much of…" for a doc reading "In
    // much of…"). The find→replace DIFF is computed case-SENSITIVELY
    // (lower=false) so intentional case fixes survive as a middle.
    if (lower) out = out.toLowerCase();
    norm += out;
    for (let k = 0; k < out.length; k++) map.push(i);
  }
  return { norm, map };
}

/** Fallback placement when the verbatim search misses: match in folded
 *  space, then apply ONLY the differing middle of find->replace -- the
 *  actual correction. The agreeing prefix/suffix are never edited, so
 *  the document keeps its punctuation and ligatures there, and the
 *  CONTEXT may even span a block boundary (models often write a space
 *  where the doc has a newline). Rejected only when the edit itself
 *  would cross a block boundary -- joining or splitting blocks from a
 *  non-verbatim match is too risky. */
function locateNormalized(
  flat: FlatSelection,
  hay: { norm: string; map: number[] },
  fix: RepairFix,
  cursorFlat: number,
): (LocatedFix & { cursorFlat: number }) | null {
  const nf = foldWithMap(fix.find);
  const nr = foldWithMap(fix.replace);
  if (!nf.norm) return null;
  // First occurrence at/after the flat cursor, falling back to the first
  // occurrence anywhere (mirrors the verbatim search's ordering rules).
  let idx = -1;
  for (let i = hay.norm.indexOf(nf.norm); i >= 0; i = hay.norm.indexOf(nf.norm, i + 1)) {
    if (hay.map[i]! >= cursorFlat) {
      idx = i;
      break;
    }
    if (idx < 0) idx = i; // remember the global-first as fallback
  }
  if (idx < 0) return null;
  const flatEnd = hay.map[idx + nf.norm.length - 1]! + 1;

  // Agreeing prefix/suffix between find and replace. Compared
  // CASE-SENSITIVELY (the comparison is model-internal, so the model's
  // context-case misquotes agree with themselves) — otherwise a fix
  // whose whole point is a case change ("Of" → "of") folds to an empty
  // middle and gets discarded as a no-op.
  // Case-preserving folds share indices with the case-folded ones unless
  // a locale oddity changes length under lowercasing — then fall back to
  // the case-folded comparison.
  const nfc = foldWithMap(fix.find, false);
  const nrc = foldWithMap(fix.replace, false);
  const useCased = nfc.norm.length === nf.norm.length && nrc.norm.length === nr.norm.length;
  const fNorm = useCased ? nfc.norm : nf.norm;
  const rNorm = useCased ? nrc.norm : nr.norm;
  let p = 0;
  while (p < fNorm.length && p < rNorm.length && fNorm[p] === rNorm[p]) p++;
  let s = 0;
  while (
    s < fNorm.length - p &&
    s < rNorm.length - p &&
    fNorm[fNorm.length - 1 - s] === rNorm[rNorm.length - 1 - s]
  )
    s++;
  // Don't split a multi-char fold (ligature) at either boundary -- back
  // the boundary off until it sits between whole raw characters.
  while (
    p > 0 &&
    ((p < nf.norm.length && hay.map[idx + p - 1] === hay.map[idx + p]) ||
      (p < nr.norm.length && nr.map[p - 1] === nr.map[p]))
  )
    p--;
  while (
    s > 0 &&
    ((s < nf.norm.length &&
      hay.map[idx + nf.norm.length - s - 1] === hay.map[idx + nf.norm.length - s]) ||
      (s < nr.norm.length && nr.map[nr.norm.length - s - 1] === nr.map[nr.norm.length - s]))
  )
    s--;

  // The edit region (flat space): everything between the agreeing ends.
  const midStartFlat = p > 0 ? hay.map[idx + p - 1]! + 1 : hay.map[idx]!;
  const midEndFlat = s > 0 ? hay.map[idx + nf.norm.length - s]! : flatEnd;
  if (midStartFlat > midEndFlat) return null; // degenerate alignment
  if (flat.text.slice(midStartFlat, midEndFlat).includes("\n")) return null;

  const midStartRaw = p < nr.norm.length ? nr.map[p]! : fix.replace.length;
  const midEndRaw = s > 0 ? nr.map[nr.norm.length - s]! : fix.replace.length;
  const replace = fix.replace.slice(midStartRaw, midEndRaw);
  if (!replace && midStartFlat === midEndFlat) return null; // no-op after folding

  return {
    from: flat.pos[midStartFlat] ?? endPos(flat, midStartFlat),
    to: endPos(flat, midEndFlat),
    replace,
    cursorFlat: flatEnd,
  };
}

/** Last resort when even the folded search misses: the model sometimes
 *  misquotes its context a word away from the actual edit. Trim whole
 *  context words off the find's ends (within the agreeing prefix/suffix
 *  only, so the edit middle is untouched) and retry, smallest trim
 *  first. Fixes arrive in reading order, so the cursor-first search
 *  keeps a less-unique trimmed needle honest; a minimum needle length
 *  bounds the misplacement risk. */
function locateTrimmed(
  flat: FlatSelection,
  hay: { norm: string; map: number[] },
  fix: RepairFix,
  cursorFlat: number,
): (LocatedFix & { cursorFlat: number }) | null {
  const nf = foldWithMap(fix.find);
  const nr = foldWithMap(fix.replace);
  if (!nf.norm) return null;
  let p = 0;
  while (p < nf.norm.length && p < nr.norm.length && nf.norm[p] === nr.norm[p]) p++;
  let s = 0;
  while (
    s < nf.norm.length - p &&
    s < nr.norm.length - p &&
    nf.norm[nf.norm.length - 1 - s] === nr.norm[nr.norm.length - 1 - s]
  )
    s++;

  // Candidate cut points at word boundaries inside the agreeing regions:
  // leadCuts[i] = folded index after dropping i leading words;
  // tailCuts[i] = folded end after dropping i trailing words.
  const leadCuts: number[] = [0];
  for (let i = 1; i <= p && leadCuts.length <= 3; i++) {
    if (nf.norm[i - 1] === " ") leadCuts.push(i);
  }
  const tailCuts: number[] = [nf.norm.length];
  for (let j = nf.norm.length - 1; j >= nf.norm.length - s && tailCuts.length <= 3; j--) {
    if (nf.norm[j] === " ") tailCuts.push(j);
  }

  for (let totalDrop = 1; totalDrop <= 4; totalDrop++) {
    for (let li = 0; li <= totalDrop; li++) {
      const ti = totalDrop - li;
      if (li >= leadCuts.length || ti >= tailCuts.length) continue;
      const L = leadCuts[li]!;
      const R = tailCuts[ti]!;
      if (R - L < 10) continue; // too short to trust
      const rawFindL = nf.map[L]!;
      const rawFindR = R < nf.norm.length ? nf.map[R]! : fix.find.length;
      const keepTail = nf.norm.length - R;
      const rawRepL = L < nr.norm.length ? nr.map[L]! : fix.replace.length;
      const rawRepREnd = nr.norm.length - keepTail;
      const rawRepR = rawRepREnd < nr.norm.length ? nr.map[rawRepREnd]! : fix.replace.length;
      const trimmed: RepairFix = {
        find: fix.find.slice(rawFindL, rawFindR),
        replace: fix.replace.slice(rawRepL, rawRepR),
      };
      if (!trimmed.find || trimmed.find === trimmed.replace) continue;
      const hit = locateNormalized(flat, hay, trimmed, cursorFlat);
      if (hit) return hit;
    }
  }
  return null;
}

/** Locate each fix in the flattened selection, sequentially (search
 *  forward from the previous match, falling back to a global search),
 *  and map it to a non-overlapping doc range. A verbatim miss retries
 *  in folded space (smart quotes/dashes/invisibles — the things models
 *  fail to echo verbatim). Returns the located edits plus the count
 *  that couldn't be placed. */
export function locateFixes(
  flat: FlatSelection,
  fixes: readonly RepairFix[],
): { located: LocatedFix[]; skipped: number; notFound: RepairFix[]; overlapped: RepairFix[] } {
  const matched: (LocatedFix & { fix: RepairFix })[] = [];
  const notFound: RepairFix[] = [];
  let hay: { norm: string; map: number[] } | null = null;
  let cursor = 0;
  for (const fix of fixes) {
    let idx = flat.text.indexOf(fix.find, cursor);
    if (idx < 0) idx = flat.text.indexOf(fix.find); // out-of-order fallback
    if (idx < 0) {
      hay ??= foldWithMap(flat.text);
      const alt = locateNormalized(flat, hay, fix, cursor) ?? locateTrimmed(flat, hay, fix, cursor);
      if (alt) {
        cursor = alt.cursorFlat;
        matched.push({ from: alt.from, to: alt.to, replace: alt.replace, fix });
      } else {
        notFound.push(fix);
      }
      continue;
    }
    // Reduce the verbatim match to its differing MIDDLE — the actual
    // correction. The agreeing context never needs editing, and using
    // edit-sized ranges lets fixes with overlapping context windows
    // coexist.
    let p = 0;
    const fLen = fix.find.length;
    const rLen = fix.replace.length;
    while (p < fLen && p < rLen && fix.find[p] === fix.replace[p]) p++;
    let s = 0;
    while (s < fLen - p && s < rLen - p && fix.find[fLen - 1 - s] === fix.replace[rLen - 1 - s]) s++;
    const fromFlat = idx + p;
    const toFlat = idx + fLen - s;
    const from = fromFlat < flat.pos.length ? flat.pos[fromFlat]! : endPos(flat, fromFlat);
    const to = endPos(flat, toFlat);
    cursor = idx + fLen;
    matched.push({ from, to, replace: fix.replace.slice(p, rLen - s), fix });
  }
  // Drop overlaps (keep earlier), then order high→low for safe application.
  matched.sort((a, b) => a.from - b.from);
  const located: LocatedFix[] = [];
  const overlapped: RepairFix[] = [];
  let lastTo = -1;
  let lastInsertAt = -1;
  for (const m of matched) {
    // An EXACT duplicate of the edit just placed (the model lists one
    // correction under two context wordings) is not a loss — drop it
    // silently so the skip count only reports real failures.
    const prev = located[located.length - 1];
    if (prev && prev.from === m.from && prev.to === m.to && prev.replace === m.replace) {
      continue;
    }
    // Overlap, or a conflicting insertion at the same point — applying
    // both would double or garble the inserted text.
    if (m.from < lastTo || (m.from === m.to && m.from === lastInsertAt)) {
      overlapped.push(m.fix);
      continue;
    }
    located.push({ from: m.from, to: m.to, replace: m.replace });
    lastTo = m.to;
    if (m.from === m.to) lastInsertAt = m.from;
  }
  return { located, skipped: notFound.length + overlapped.length, notFound, overlapped };
}

/** Build the transaction applying located fixes. Applies high→low so
 *  each edit's positions stay valid; `insertText` across a block
 *  boundary joins the blocks (the hyphenation case). */
export function buildRepairTransaction(
  state: EditorState,
  located: readonly LocatedFix[],
): Transaction {
  const tr = state.tr;
  // Apply high→low using ORIGINAL positions (non-overlapping, so lower
  // edits are unaffected by higher ones). A middle-only edit can be a
  // pure deletion — insertText('') would throw on the empty text node.
  for (let i = located.length - 1; i >= 0; i--) {
    const l = located[i]!;
    if (l.replace) tr.insertText(l.replace, l.from, l.to);
    else if (l.to > l.from) tr.delete(l.from, l.to);
  }
  return tr;
}

/** Fold the variants the model routinely fails to echo verbatim: smart
 *  quotes/dashes → ASCII, NBSP → space, and the invisible-ish glyphs
 *  (pilcrow, soft hyphen, zero-width chars) dropped. Used by the skip
 *  diagnostic to classify WHY a find missed. */
export function normalizeForDiagnosis(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[—–‒]/g, "--")
    .replace(/ /g, " ")
    .replace(/[¶­​‌‍﻿]/g, "");
}

/** The document text around the longest find-token that exists in the
 *  selection — the decisive datum for diagnosing a no-match: it shows
 *  what the doc ACTUALLY says where the model thought its quote was. */
function excerptNear(flat: FlatSelection, find: string): string | null {
  const tokens = find
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .sort((a, b) => b.length - a.length);
  for (const tok of tokens) {
    const i = flat.text.indexOf(tok);
    if (i >= 0) {
      return flat.text.slice(Math.max(0, i - 40), Math.min(flat.text.length, i + tok.length + 40));
    }
  }
  return null;
}

/** Console diagnosis for unplaced fixes — classifies each miss so live
 *  failures are attributable: 'normalization' (a smart-quote/dash/
 *  pilcrow echo problem — a tolerant locator would have placed it) vs
 *  'no-match' (the model invented or mangled text), with the actual
 *  nearby doc text for the no-match case. */
function logUnplaced(flat: FlatSelection, notFound: RepairFix[], overlapped: RepairFix[]): void {
  if (notFound.length === 0 && overlapped.length === 0) return;
  const normHay = normalizeForDiagnosis(flat.text);
  for (const f of notFound) {
    const kind = normHay.includes(normalizeForDiagnosis(f.find)) ? "normalization" : "no-match";
    console.warn(
      `[repair] could not place (${kind}): find=${JSON.stringify(f.find)} replace=${JSON.stringify(f.replace)}`,
    );
    if (kind === "no-match") {
      const near = excerptNear(flat, f.find);
      if (near) console.warn(`[repair]   doc near miss: ${JSON.stringify(near)}`);
    }
  }
  for (const f of overlapped) {
    console.warn(`[repair] could not place (overlapped): find=${JSON.stringify(f.find)}`);
  }
}

export interface AiRepairResult {
  applied: number;
  skipped: number;
}

/** Entry point. Reads the current selection, asks the model for a list
 *  of fixes, locates each one, and on success applies all located fixes
 *  in a single transaction. Throws on an empty selection, a malformed
 *  reply, an output-token-capped reply (the fix list got cut off —
 *  retry on a smaller region), or if the document changed under the
 *  selection while the request was in flight. Returns the count applied
 *  and the count the model proposed but couldn't be located. */
export async function runAiRepairText(
  view: EditorView,
  promptTemplate?: string,
): Promise<AiRepairResult> {
  const { state } = view;
  const sel = state.selection;
  if (sel.empty) {
    throw new Error("Select the text to repair first.");
  }
  const from = sel.from;
  const to = sel.to;
  const flat = flattenSelection(state.doc, from, to);
  if (!flat.text.trim()) {
    throw new Error("Selection has no text to repair.");
  }

  const reply = await callAnthropic({
    system: promptTemplate?.trim() || DEFAULT_REPAIR_PROMPT,
    messages: [{ role: "user", content: flat.text }],
    maxTokens: 16000,
    temperature: 0,
  });
  if (reply.stopReason === "max_tokens") {
    throw new Error(
      "The fix list was too long for one pass — select a smaller region and repair it in parts.",
    );
  }
  const fixes = parseRepairResponse(reply.text);
  const { located, skipped, notFound, overlapped } = locateFixes(flat, fixes);
  logUnplaced(flat, notFound, overlapped);

  if (located.length === 0) {
    return { applied: 0, skipped };
  }

  const stillThere = flattenSelection(view.state.doc, from, to).text;
  if (stillThere !== flat.text) {
    throw new Error("The document changed while waiting on AI — try again.");
  }

  const tr = buildRepairTransaction(view.state, located);
  view.dispatch(tr);
  return { applied: located.length, skipped };
}
