/**
 * AI cite creator.
 *
 * User selects raw citation info (URL, byline, abstract, article
 * chunk — whatever they have). On invocation we send the selection
 * + today's date + the configurable system prompt to Anthropic.
 * The model replies in a delimited block format (NOT JSON — quotes in a
 * cite would otherwise need escaping):
 *
 *   [[CITE]]
 *   <formatted debate-style cite>
 *   [[TOKENS]]
 *   <one token per line, e.g. "Smith 24">
 *   [[END]]
 *
 * We replace the user's selection with the cite text and apply the
 * named-style `cite_mark` to every substring listed under TOKENS —
 * those are the "Lastname ShortDate" pieces that get F8 cite
 * highlighting in the editor.
 *
 * While the request is in flight, a floating tooltip pinned near
 * the selection cycles through Clod activity text (or "Thinking…"
 * when Clod mode is off).
 */

import type { EditorView } from 'prosemirror-view';
import { Selection, TextSelection } from 'prosemirror-state';
import type { EditorState, Transaction } from 'prosemirror-state';
import { schema } from '../../schema/index.js';
import { settings } from '../settings.js';
import { aiFailureNotice, aiGateToast, callLlm, LlmError, activeApiKey } from './llm.js';
import { AiActivity } from './ai-activity.js';
import { claimRegion } from './edit-coordinator.js';
import { showToast } from '../toast.js';
import { foldForTokenMatch, markCiteTokensInText } from '../cite-token-match.js';

export { foldForTokenMatch };

/** Today's-date placeholder substituted into the prompt at run
 *  time. Putting it in the prompt rather than the user message
 *  keeps the user message tightly scoped to the raw citation
 *  text. */
const DATE_PLACEHOLDER = '{DATE}';

// Default prompt — ported from the Card Formatting Tools utility's
// cite-formatter prompt (reference-docs/Card Formatting Tools.py),
// with the delimited-block output instructions appended at the
// bottom. The wrapper is what distinguishes this from the
// clipboard-only utility: the editor needs a machine-parsable shape
// to apply `cite_mark` to the right tokens.
export const DEFAULT_AI_CITE_PROMPT = `Today's date is ${DATE_PLACEHOLDER}.

You are an expert in formatting academic citations. Your task is to reformat the given citation to match the following style:

1. Author names should be in the format: FirstName LastName Date, where Date is:
   - The publication date in mm/dd format (or m/dd, or m/d, respectively, if the month or day require just one digit) for publications within the last month of the current year
   - The publication year in y format (for single-digit years) or yy format (for double-digit years) or yyyy (for years prior to 1950) for all other publications
2. For multiple authors, use '&' for two authors and 'et al.' for three or more.
3. After the author names, list their qualifications or affiliations.
4. Include the full title of the work in quotes.
5. Include publication details such as journal name, volume, issue, date (mm/dd/yyyy), and page numbers when available.
6. Include URLs or DOIs at the end of the citation when provided.
7. If the title or publication or names or qualifications are in all caps, change the capitalization so that it is appropriate for a cite.

Examples of the desired format:

(if today's date is less than a month after 9/23/24)
Adrien Rose & Christian Wilson 9/23, Rose is a research assistant in the Oxford Sustainable Finance Group, specializing in transition finance; Wilson is a DPhil student at the Smith School of Enterprise and the Environment (SSEE) and a Research Assistant in the Oxford Sustainable Finance Group, "Assessing the Credibility of Climate Transition Plans in the Oil and Gas Sector," Discussion Paper, Oxford Sustainable Finance Group, 09/23/2024, https://sustainablefinance.ox.ac.uk/wp-content/uploads/2024/09/SSEE-Discussion-Paper-Oil-Gas_final_AR.pdf

(if today's date is more than a month after 9/23/24)
Adrien Rose & Christian Wilson 24, Rose is a research assistant in the Oxford Sustainable Finance Group, specializing in transition finance; Wilson is a DPhil student at the Smith School of Enterprise and the Environment (SSEE) and a Research Assistant in the Oxford Sustainable Finance Group, "Assessing the Credibility of Climate Transition Plans in the Oil and Gas Sector," Discussion Paper, Oxford Sustainable Finance Group, 09/23/2024, https://sustainablefinance.ox.ac.uk/wp-content/uploads/2024/09/SSEE-Discussion-Paper-Oil-Gas_final_AR.pdf

(if today's date is less than a month after 9/9/24)
Keeff Felty & Grace Yarrow 9/9, Felty is President of the National Association of Wheat Growers; Yarrow is Food and Agriculture Policy Reporter at POLITICO, Author of POLITICO Pro's Morning Agriculture newsletter, University of Maryland graduate, "Ag groups hit the Hill," Politico, 9/9/24, https://www.politico.com/newsletters/weekly-agriculture/2024/09/09/ag-groups-hit-the-hill-00177896

(if today's date is more than a month after 9/9/24)
Keeff Felty & Grace Yarrow 24, Felty is President of the National Association of Wheat Growers; Yarrow is Food and Agriculture Policy Reporter at POLITICO, Author of POLITICO Pro's Morning Agriculture newsletter, University of Maryland graduate, "Ag groups hit the Hill," Politico, 9/9/24, https://www.politico.com/newsletters/weekly-agriculture/2024/09/09/ag-groups-hit-the-hill-00177896

J. D. Tuccille 23, Contributing Editor at Reason.com, former Managing Editor at Reason.com, columnist for Arizona Republic, Denver Post, and Washington Times, author of High Desert Barbecue, "It's Government Shutdown Theater, Again," Reason, 9/25/23, https://reason.com/2023/09/25/its-government-shutdown-theater-again/

Robert N. Stavins 18, A.J. Meyer Professor of Energy and Economic Development, John F. Kennedy School of Government, Harvard University; University Fellow, Resources for the Future; and Research Associate, National Bureau of Economic Research, "Environmental Economics," The New Palgrave Dictionary of Economics, edited by Garett Jones, Third edition, Palgrave Macmillan, 2018, pp. 3782–3795

Yael Parag & Sarah Darby 9, Parag is the Vice Dean of Reichman University's School of Sustainability at Reichman University (IDC); Derby is BSc DPhil, Associate Professor, Energy Programme, Environmental Change Institute, University of Oxford, "Consumer–Supplier–Government Triangular Relations: Rethinking the UK Policy Path for Carbon Emissions Reduction from the UK Residential Sector," Energy Policy, vol. 37, no. 10, 10/01/2009, pp. 3984–3992

Jie Jiang et al. 23, Jie Jiang, School of Intellectual Property at Nanjing University of Science and Technology; Qihang Zhang, School of Intellectual Property at Nanjing University of Science and Technology; Yifan Hui, School of Mathematics and Statistics at University of Glasgow, "The Impact of Market and Non-Market-Based Environmental Policy Instruments on Firms' Sustainable Technological Innovation: Evidence from Chinese Firms," Sustainability, vol. 15, no. 5, 5, Multidisciplinary Digital Publishing Institute, 01/15/2023, p. 4425

Important:
- Do not remove any information from the citation that was included in the submission.
- Do not add any information to the citation that was not included in the submission.
- If the title or publication or names or qualifications are in another language, translate them to English.

Respond using the delimited block format below — no JSON, no quoting, no escaping. Quotes inside the cite (around the title, for instance) just appear literally; the parser splits on the markers, not the punctuation.

[[CITE]]
<the full reformatted citation, exactly as you'd otherwise have returned it>
[[TOKENS]]
<one token per line>
[[END]]

The TOKENS section lists every substring that should be highlighted with the F8 cite mark. The highlighted portion is the LASTNAME(s) + SHORTDATE of the leading author block; firstnames stay unmarked.

  - One author ("Michael Townsend 25"): TOKENS = "Townsend 25"
  - Two authors ("Laura Weiss & John Bresnahan 3/26"): TOKENS = "Weiss & " then "Bresnahan 3/26" on the next line
  - Three+ authors ("Carla Norrlöf et al. 24"): TOKENS = "Norrlöf et al. 24"

For the two-author case, the first token ends with "& " (ampersand + trailing space) and the second token starts with the second lastname — the firstname between them stays unmarked. For "et al." cases the whole "Lastname et al. Date" is one contiguous token. Each token MUST be a verbatim substring of the cite so the editor can locate it.`;

export interface AiCiteResult {
  cite: string;
  tokens: string[];
}

/** Format today's date as M-D-YYYY, matching the cite convention. */
function formatToday(now: Date = new Date()): string {
  return `${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}`;
}

/** Replace the prompt's {DATE} placeholders. */
export function resolveCitePrompt(template: string, now: Date = new Date()): string {
  const today = formatToday(now);
  return template.split(DATE_PLACEHOLDER).join(today);
}

/** Parse the model's delimited-block reply. The format dodges all
 *  the JSON escape edge cases — cites with embedded quotes,
 *  curly punctuation, etc. just appear literally between the
 *  section markers. Throws on missing sections or empty cite. */
export function parseCiteResponse(text: string): AiCiteResult {
  // Tolerate stray prose / code fences around the block by
  // anchoring on the marker words. Markers are case-insensitive
  // and a leading hash / dash / etc. before the section header
  // is ignored, in case the model decorates them slightly.
  const citeIdx = findMarker(text, 'CITE');
  const tokensIdx = findMarker(text, 'TOKENS');
  const endIdx = findMarker(text, 'END');
  if (citeIdx === -1 || tokensIdx === -1 || tokensIdx < citeIdx) {
    throw new Error("Cite response missing the [[CITE]] / [[TOKENS]] markers.");
  }
  // Sanitize before anything positional touches the cite. Messy source
  // text (especially pasted out of PDFs) carries invisible junk — soft
  // hyphens, zero-width spaces, BOMs, control chars — and the model
  // echoes it into the cite. Those count toward `cite.length` (and the
  // per-token `indexOf` offsets), but the browser's contenteditable
  // silently drops several of them on render, so the DOM observer
  // reconciles the doc shorter than the string we measured — leaving
  // the trailing cite_mark short of its last char and shunting a stray
  // char past the own-paragraph split. `sanitizeCiteText` strips the
  // invisibles and collapses whitespace so `cite.length` matches what
  // actually renders. (The whitespace collapse also fixes wrapped /
  // multi-space cites, which `white-space: pre-wrap` would otherwise
  // show as broken lines.)
  const citeBody = sanitizeCiteText(
    text
      .slice(citeIdx, tokensIdx)
      .replace(/^[^\n]*\n/, ''), // drop the [[CITE]] header line itself
  ).trim();
  if (!citeBody) {
    throw new Error('Cite response had an empty cite section.');
  }
  const tokensSliceEnd = endIdx > tokensIdx ? endIdx : text.length;
  const tokensBody = text
    .slice(tokensIdx, tokensSliceEnd)
    .replace(/^[^\n]*\n/, '') // drop the [[TOKENS]] header line
    .trim();
  // One token per line. Skip blanks and any stray "[[END]]" line that
  // snuck into the tokens block. Tokens get the SAME sanitization as the
  // cite (so `indexOf` still matches) and are left-trimmed (model
  // indentation shouldn't break the match) but NOT right-trimmed — the
  // two-author convention has the first token end with "& " (trailing
  // space), and preserving it keeps the cite mark contiguous across the
  // firstname gap.
  const tokens = tokensBody
    .split(/\r?\n/)
    .filter((s) => s.trim().length > 0 && !/\[\[\s*END\s*\]\]/i.test(s))
    .map((s) => sanitizeCiteText(s).replace(/^ +/, ''));
  return { cite: citeBody, tokens };
}

/** Invisible / format / control characters that have no place in a cite
 *  and that browsers' contenteditable may silently drop on render —
 *  which would desync the rendered text length from the string we use
 *  for cite-mark and paragraph-split positions. Excludes tab / newline /
 *  CR (handled by the whitespace collapse). */
// eslint-disable-next-line no-control-regex
const INVISIBLE_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\uFFFC]/g;

/** Normalize cite / token text: strip invisible junk, then collapse every
 *  whitespace run (incl. newlines and NBSP variants — `\s` matches them)
 *  to a single space. Leaves a single leading/trailing space in place;
 *  the caller decides whether to trim, since the two-author token
 *  convention depends on a preserved trailing space. */
function sanitizeCiteText(s: string): string {
  return s.replace(INVISIBLE_CHARS, '').replace(/\s+/g, ' ');
}

/** Locate the FIRST occurrence of a section marker like `[[CITE]]`.
 *  Tolerates single brackets and surrounding whitespace just in
 *  case the model wobbles on the exact punctuation. Returns -1
 *  when not found. */
function findMarker(text: string, name: string): number {
  const re = new RegExp(`\\[\\[\\s*${name}\\s*\\]\\]`, 'i');
  const m = re.exec(text);
  return m ? m.index : -1;
}

/** Meta on the cite transaction: how many tokens found a home. The
 *  apply path toasts when it's zero so a cite whose author/date could
 *  not be styled (and which therefore stays an ordinary, shrinkable
 *  body paragraph) never happens silently. */
export const CITE_TOKENS_MARKED_META = 'aiCiteTokensMarked';

/** Build (but don't dispatch) the transaction that replaces
 *  [from, to] with the formatted cite and marks the tokens. Also
 *  ensures the cite is its own paragraph by splitting before /
 *  after the inserted span when the surrounding textblock has
 *  adjacent inline content. Exposed for unit testing; the
 *  dispatching path is `applyCiteToSelection` below. Returns
 *  null when the `cite_mark` type isn't in the schema (defensive
 *  — it always is). */
export function buildCiteTransaction(
  state: EditorState,
  from: number,
  to: number,
  result: AiCiteResult,
): Transaction | null {
  const citeType = schema.marks['cite_mark'];
  if (!citeType) return null;

  // Clamp the range to valid TEXT positions before inserting. The caller
  // passes the raw selection bounds, which can be block-boundary
  // positions that ProseMirror won't place inline text at — most commonly
  // `from === 0` from a whole-document selection (Ctrl+A), where the cite
  // actually lands at position 1, not 0. Trusting the raw `from` would
  // shift every position below one left: the trailing token loses its
  // last char and the own-paragraph split shunts that char onto its own
  // line. `TextSelection.between` resolves the bounds inward to the
  // nearest inline positions (e.g. 0 → 1), so the inserted run is exactly
  // `[from, from + cite.length]` with 1:1 character offsets (which the
  // token substring search relies on).
  const clamped = TextSelection.between(state.doc.resolve(from), state.doc.resolve(to));
  from = clamped.from;
  to = clamped.to;

  // If `to` merely grabs a trailing paragraph break — it sits at the start
  // of a later textblock with nothing of that block actually selected (the
  // Ctrl-Shift-Down shape) — pull it back to the end of the leading block.
  // Otherwise `insertText` reaches across the break: on an isolating tag/card
  // boundary the trailing block survives but the caret ends up parked there.
  // A selection reaching INTO the trailing block's text (parentOffset > 0) is
  // left alone — the own-paragraph split below handles that legitimate case.
  let trimmedBreak = false;
  const $to = state.doc.resolve(to);
  if ($to.parent.isTextblock && $to.parentOffset === 0) {
    const tailBlockStart = $to.before($to.depth);
    if (from < tailBlockStart) {
      try {
        const leadingEnd = Selection.near(state.doc.resolve(tailBlockStart), -1).to;
        if (leadingEnd > from && leadingEnd < to) {
          to = leadingEnd;
          trimmedBreak = true;
        }
      } catch {
        /* keep the clamped `to` */
      }
    }
  }

  const tr = state.tr;
  tr.insertText(result.cite, from, to);

  const start = from;
  const end = from + result.cite.length;
  // Strip every mark the inserted text picked up from the boundary
  // (PM `insertText` inherits the start position's marks). Without
  // this, a selection that started inside an existing cite_mark
  // span — or any other mark — leaves the whole replacement
  // wearing that mark, and the per-token application below ends up
  // redundant. The cite text should come out clean and only the
  // tokens should pick up cite_mark afterward.
  tr.removeMark(start, end);
  // FUZZY token location — shared with the external-insert bridge
  // (`../cite-token-match.ts`); see there for the folding/trim rules
  // and the beta.22 field report that motivated them.
  const markedTokens = markCiteTokensInText(tr, start, result.cite, result.tokens, citeType);
  tr.setMeta(CITE_TOKENS_MARKED_META, markedTokens);

  // When we trimmed a grabbed trailing break, the original selection still
  // reaches into the next block, so the default mapped caret would land
  // there. Pin the caret to the end of the inserted cite (in the leading
  // block) before the splits below — the transaction remaps this stored
  // selection through them.
  if (trimmedBreak) {
    try {
      tr.setSelection(TextSelection.create(tr.doc, end));
    } catch {
      /* leave the default mapped selection */
    }
  }

  // Cite-is-its-own-paragraph cleanup. After `insertText`, the
  // cite sits inline in whatever textblock the original selection
  // was anchored in. If that textblock has more inline content
  // adjacent to the cite — text after `end` (the common "selection
  // spanned past a paragraph break, so the trailing text from the
  // last selected paragraph is now glued onto the cite" case) or
  // text before `start` — split the textblock so the cite stands
  // alone in its own block.
  //
  // Split AFTER first: positions before `end` (including `start`)
  // are unchanged by `tr.split(end)`, so the second split is
  // computed against an up-to-date doc without remapping.
  // Wrapped in try/catch: a few textblock types (tag, analytic,
  // single-instance headings) can't legally have two siblings of
  // the same type, so PM rejects the split. Falling through to
  // the inline-cite shape is better than crashing.
  try {
    const $end = tr.doc.resolve(end);
    if (
      $end.parent.isTextblock &&
      $end.parentOffset < $end.parent.content.size
    ) {
      tr.split(end);
    }
  } catch {
    // Schema doesn't allow the after-split here; leave the cite
    // joined with whatever follows.
  }
  try {
    const $start = tr.doc.resolve(start);
    if ($start.parent.isTextblock && $start.parentOffset > 0) {
      tr.split(start);
    }
  } catch {
    // Schema doesn't allow the before-split; leave the cite at
    // the same offset within its textblock.
  }

  return tr;
}

/** Dispatch the cite transaction onto the live view. */
export function applyCiteToSelection(
  view: EditorView,
  from: number,
  to: number,
  result: AiCiteResult,
  dispatch: (tr: Transaction) => void = (tr) => view.dispatch(tr),
): boolean {
  const tr = buildCiteTransaction(view.state, from, to, result);
  if (!tr) return false;
  dispatch(tr);
  // A cite whose tokens all failed to locate carries no cite_mark, so
  // it stays an ordinary body paragraph (correctly — cite-ness IS the
  // mark) and shrink will treat it as body text. That must never be
  // silent: tell the user so they can F8 the author/date themselves.
  if (result.tokens.length > 0 && tr.getMeta(CITE_TOKENS_MARKED_META) === 0) {
    showToast(
      'Cite created, but the author/date couldn’t be located to style — select them and press F8.',
      { durationMs: 4000 },
    );
  }
  return true;
}

// --------------------------- command ----------------------------

/** Entry point — fires on `aiCreateCite` ribbon command. Reads
 *  the current selection, kicks off the API call, shows the
 *  in-flight tooltip, and on resolve replaces the selection
 *  with the formatted + marked cite. No-op when AI features are
 *  off, the key isn't set, or the selection is empty. */
export function runAiCreateCite(view: EditorView): void {
  if (!aiGateToast()) return;
  const apiKey = activeApiKey();
  const { state } = view;
  const sel = state.selection;
  if (sel.empty) {
    showToast('Select some citation info first.');
    return;
  }
  const raw = state.doc.textBetween(sel.from, sel.to, '\n', '\n').trim();
  if (!raw) {
    showToast('Selection has no text to format.');
    return;
  }

  const promptTemplate = settings.get('aiCitePrompt').trim() || DEFAULT_AI_CITE_PROMPT;
  const systemPrompt = resolveCitePrompt(promptTemplate);

  // Lease the selection so the cite lands where the user selected even if
  // the doc shifts during the request, and user edits inside it are held.
  const lease = claimRegion(view, { from: sel.from, to: sel.to }, { label: 'cite' });
  if (!lease) {
    showToast('Another AI edit is working on this selection — try again in a moment.');
    return;
  }

  // Pill + purple tint over the selection being formatted. One per call,
  // so concurrent cites each keep their own cue and clean up independently.
  const activity = new AiActivity(view, { from: sel.from, to: sel.to }, 'selection');
  activity.start();

  void (async () => {
    try {
      const reply = await callLlm({
        apiKey,
        system: systemPrompt,
        messages: [{ role: 'user', content: raw }],
      });
      const parsed = parseCiteResponse(reply.text);
      // Apply at the lease's CURRENT (remapped) bounds — edits elsewhere in
      // the doc during the request have shifted them. Null means the range
      // collapsed (its container was removed); surface that as a toast.
      const region = lease.region();
      if (!region) {
        showToast('Cite: the selected text is no longer in the document.');
        return;
      }
      applyCiteToSelection(view, region.from, region.to, parsed, (tr) => lease.apply(tr));
    } catch (e) {
      if (e instanceof LlmError) {
        aiFailureNotice('Create Cite', e);
      } else {
        aiFailureNotice('Create Cite', e);
      }
    } finally {
      lease.release();
      activity.stop();
    }
  })();
}
