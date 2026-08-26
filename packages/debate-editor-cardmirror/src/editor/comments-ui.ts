/**
 * Comments side-column UI.
 *
 * Owns the right-side panel that shows comment threads as cards.
 * Subscribes to the comments plugin state (and to the live PM doc
 * for thread→range lookups) and rebuilds the panel on change.
 *
 * Per-thread card shape:
 *   - Header: author + initials badge + date.
 *   - Body: comment text (rendered as plain `<p>` per newline).
 *   - Replies (rendered the same way, indented).
 *   - Reply textarea + submit button.
 *   - "Delete thread" button on the root comment's header.
 *
 * Clicking the card scrolls the editor to the marked range and
 * keeps the card visually highlighted.
 */

import type { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { schema } from '../schema/index.js';
import { settings } from './settings.js';
import { aiFailureNotice, callLlm, LlmError, type LlmMessage, activeApiKey, aiGateToast } from './ai/llm.js';
import {
  buildExplainContext,
  formatExplainFirstTurn,
  EXPLAIN_SYSTEM_PROMPT,
  hasAiMention,
} from './ai/explain-context.js';
import {
  inFlightLine,
  activitiesForNow,
  pickRandomActivity,
  personalizeActivity,
  PRONOUN_PRESETS,
  type AiPersona,
} from './ai/clod.js';
import { makeActivityStage, cycleActivityText } from './ai/activity-cycler.js';
import { showToast } from './toast.js';
import { scheduleIdle, cancelIdle, type IdleHandle } from './idle-scheduler.js';
import { setIcon } from './icons';
import { preciseScrollIntoView } from './precise-scroll.js';
import { learnStore, localToday } from './learn-store-host.js';
import {
  resolveDescriptor,
  resolveDescriptorIn,
  flattenDoc,
  buildDescriptor,
  type AnchorDescriptor,
} from './learn-anchor.js';
import { openCardEditor, type NewCardDef } from './learn-create-ui.js';
import { requestFlashcard } from './ai/flashcard-gen.js';
import { isDue } from './learn-scheduler.js';
import {
  setFlashcardRangesTr,
  setActiveAnnotationRangeTr,
  upsertFlashcardRangeTr,
  flashcardRanges,
  flashcardRangeMap,
  flashcardDropCount,
  learnHighlightKey,
  type FlashcardRange,
} from './learn-highlight-plugin.js';
import type { CardAnchor, AiThread, Note, LocalComment } from './learn-store.js';

/** Synthetic column-card id prefix for a flashcard, distinguishing it
 *  from a (numeric) comment thread id in the shared cardEls map / the
 *  `lastRanges` positioning map. */
export const FC_PREFIX = 'fc:';
/** Synthetic column-card id prefix for an AI thread (local annotation
 *  layer), distinct from comment-thread and flashcard ids. */
export const AI_PREFIX = 'ai:';
/** Synthetic column-card id prefix for a private note (local annotation
 *  layer), distinct from comment-thread, flashcard, and AI ids. */
export const NOTE_PREFIX = 'note:';

/** Resolve the configured AI persona (name + pronouns) from
 *  settings. Centralized here so every consumer (invokeAi,
 *  in-flight placeholder, button tooltip) reads the same thing. */
export function getAiPersona(): AiPersona {
  const name = settings.get('aiPersonaName') || 'Clod';
  const choice = settings.get('aiPersonaPronouns');
  if (choice === 'custom') {
    return { name, pronouns: settings.get('aiPersonaCustomPronouns') };
  }
  return { name, pronouns: PRONOUN_PRESETS[choice] ?? PRONOUN_PRESETS.he };
}

/** Persona-aware in-flight narration ("Clod is finding optional
 *  sections…" under clod mode, "Finding optional sections…" without) —
 *  the settings-reading wrapper every UI call site goes through. */
export function aiInFlightText(gerund: string): string {
  return inFlightLine(gerund, settings.get('clodEnabled'), getAiPersona().name);
}

/** Cycle the Clod-activity placeholder text every this many
 *  milliseconds while an AI request is in flight. ~4 seconds reads
 *  naturally — long enough to actually read a line, short enough to
 *  make progress feel alive. */
const ACTIVITY_TICK_MS = 4000;

/** Min/max width (CSS px) the comments column can be resized to.
 *  Below 240 threads get cramped; above 560 the column eats too
 *  much editor space. Matches the clamp in `settings.ts`'s
 *  sanitizer so persisted values from outside the range get pulled
 *  back in. */
const COMMENTS_WIDTH_MIN = 240;
const COMMENTS_WIDTH_MAX = 560;

/** Apply a (clamped) comments column width by setting the
 *  `--pmd-comments-width` custom property on the document element.
 *  CSS picks it up via `width: var(--pmd-comments-width, 320px)` on
 *  `.pmd-comments-column`. Mirror of `applyNavWidthCss` in
 *  `nav-panel.ts`. Applied on construction (persisted setting), on
 *  settings changes, and during the resize drag. */
export function applyCommentsWidthCss(px: number): void {
  const clamped = Math.max(COMMENTS_WIDTH_MIN, Math.min(COMMENTS_WIDTH_MAX, px));
  document.documentElement.style.setProperty('--pmd-comments-width', `${clamped}px`);
}
import {
  commentsKey,
  getCommentsState,
  newCommentId,
  addThreadMeta,
  addReplyMeta,
  setResolvedMeta,
  editCommentTextMeta,
  deleteThreadMeta,
  deleteCommentMeta,
  setCommentsVisibleMeta,
  type Comment,
  type Thread,
} from './comments-plugin.js';

/** Recognize an AI comment from fields that survive docx round-trip
 *  (Word has no concept of AI vs human, so the schema's `kind` field is
 *  dropped on docx export and restored as `'human'` on re-import). AI
 *  comments carry `initials: 'AI'`, which round-trips (comments.xml
 *  `w:initials`). The trailing-`(AI)` author check is a back-compat
 *  fallback for comments written before we stopped suffixing the name;
 *  `kind === 'ai'` likewise covers older `.cmir`-only saves. */
function isAiComment(comment: { author: string; initials: string; kind?: Comment['kind'] }): boolean {
  if (comment.initials.trim().toUpperCase() === 'AI') return true;
  if (comment.author.trim().endsWith('(AI)')) return true;
  return comment.kind === 'ai';
}

/** Strip a legacy trailing ` (AI)` from an AI comment's author for
 *  display, so older comments read as just the persona name like the
 *  rest of the interface. New AI comments no longer carry the suffix. */
function displayAuthor(comment: { author: string }): string {
  return (comment.author || 'Unknown').replace(/\s*\(AI\)$/i, '') || 'Unknown';
}

/** Author name for a LOCAL AI thread turn: the persona name, with no
 *  round-trip "(AI)" suffix. Local AI threads never serialize, so the
 *  docx-survival heuristic isn't needed — the "AI" chip carries the
 *  signal instead. Falls back to plain "AI" when Clod mode is off. */
function aiPersonaName(): string {
  return settings.get('clodEnabled') ? getAiPersona().name.trim() || 'AI' : 'AI';
}

/** Derive a 1–2 letter badge from a persona name (unlike `badgeText`,
 *  which gives up on single-word names and shows a silhouette). */
function aiPersonaInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? 'AI').toUpperCase();
}

/** The card-type chip shown in every card's header — the unified type
 *  indicator. Color mirrors the in-text highlight: comment = gold,
 *  flashcard (Q&A / cloze) = accent, AI = purple. */
type CardTypeChipKind =
  | 'comment'
  | 'qa'
  | 'cloze'
  | 'ai'
  | 'note'
  | 'cutter-section'
  | 'cutter-guidance';
function makeCardTypeChip(kind: CardTypeChipKind): HTMLElement {
  const chip = document.createElement('span');
  // Cutter-context notes reuse the note tone (green) — they ARE notes,
  // just ones the cutter reads; the label carries the distinction.
  const tone =
    kind === 'qa' || kind === 'cloze'
      ? 'flashcard'
      : kind === 'cutter-section' || kind === 'cutter-guidance'
      ? 'note'
      : kind;
  chip.className = `pmd-card-type-chip is-${tone}`;
  chip.textContent =
    kind === 'qa'
      ? 'Q&A'
      : kind === 'cloze'
      ? 'Cloze'
      : kind === 'ai'
      ? 'AI'
      : kind === 'cutter-section'
      ? 'Context'
      : kind === 'cutter-guidance'
      ? 'Guidance'
      : kind === 'note'
      ? 'Note'
      : 'Comment';
  return chip;
}

export class CommentsColumn {
  private readonly root: HTMLElement;
  /** Inner container that holds the threads + empty-state + toggle.
   *  Lives inside `root` so the resize handle (also a child of
   *  `root`, but a sibling of this) survives the `innerHTML = ''`
   *  wipes `render()` does in its no-view / empty paths. */
  private readonly content: HTMLElement;
  private getView: () => EditorView | null;
  /** Re-renders would otherwise blow away a focused reply textarea.
   *  Tracks which thread is being typed in so rebuilds re-focus and
   *  restore the text. */
  private activeReplyThreadId: string | null = null;
  private activeReplyText = '';
  private suppressBlurReset = false;
  /** Threads with an in-flight AI request. UI renders a transient
   *  "thinking…" placeholder while present. */
  private aiInFlight: Set<string> = new Set();
  /** Per-thread cached context built at the moment the AI thread
   *  was created. The doc may shift before the AI request fires
   *  (user types elsewhere); the cached context preserves what the
   *  selection meant when the thread was opened. */
  private aiContextByThread: Map<string, ReturnType<typeof buildExplainContext>> = new Map();
  /** Interval handle for the Clod-activity text-cycling tick.
   *  Null when no AI request is pending or Clod mode is off. */
  private activityTimer: number | null = null;
  /** Thread the user is currently focused on — clicked on the card
   *  or has the editor cursor inside its commented range. The
   *  active card is the only one rendered in expanded form, and the
   *  layout anchors it at its preferred Y, displacing neighbors
   *  outward to make room. Null means no card is currently active. */
  private activeThreadId: string | null = null;
  /** Records HOW the active thread got there:
   *   - `'click'`: user clicked the card. Sticky — only dismissed
   *     by clicking elsewhere, opening a different card, or hitting
   *     the toggle button. Cursor moves don't change it.
   *   - `'cursor'`: cursor is inside the comment_range. Follows
   *     cursor — when the cursor leaves the range the thread
   *     collapses.
   *   - `null`: nothing active. */
  private activeBy: 'click' | 'cursor' | null = null;
  /** Global mousedown listener installed while a thread is
   *  sticky-active. Dismisses sticky when the user clicks somewhere
   *  not inside the active card. */
  private stickyDismissHandler: ((e: MouseEvent) => void) | null = null;
  /** Persistent card elements keyed by thread id (or `fc:<cardId>` for
   *  flashcards). Reused across renders so reconcile only re-populates a
   *  card whose content changed — keeping the active reply textarea's
   *  focus/value intact. The column is a plain flow list (Model 1), so
   *  there's no absolute positioning to maintain. */
  private cardEls = new Map<string, HTMLElement>();
  /** Last-rendered content signature per card, so render() skips
   *  re-populating a card whose content + active state are unchanged. */
  private cardSigs = new Map<string, string>();
  /** Latest thread→range map, kept so a card's once-bound click handler
   *  can look up its current range (for scroll-to-text), and so cards
   *  order top-to-bottom by document position. Keyed by comment threadId
   *  and by `fc:<cardId>` for flashcards. */
  private lastRanges: Map<string, { from: number; to: number }> = new Map();
  /** The "Unanchored (n)" footer element (flashcards whose anchor didn't
   *  resolve), appended at the end of the list. Null when none. */
  private unanchoredEl: HTMLElement | null = null;
  /** `${from}:${to}` of the last active-annotation range dispatched to
   *  the highlight plugin (or '' for none), so render only re-dispatches
   *  the doc emphasis when the active selection actually changes. */
  private lastActiveRangeKey = '';
  /** Last-seen flashcard `dropCount` from the highlight plugin. When it
   *  advances (a card was moved/deleted, collapsing its range), render
   *  re-resolves from the stored descriptors to re-ground it. */
  private lastDropCount = 0;
  /** Whether the Unanchored section is collapsed (persists across
   *  renders within a session). */
  private unanchoredCollapsed = false;

  /** Resolve the focused doc's annotation id (single-doc global or the
   *  focused multi-pane record). Flashcards for this id are resolved +
   *  rendered when the column is open. */
  private getDocId: () => string;
  /** Permanent subscription to the learn store (set in the constructor)
   *  so a card created / edited / deleted / re-grounded anywhere
   *  re-resolves + re-renders. `refreshFlashcardAnchors` no-ops while
   *  the column is hidden, so the subscription is cheap when closed. */
  private learnUnsub: (() => void) | null = null;

  constructor(root: HTMLElement, getView: () => EditorView | null, getDocId: () => string = () => '') {
    this.root = root;
    this.getView = getView;
    this.getDocId = getDocId;
    // Inner content container — render() only ever rebuilds children
    // INSIDE this. Install the resize handle first so it stays a
    // sibling that render()'s wipes never touch.
    applyCommentsWidthCss(settings.get('commentsColumnWidth'));
    settings.subscribe((s) => {
      applyCommentsWidthCss(s.commentsColumnWidth);
    });
    this.installResizeHandle();
    this.content = document.createElement('div');
    this.content.className = 'pmd-comments-content';
    this.root.appendChild(this.content);
    // Permanent subscription: re-resolve + re-render whenever a card is
    // created / edited / deleted / re-grounded anywhere. Must NOT be
    // gated on `setVisible` — on boot the column is shown by setting
    // `hidden` directly (in mountView), so setVisible may never run.
    // `reconcileAnchors` no-ops while the column is hidden. It is the
    // CHEAP path: it only re-resolves descriptors for annotations that
    // are genuinely new (and prunes removed ones), so a store change that
    // doesn't touch anchors — adding a reply, editing text — does no
    // doc-walk at all. Full re-resolution (`refreshFlashcardAnchors`) is
    // reserved for doc load, pane switches, and edit-driven drops.
    this.learnUnsub = learnStore.subscribe(() => this.reconcileAnchors());
  }

  /** Add a drag handle on the column's LEFT edge so users can
   *  resize it. Mirrors the nav-pane's right-edge handle. Width
   *  is driven by the `--pmd-comments-width` custom property
   *  (set on `:root` so any future selector that references it
   *  resolves consistently), and persisted via the
   *  `commentsColumnWidth` setting. Drag clamps to
   *  COMMENTS_WIDTH_MIN…COMMENTS_WIDTH_MAX; the settings sanitizer
   *  clamps out-of-range persisted values too. */
  private installResizeHandle(): void {
    const handle = document.createElement('div');
    handle.className = 'pmd-comments-resize-handle';
    handle.setAttribute('aria-label', 'Resize comments column');
    handle.setAttribute('role', 'separator');
    this.root.appendChild(handle);

    let dragging = false;
    let startX = 0;
    let startWidth = 0;

    const onMove = (e: MouseEvent): void => {
      if (!dragging) return;
      // Dragging LEFT (decreasing clientX) GROWS the column,
      // because the handle sits on the column's left edge and
      // moving it left makes the column wider. Inverse of the
      // nav-pane handle on the right.
      const delta = startX - e.clientX;
      applyCommentsWidthCss(startWidth + delta);
    };

    const onUp = (): void => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove('pmd-comments-resize-active');
      this.root.classList.remove('pmd-comments-resizing');
      const w = getComputedStyle(this.root).width;
      const pixels = parseInt(w, 10);
      if (Number.isFinite(pixels)) {
        settings.set('commentsColumnWidth', pixels);
      }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    handle.addEventListener('mousedown', (e) => {
      dragging = true;
      startX = e.clientX;
      startWidth = this.root.getBoundingClientRect().width;
      document.body.classList.add('pmd-comments-resize-active');
      this.root.classList.add('pmd-comments-resizing');
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      e.preventDefault();
    });
  }

  /** Switch which thread is "active" — the expanded one whose card
   *  anchors at its preferred Y position. The `by` flavor matters:
   *   - `'cursor'` calls (from the editor's cursor-tracking) leave
   *     a click-sticky active alone. A cursor-set active deactivates
   *     when the cursor leaves the range.
   *   - `'click'` calls (from clicking a card) take over and install
   *     a global mousedown dismiss listener.
   *  Idempotent for same id + same flavor so callers can fire freely. */
  setActiveThread(id: string | null, by: 'click' | 'cursor' = 'cursor'): void {
    if (this.activeBy === 'click' && by === 'cursor') {
      // Sticky owns the active state — cursor changes don't touch
      // it. (Cursor moving back INTO the sticky thread's range is
      // already a no-op; cursor moving away is suppressed here so
      // the click stays expanded until something else dismisses.)
      return;
    }
    if (this.activeThreadId === id && this.activeBy === (id ? by : null)) return;
    this.activeThreadId = id;
    this.activeBy = id ? by : null;
    this.refreshStickyDismissListener();
    // Cursor-driven calls come from the editor's `dispatchTransaction`
    // (every keystroke, every cursor move). Debounce the render so
    // typing in a long doc isn't paying an O(doc) `collectRanges`
    // walk per keystroke. Click-driven calls come from a user
    // clicking a thread card; render immediately for snappy feedback.
    if (by === 'cursor') this.scheduleRender();
    else this.render();
  }

  /** Manual dismiss path — used by the global mousedown listener
   *  when the user clicks somewhere outside a sticky-active card,
   *  and by the toggle button. Clears the active state and then
   *  re-evaluates cursor position so a cursor-in-range still wins. */
  private dismissActive(): void {
    this.activeThreadId = null;
    this.activeBy = null;
    this.refreshStickyDismissListener();
    this.render();
  }

  /** Install / remove the document-level mousedown listener that
   *  dismisses a sticky-active card when the user clicks outside
   *  it. Only attached while the active flavor is `'click'`. */
  private refreshStickyDismissListener(): void {
    const needed = this.activeBy === 'click' && this.activeThreadId !== null;
    if (needed && !this.stickyDismissHandler) {
      const handler = (e: MouseEvent): void => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        // Click inside the active card — keep sticky.
        if (target.closest(`[data-thread-id="${cssEscape(this.activeThreadId!)}"]`)) return;
        // Click inside the column on a DIFFERENT card — the card's
        // own handler will call setActiveThread('click') and we'll
        // refresh the listener for the new active card.
        if (target.closest('.pmd-comment-thread')) return;
        this.dismissActive();
      };
      // Defer one frame so the activating click itself doesn't fire
      // this handler synchronously and immediately cancel sticky.
      requestAnimationFrame(() => {
        if (this.activeBy !== 'click') return;
        document.addEventListener('mousedown', handler, true);
        this.stickyDismissHandler = handler;
      });
    } else if (!needed && this.stickyDismissHandler) {
      document.removeEventListener('mousedown', this.stickyDismissHandler, true);
      this.stickyDismissHandler = null;
    }
  }

  /** Show/hide the entire column. The toggle button in the ribbon
   *  calls this; we also dispatch a `setCommentsVisibleMeta` so
   *  the plugin state reflects the same value (useful for any
   *  consumer that wants to render based on it). */
  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
    const view = this.getView();
    if (view) {
      view.dispatch(view.state.tr.setMeta(commentsKey, setCommentsVisibleMeta(visible)));
    }
    settings.set('commentsVisible', visible);
    if (visible) {
      // Resolve this doc's flashcards on show. (The constructor's
      // permanent store subscription keeps them current thereafter.)
      this.refreshFlashcardAnchors();
    } else {
      // Drop the highlights + active emphasis when the column closes
      // (resolved fresh on the next open).
      const v = this.getView();
      if (v) {
        v.dispatch(setFlashcardRangesTr(v.state, []));
        v.dispatch(setActiveAnnotationRangeTr(v.state, null));
      }
      this.lastActiveRangeKey = '';
    }
  }

  /** Resolve every flashcard anchored to the focused doc against the
   *  live document and hand the resolved ranges to the highlight
   *  plugin. Cards whose descriptor doesn't resolve (a foreign edit
   *  broke them, or they were explicitly unanchored) simply aren't in
   *  the resolved set — the column surfaces them in its Unanchored
   *  list. Idempotent; safe to call on open, doc load, and store change. */
  refreshFlashcardAnchors(): void {
    const view = this.getView();
    if (!view) return;
    if (this.root.hidden) return;
    const docId = this.getDocId();
    const resolved: FlashcardRange[] = [];
    if (docId) {
      // Flatten the doc ONCE and resolve every descriptor against it —
      // not once per descriptor (which used to walk the whole doc N
      // times). Flashcards, AI threads, and notes share the one flatten.
      const flat = flattenDoc(view.state.doc);
      for (const a of learnStore.anchorsForDoc(docId)) {
        if (!a.anchor) continue; // explicitly unanchored
        const r = resolveDescriptorIn(flat, a.anchor);
        if (r) resolved.push({ cardId: a.cardId, from: r.from, to: r.to, kind: 'flashcard' });
      }
      for (const t of learnStore.aiThreadsForDoc(docId)) {
        if (!t.anchor) continue;
        const r = resolveDescriptorIn(flat, t.anchor);
        if (r) resolved.push({ cardId: t.threadId, from: r.from, to: r.to, kind: 'ai' });
      }
      for (const n of learnStore.notesForDoc(docId)) {
        if (!n.anchor) continue;
        const r = resolveDescriptorIn(flat, n.anchor);
        if (r) resolved.push({ cardId: n.noteId, from: r.from, to: r.to, kind: 'note' });
      }
    }
    view.dispatch(setFlashcardRangesTr(view.state, resolved));
    // Baseline the drop counter to the just-resolved state so render's
    // re-resolve trigger only fires on drops that happen AFTER this.
    this.lastDropCount = flashcardDropCount(view.state);
    // The range-set transaction is doc-neutral, so it doesn't trip the
    // editor's render trigger — render explicitly so the flashcard
    // cards (which read the new resolved ranges) appear/update.
    this.render();
  }

  /** Incremental anchor sync — the store-subscription path. Resolves a
   *  descriptor ONLY for an annotation that's newly anchored but not yet
   *  in the highlight plugin (e.g. a flashcard created from the manage
   *  GUI), and prunes ranges whose annotation was deleted. Annotations
   *  created/re-grounded in-app set their range directly from the known
   *  selection (`placeLocalAnnotation`), so they're already present and
   *  cost no doc-walk here. Everything else (replies, edits, grades)
   *  short-circuits to a plain re-render. */
  reconcileAnchors(): void {
    const view = this.getView();
    if (!view) return;
    if (this.root.hidden) return;
    const docId = this.getDocId();
    // Desired anchored set: id → its descriptor + kind.
    const wanted = new Map<string, { anchor: AnchorDescriptor; kind: FlashcardRange['kind'] }>();
    if (docId) {
      for (const a of learnStore.anchorsForDoc(docId)) {
        if (a.anchor) wanted.set(a.cardId, { anchor: a.anchor, kind: 'flashcard' });
      }
      for (const t of learnStore.aiThreadsForDoc(docId)) {
        if (t.anchor) wanted.set(t.threadId, { anchor: t.anchor, kind: 'ai' });
      }
      for (const n of learnStore.notesForDoc(docId)) {
        if (n.anchor) wanted.set(n.noteId, { anchor: n.anchor, kind: 'note' });
      }
    }
    const current = flashcardRanges(view.state);
    const currentIds = new Set(current.map((r) => r.cardId));
    const newIds = [...wanted.keys()].filter((id) => !currentIds.has(id));
    const hasRemoved = current.some((r) => !wanted.has(r.cardId));
    if (newIds.length === 0 && !hasRemoved) {
      // No anchor set changed — nothing to resolve or prune.
      this.render();
      return;
    }
    const kept = current.filter((r) => wanted.has(r.cardId));
    if (newIds.length > 0) {
      // Resolve only the new ones, flattening the doc once.
      const flat = flattenDoc(view.state.doc);
      for (const id of newIds) {
        const w = wanted.get(id)!;
        const r = resolveDescriptorIn(flat, w.anchor);
        if (r) kept.push({ cardId: id, from: r.from, to: r.to, kind: w.kind });
      }
    }
    view.dispatch(setFlashcardRangesTr(view.state, kept));
    this.lastDropCount = flashcardDropCount(view.state);
    this.render();
  }

  /** Set an annotation's highlight range directly from a KNOWN position
   *  (no descriptor resolution / doc-walk) — used when a note / AI thread
   *  is created or re-grounded against the live selection. Call this
   *  BEFORE the store mutation so the following reconcile sees the range
   *  already present and skips resolving it. */
  placeLocalAnnotation(
    cardId: string,
    from: number,
    to: number,
    kind: FlashcardRange['kind'],
  ): void {
    const view = this.getView();
    if (!view) return;
    view.dispatch(upsertFlashcardRangeTr(view.state, { cardId, from, to, kind }));
  }

  /** Idle-callback handle for `scheduleRender`. */
  private renderTimer: IdleHandle | null = null;

  /** Debounced variant of `render()` — used by callers driven by
   *  `dispatchTransaction` (cursor moves, doc edits) so the O(doc)
   *  `collectRanges` walk inside render doesn't fire on every
   *  keystroke. Dispatched via `requestIdleCallback` (with a 200ms
   *  timeout cap and a `setTimeout` fallback) so it only runs when
   *  the browser has frame budget to spare — no mid-pause spike
   *  when the user briefly stops typing. Direct user actions
   *  (toggle, add comment, click a card) call `render` immediately
   *  for snappy feedback. */
  scheduleRender(): void {
    if (this.renderTimer !== null) cancelIdle(this.renderTimer);
    this.renderTimer = scheduleIdle(() => {
      this.renderTimer = null;
      this.render();
    }, 200);
  }

  render(): void {
    // Cancel any pending scheduled render — a direct render() call
    // supersedes it and we don't want a stale follow-up.
    if (this.renderTimer !== null) {
      cancelIdle(this.renderTimer);
      this.renderTimer = null;
    }
    const view = this.getView();
    if (!view) {
      this.clearAllCards();
      this.content.innerHTML = '';
      this.root.classList.remove('pmd-comments-empty-state');
      this.root.style.minHeight = '';
      return;
    }
    // Bail when the column is hidden. render() fires from
    // `dispatchTransaction` on every doc-changing keystroke; if the
    // user has the comments toggle off, there's nothing visible to
    // paint and the O(doc) `collectRanges` walk below (plus all the
    // DOM construction) is wasted work. The toggle handler in
    // `editor/index.ts` calls `render()` explicitly when the column
    // is shown, so the column repopulates from the current state at
    // that moment with no lost data.
    if (this.root.hidden) return;
    const state = getCommentsState(view.state);

    // Flashcards anchored to the focused doc. Cheap store/plugin reads
    // (resolved ranges are already edit-tracked by the highlight
    // plugin), done before the empty-bail so a doc with only flashcards
    // still renders.
    const docId = this.getDocId();
    const fcAnchors = docId ? learnStore.anchorsForDoc(docId) : [];
    const fcRangeMap = flashcardRangeMap(view.state);
    const anchoredFc = fcAnchors.filter((a) => fcRangeMap.has(a.cardId));
    const unanchoredFc = fcAnchors.filter((a) => !fcRangeMap.has(a.cardId));

    // AI threads (local annotation layer) — resolved ranges share the
    // flashcard plugin's map (keyed by threadId, a distinct id space).
    const aiThreads = docId ? learnStore.aiThreadsForDoc(docId) : [];
    const anchoredAi = aiThreads.filter((t) => fcRangeMap.has(t.threadId));
    const unanchoredAi = aiThreads.filter((t) => !fcRangeMap.has(t.threadId));

    // Private notes (local annotation layer) — same resolution + range
    // sharing as AI threads, keyed by noteId. The cutter's file-guidance
    // note is anchorless BY DESIGN (it's about the whole file), so it
    // renders pinned at the top of the flow, never in the Unanchored
    // broken-anchor footer.
    const notes = docId ? learnStore.notesForDoc(docId) : [];
    const guidanceNotes = notes.filter((n) => n.kind === 'cutter-guidance');
    const anchoredNotes = notes.filter(
      (n) => fcRangeMap.has(n.noteId) && n.kind !== 'cutter-guidance',
    );
    const unanchoredNotes = notes.filter(
      (n) => !fcRangeMap.has(n.noteId) && n.kind !== 'cutter-guidance',
    );

    if (
      state.threads.size === 0 &&
      fcAnchors.length === 0 &&
      aiThreads.length === 0 &&
      notes.length === 0
    ) {
      // Empty early-bail BEFORE the O(doc) `collectRanges` walk: this
      // render fires from `dispatchTransaction` on every doc-changing
      // keystroke, so docs with no comments AND no flashcards would
      // otherwise pay a full-doc walk per keystroke.
      this.clearAllCards();
      this.content.innerHTML = '';
      this.unanchoredEl = null;
      this.root.classList.add('pmd-comments-empty-state');
      const empty = document.createElement('div');
      empty.className = 'pmd-comments-empty';
      empty.textContent = 'No comments yet.';
      this.content.appendChild(empty);
      this.root.style.minHeight = '';
      // The active-emphasis sync at the end of render() is skipped by this
      // early bail, so clear any lingering active highlight here too —
      // otherwise deleting the LAST decoration-anchored annotation (note /
      // flashcard / AI thread) leaves its blue emphasis painted until the
      // column is toggled off. (Comments instead clear via the highlight
      // plugin's position-mapping when their mark is edited away.) Guard
      // on the PLUGIN's own active range, not
      // `lastActiveRangeKey`: the range-clear dispatch above triggers a
      // re-entrant render whose `setActiveAnnotationRangeTr(null)` is dropped
      // (re-entrant dispatches are ignored) yet still resets the key to '',
      // so keying off the bookkeeping value would miss the still-live deco.
      if (learnHighlightKey.getState(view.state)?.active) {
        this.lastActiveRangeKey = '';
        view.dispatch(setActiveAnnotationRangeTr(view.state, null));
      }
      return;
    }
    this.root.classList.remove('pmd-comments-empty-state');

    // If a flashcard range collapsed under an edit (a card *move* —
    // which position-mapping can't follow — or a delete), re-resolve
    // from the stored descriptors: the text usually still exists
    // (relocated), so the card re-grounds rather than going unanchored.
    // refreshFlashcardAnchors re-renders, so bail out of this pass.
    if (flashcardDropCount(view.state) !== this.lastDropCount) {
      this.refreshFlashcardAnchors();
      return;
    }

    // Drop any leftover empty-state placeholder before reconciling.
    const placeholder = this.content.querySelector('.pmd-comments-empty');
    if (placeholder) placeholder.remove();
    const ranges = collectRanges(view.state.doc);
    // Merge resolved flashcard ranges (synthetic `fc:` ids) so the list
    // orders flashcards by their text position and click-to-scroll works.
    for (const a of anchoredFc) {
      const r = fcRangeMap.get(a.cardId);
      if (r) ranges.set(FC_PREFIX + a.cardId, r);
    }
    for (const t of anchoredAi) {
      const r = fcRangeMap.get(t.threadId);
      if (r) ranges.set(AI_PREFIX + t.threadId, r);
    }
    for (const n of anchoredNotes) {
      const r = fcRangeMap.get(n.noteId);
      if (r) ranges.set(NOTE_PREFIX + n.noteId, r);
    }
    this.lastRanges = ranges;

    // Build the ordered list of cards (comments + anchored flashcards),
    // top-to-bottom by document position; cards with no position (orphan
    // comments) sink to the end.
    interface Item {
      id: string;
      kind: 'comment' | 'flashcard' | 'ai' | 'note';
      cardId: string;
      sortKey: number;
    }
    const items: Item[] = [];
    for (const id of state.threads.keys()) {
      const r = ranges.get(id);
      items.push({ id, kind: 'comment', cardId: '', sortKey: r ? r.from : Number.MAX_SAFE_INTEGER });
    }
    for (const a of anchoredFc) {
      const r = fcRangeMap.get(a.cardId);
      items.push({
        id: FC_PREFIX + a.cardId,
        kind: 'flashcard',
        cardId: a.cardId,
        sortKey: r ? r.from : Number.MAX_SAFE_INTEGER,
      });
    }
    for (const t of anchoredAi) {
      const r = fcRangeMap.get(t.threadId);
      items.push({
        id: AI_PREFIX + t.threadId,
        kind: 'ai',
        cardId: t.threadId,
        sortKey: r ? r.from : Number.MAX_SAFE_INTEGER,
      });
    }
    for (const n of anchoredNotes) {
      const r = fcRangeMap.get(n.noteId);
      items.push({
        id: NOTE_PREFIX + n.noteId,
        kind: 'note',
        cardId: n.noteId,
        sortKey: r ? r.from : Number.MAX_SAFE_INTEGER,
      });
    }
    // File-guidance note(s) pin above everything document-anchored.
    for (const n of guidanceNotes) {
      items.push({ id: NOTE_PREFIX + n.noteId, kind: 'note', cardId: n.noteId, sortKey: -1 });
    }
    items.sort((x, y) => x.sortKey - y.sortKey);

    // Reconcile persistent card elements (preserves the active reply
    // textarea's focus/value; only re-populates when content changed),
    // then append in document order — a plain flow list (Model 1). The
    // column scrolls internally, so a card expanding never moves the doc.
    const wantedIds = new Set(items.map((it) => it.id));
    for (const [id, el] of this.cardEls) {
      if (!wantedIds.has(id)) {
        el.remove();
        this.cardEls.delete(id);
        this.cardSigs.delete(id);
      }
    }
    // Minimal-move ordering cursor: walk the wanted order against the
    // column's current children and only touch a card whose position
    // actually differs. The old unconditional appendChild MOVED every
    // already-attached card each render — detaching the focused reply
    // textarea's ancestor, which blurred it and wiped the draft state
    // on every remote collab edit (field report 2026-08-05: comment
    // typing lost focus whenever a partner's edits landed).
    let orderCursor = this.content.firstElementChild;
    for (const it of items) {
      const isActive = this.activeThreadId === it.id;
      const el = this.ensureCardEl(it.id);
      // Defensive: the flow list never sets an inline `top`, but a card
      // element that survived a hot-reload from the old positioned layout
      // could carry a stale one (which `position: relative` would honor,
      // shifting the card out of order). Clear it.
      if (el.style.top) el.style.top = '';
      if (it.kind === 'comment') {
        const thread = state.threads.get(it.id)!;
        const sig = 'c' + this.threadSignature(thread, isActive);
        if (this.cardSigs.get(it.id) !== sig) {
          this.populateThread(el, thread, isActive);
          this.cardSigs.set(it.id, sig);
        }
      } else if (it.kind === 'ai') {
        const sig = 'a' + this.aiThreadSignature(it.cardId, isActive);
        if (this.cardSigs.get(it.id) !== sig) {
          this.populateAiThread(el, it.cardId, isActive);
          this.cardSigs.set(it.id, sig);
        }
      } else if (it.kind === 'note') {
        const sig = 'n' + this.noteSignature(it.cardId, isActive);
        if (this.cardSigs.get(it.id) !== sig) {
          this.populateNote(el, it.cardId, isActive);
          this.cardSigs.set(it.id, sig);
        }
      } else {
        const sig = 'f' + this.flashcardSignature(it.cardId, isActive);
        if (this.cardSigs.get(it.id) !== sig) {
          this.populateFlashcard(el, it.cardId, isActive);
          this.cardSigs.set(it.id, sig);
        }
      }
      // Flow order, minimal-move (see orderCursor above).
      if (el === orderCursor) {
        orderCursor = orderCursor.nextElementSibling;
      } else {
        this.content.insertBefore(el, orderCursor);
      }
    }
    // Unanchored flashcards + AI threads + notes → collapsible footer.
    this.renderUnanchoredSection(unanchoredFc, unanchoredAi, unanchoredNotes);

    // Keep the active card visible within the self-scrolling column.
    // `block:'nearest'` is a no-op when it's already in view, so this
    // doesn't fight manual scrolling.
    if (this.activeThreadId) {
      this.cardEls.get(this.activeThreadId)?.scrollIntoView({ block: 'nearest' });
    }

    // Emphasize the active annotation's range in the document (so the
    // selected comment/flashcard is visible in the text too). Only
    // re-dispatch when it changed — the tr is doc-neutral.
    const activeRange = this.activeThreadId ? (this.lastRanges.get(this.activeThreadId) ?? null) : null;
    const key = activeRange ? `${activeRange.from}:${activeRange.to}` : '';
    if (key !== this.lastActiveRangeKey) {
      this.lastActiveRangeKey = key;
      view.dispatch(setActiveAnnotationRangeTr(view.state, activeRange));
    }
  }

  /** No-op kept for the multi-pane shell, which calls it on pane
   *  scroll. Model 1 is a flow list — nothing to reposition on
   *  scroll (the column scrolls its own content). */
  relayoutCards(): void {
    /* intentionally empty */
  }

  /** Get or create the persistent card element for a thread. The
   *  click handler is attached once; it reads the thread's *current*
   *  range from `lastRanges` at click time (ranges move as the doc is
   *  edited, but the element — and its handler — persist). */
  private ensureCardEl(threadId: string): HTMLElement {
    const existing = this.cardEls.get(threadId);
    if (existing) return existing;
    const card = document.createElement('article');
    card.className = 'pmd-comment-thread';
    card.dataset['threadId'] = threadId;
    // Click → make this thread active (expand it, anchor it to its
    // range). Sticky until the user clicks elsewhere / opens another
    // card / hits the toggle. Clicks inside an editable bubble through.
    card.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('textarea, input, button')) return;
      // Clicking the already-active card collapses it WITHOUT
      // re-scrolling (a scroll here would jump the doc on every click
      // of an open card). Only a fresh activation scrolls to the
      // anchored text.
      if (this.activeThreadId === threadId) {
        this.dismissActive();
        return;
      }
      this.setActiveThread(threadId, 'click');
      const r = this.lastRanges.get(threadId);
      if (r) this.scrollToRange(r);
    });
    this.cardEls.set(threadId, card);
    return card;
  }

  /** Card-level header for a thread card (comment / AI): the type chip on
   *  the left, then (pushed right) the date and — when `onDelete` is
   *  given (expanded / pending) — a thread-delete ✕. Mirrors the
   *  flashcard header (chip + right-aligned status). Flashcards keep their
   *  own header + delete-in-actions, so they don't use this. */
  private buildThreadHeader(
    chip: HTMLElement,
    dateISO: string | null,
    onDelete?: () => void,
    resolve?: { resolved: boolean; onToggle: () => void },
  ): HTMLElement {
    const header = document.createElement('header');
    header.className = 'pmd-card-head';
    header.appendChild(chip);
    const spacer = document.createElement('span');
    spacer.className = 'pmd-card-head-spacer';
    header.appendChild(spacer);
    if (dateISO) {
      const date = document.createElement('span');
      date.className = 'pmd-comment-date';
      date.textContent = formatDate(dateISO);
      header.appendChild(date);
    }
    if (resolve) {
      // One-click "seen and acted on" — no typing. Round-trips with
      // Word as the thread's resolved state (w15:done).
      const res = document.createElement('button');
      res.type = 'button';
      res.className = 'pmd-comment-resolve';
      res.title = resolve.resolved ? 'Reopen' : 'Resolve';
      res.setAttribute('aria-pressed', String(resolve.resolved));
      setIcon(res, 'check');
      res.addEventListener('click', (e) => {
        e.stopPropagation();
        resolve.onToggle();
      });
      header.appendChild(res);
    }
    if (onDelete) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'pmd-comment-delete pmd-card-head-delete';
      del.title = 'Delete';
      setIcon(del, 'close');
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        onDelete();
      });
      header.appendChild(del);
    }
    return header;
  }

  private populateThread(card: HTMLElement, thread: Thread, isActive: boolean): void {
    card.replaceChildren();
    card.classList.toggle('pmd-comment-thread-active', isActive);
    const isResolved = thread.comments[0]?.resolved === true;
    card.classList.toggle('pmd-comment-thread-resolved', isResolved);

    // A freshly-created thread starts as a single empty-text root —
    // render it as a primary "add comment" input so the user can type
    // their first message; first submit edits the root in place.
    const root = thread.comments[0];
    const isEmptyRoot = thread.comments.length === 1 && root && root.text === '';
    if (isEmptyRoot && root) {
      card.appendChild(this.buildThreadHeader(makeCardTypeChip('comment'), root.date, () => this.deleteThread(thread.id)));
      card.appendChild(this.renderPrimaryInput(thread, root));
      return;
    }
    const resolveCtl = {
      resolved: isResolved,
      onToggle: () => this.toggleResolved(thread.id, !isResolved),
    };
    if (!isActive) {
      // Collapsed: chip header (own row, with date) + excerpt below — the
      // same silhouette as a collapsed flashcard. No avatar. The resolve
      // check shows (and toggles) here too, so acknowledging a comment
      // never requires expanding it first.
      card.appendChild(
        this.buildThreadHeader(makeCardTypeChip('comment'), root?.date ?? null, undefined, resolveCtl),
      );
      card.appendChild(this.renderThreadPreview(thread));
      return;
    }
    // No date in the expanded head: the root comment's stacked
    // timestamp is the same value two lines down.
    card.appendChild(
      this.buildThreadHeader(
        makeCardTypeChip('comment'),
        null,
        () => this.deleteThread(thread.id),
        resolveCtl,
      ),
    );
    for (const c of thread.comments) {
      card.appendChild(this.renderComment(thread, c, c.id === thread.id));
    }
    if (this.aiInFlight.has(thread.id)) {
      card.appendChild(this.renderAiThinkingPlaceholder());
    }
    card.appendChild(this.renderReplyForm(thread));
  }

  /** Signature gating re-population: changes only when a rebuild is
   *  actually needed (active toggle, comment add/edit/remove, AI
   *  in-flight flip). Excludes range (position-only → relayout) and
   *  reply text (transient — preserved across unrelated renders).
   *  An empty root renders the same whether active or not, so its
   *  signature ignores active to avoid recreating the input (and
   *  losing focus) on a stray cursor move. */
  private threadSignature(thread: Thread, isActive: boolean): string {
    const root = thread.comments[0];
    const isEmptyRoot = thread.comments.length === 1 && root && root.text === '';
    return JSON.stringify({
      a: isEmptyRoot ? 'empty' : isActive,
      ai: this.aiInFlight.has(thread.id),
      // Resolved is part of the signature: without it, a resolve toggle
      // didn't repopulate the card until the next expand/collapse.
      r: thread.comments[0]?.resolved === true,
      c: thread.comments.map((c) => [c.id, c.text, c.author, c.initials]),
    });
  }

  /** Drop all persistent card elements (view gone / empty state). */
  private clearAllCards(): void {
    this.cardEls.clear();
    this.cardSigs.clear();
    this.lastRanges = new Map();
    this.lastActiveRangeKey = '';
    this.lastDropCount = 0;
    if (this.unanchoredEl) {
      this.unanchoredEl.remove();
      this.unanchoredEl = null;
    }
  }

  /** Signature gating a flashcard card's re-population: card content +
   *  schedule state + active. (Range is position-only → relayout.) */
  private flashcardSignature(cardId: string, isActive: boolean): string {
    const def = learnStore.getCard(cardId);
    const sched = learnStore.getSchedule(cardId);
    return JSON.stringify({
      a: isActive,
      t: def?.type,
      f: def?.front,
      b: def?.back,
      s: sched?.state,
      d: sched?.dueOn,
    });
  }

  /** Status chip for a card's schedule — "New" / "Due" / "Due <date>" /
   *  "Suspended" — mirroring the manage GUI's wording. */
  private flashcardChip(cardId: string): { text: string; cls: string } {
    const s = learnStore.getSchedule(cardId);
    if (!s) return { text: '', cls: '' };
    if (s.state === 'suspended') return { text: 'Suspended', cls: 'is-suspended' };
    if (s.state === 'new') return { text: 'New', cls: '' };
    return isDue(s, localToday()) ? { text: 'Due', cls: 'is-due' } : { text: `Due ${s.dueOn}`, cls: '' };
  }

  /** Fill a flashcard card. Collapsed shows the front; active also
   *  reveals the back (Q&A). The element persists across renders so it
   *  reflows with the comment cards. */
  private populateFlashcard(card: HTMLElement, cardId: string, isActive: boolean): void {
    card.replaceChildren();
    card.classList.add('pmd-flashcard-card');
    card.classList.toggle('pmd-comment-thread-active', isActive);
    const def = learnStore.getCard(cardId);
    if (!def) return; // card vanished (deleted elsewhere) — next render drops it

    const header = document.createElement('header');
    header.className = 'pmd-flashcard-card-header';
    header.appendChild(makeCardTypeChip(def.type === 'cloze' ? 'cloze' : 'qa'));
    const chip = this.flashcardChip(cardId);
    if (chip.text) {
      const chipEl = document.createElement('span');
      chipEl.className = `pmd-flashcard-card-chip ${chip.cls}`;
      chipEl.textContent = chip.text;
      header.appendChild(chipEl);
    }
    card.appendChild(header);

    const front = document.createElement('div');
    front.className = 'pmd-flashcard-card-front';
    front.textContent = def.front;
    card.appendChild(front);
    if (isActive && def.type === 'qa' && def.back) {
      const back = document.createElement('div');
      back.className = 'pmd-flashcard-card-back';
      back.textContent = def.back;
      card.appendChild(back);
    }
    if (isActive) card.appendChild(this.buildFlashcardActions(cardId));
  }

  /** Render / update the collapsible "Unanchored (n)" section pinned at
   *  the bottom of the pane (flashcards whose anchor didn't resolve —
   *  a foreign edit broke them, or they're linked to the file but not
   *  yet grounded to text). Appended at the end of the flow list. */
  private renderUnanchoredSection(
    unanchored: CardAnchor[],
    unanchoredAi: AiThread[] = [],
    unanchoredNotes: Note[] = [],
  ): void {
    const total = unanchored.length + unanchoredAi.length + unanchoredNotes.length;
    if (total === 0) {
      if (this.unanchoredEl) {
        this.unanchoredEl.remove();
        this.unanchoredEl = null;
      }
      return;
    }
    let el = this.unanchoredEl;
    if (!el) {
      el = document.createElement('div');
      el.className = 'pmd-comments-unanchored';
      this.unanchoredEl = el;
    }
    el.replaceChildren();
    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'pmd-comments-unanchored-header';
    header.textContent = `${this.unanchoredCollapsed ? '▸' : '▾'} Unanchored (${total})`;
    header.addEventListener('click', () => {
      this.unanchoredCollapsed = !this.unanchoredCollapsed;
      // Re-render just this section + reflow (collapse changes height).
      const v = this.getView();
      if (!v) return;
      const did = this.getDocId();
      const map = flashcardRangeMap(v.state);
      const fc = learnStore.anchorsForDoc(did).filter((a) => !map.has(a.cardId));
      const ai = learnStore.aiThreadsForDoc(did).filter((t) => !map.has(t.threadId));
      const notes = learnStore.notesForDoc(did).filter((n) => !map.has(n.noteId));
      this.renderUnanchoredSection(fc, ai, notes);
      this.relayoutCards();
    });
    el.appendChild(header);
    if (!this.unanchoredCollapsed) {
      for (const a of unanchored) {
        el.appendChild(this.renderUnanchoredRow(a));
      }
      for (const t of unanchoredAi) {
        el.appendChild(this.renderUnanchoredAiRow(t));
      }
      for (const n of unanchoredNotes) {
        el.appendChild(this.renderUnanchoredNoteRow(n));
      }
    }
    this.content.appendChild(el);
  }

  private renderUnanchoredRow(anchor: CardAnchor): HTMLElement {
    const row = document.createElement('div');
    row.className = 'pmd-comments-unanchored-row';
    const def = learnStore.getCard(anchor.cardId);
    const front = document.createElement('div');
    front.className = 'pmd-comments-unanchored-front';
    const body = (def?.front ?? '').replace(/\s+/g, ' ').trim();
    front.textContent = body.length > 80 ? `${body.slice(0, 80).trimEnd()}…` : body || '(empty card)';
    row.appendChild(front);
    const was = document.createElement('div');
    was.className = 'pmd-comments-unanchored-was';
    if (anchor.anchor && anchor.anchor.quote) {
      const q = anchor.anchor.quote.replace(/\s+/g, ' ').trim();
      was.textContent = `was attached to: “${q.length > 70 ? q.slice(0, 70).trimEnd() + '…' : q}”`;
    } else {
      was.textContent = 'not yet grounded to text';
    }
    row.appendChild(was);
    row.appendChild(this.buildFlashcardActions(anchor.cardId, { reground: true }));
    return row;
  }

  /** Re-ground an unanchored card to the current editor selection
   *  (SPEC §4.3). The store change re-resolves it into an anchored
   *  card on the next refresh. */
  private regroundCard(cardId: string): void {
    const view = this.getView();
    if (!view) return;
    const sel = view.state.selection;
    if (sel.empty) {
      showToast('Select text in the document, then click Re-ground.');
      return;
    }
    const descriptor = buildDescriptor(view.state.doc, sel.from, sel.to);
    // Place the new range directly from the known selection, then persist
    // the descriptor — reconcile sees the range already present (no walk).
    this.placeLocalAnnotation(cardId, sel.from, sel.to, 'flashcard');
    learnStore.setAnchor(cardId, this.getDocId(), descriptor);
    showToast('Flashcard re-grounded.');
  }

  /** Shared action row for a flashcard — Edit, Suspend/Resume, Delete
   *  (two-click), plus an optional Re-ground (unanchored rows). Used by
   *  the active card and the Unanchored list; mutations flow through the
   *  store → subscription → re-resolve + re-render. */
  private buildFlashcardActions(cardId: string, opts: { reground?: boolean } = {}): HTMLElement {
    const actions = document.createElement('div');
    actions.className = 'pmd-flashcard-card-actions';
    const mk = (label: string, onClick: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pmd-flashcard-card-action';
      b.textContent = label;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
      return b;
    };
    if (opts.reground) actions.appendChild(mk('Re-ground', () => this.regroundCard(cardId)));
    actions.appendChild(
      mk('Edit', () => {
        const def = learnStore.getCard(cardId);
        if (!def) return;
        void (async () => {
          const next = await openCardEditor({
            initial: { type: def.type, front: def.front, back: def.back },
          });
          if (next) {
            learnStore.upsertCard(
              { id: cardId, type: next.type, front: next.front, back: next.back },
              localToday(),
            );
          }
        })();
      }),
    );
    const suspended = learnStore.getSchedule(cardId)?.state === 'suspended';
    actions.appendChild(mk(suspended ? 'Resume' : 'Suspend', () => learnStore.setSuspended(cardId, !suspended)));
    // Two-click delete (no native confirm in Electron).
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'pmd-flashcard-card-action pmd-flashcard-card-delete';
    del.textContent = 'Delete';
    let armed = false;
    let timer: number | null = null;
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!armed) {
        armed = true;
        del.textContent = 'Delete?';
        del.classList.add('is-armed');
        timer = window.setTimeout(() => {
          armed = false;
          del.textContent = 'Delete';
          del.classList.remove('is-armed');
        }, 3000);
        return;
      }
      if (timer !== null) window.clearTimeout(timer);
      learnStore.deleteCard(cardId);
    });
    actions.appendChild(del);
    return actions;
  }

  // ───────────────────────── AI threads (local layer) ────────────────
  // AI explainer threads live in the per-user LearnStore (never in the
  // document / never serialized), grounded by an AnchorDescriptor and
  // highlighted purple via the shared highlight plugin — the same model
  // as flashcards. These renderers mirror the comment-thread ones but
  // read `AiThread` / `LocalComment` from the store instead of the
  // comments plugin state.

  /** Activate a freshly-created AI thread: resolve its highlight, scroll
   *  to its text, and focus the question input. Called by the "Ask AI"
   *  command after it adds the thread to the store. */
  activateAiThread(threadId: string): void {
    // Capture the explainer context from the ORIGINAL selection now,
    // before refresh/scroll move it — so the model sees what the user
    // selected even if the doc later shifts (multi-turn reuses it).
    const view0 = this.getView();
    if (view0) {
      const ctx = buildExplainContext(view0.state);
      if (ctx) this.aiContextByThread.set(threadId, ctx);
    }
    const itemId = AI_PREFIX + threadId;
    this.activeThreadId = itemId;
    this.activeBy = 'click';
    this.refreshStickyDismissListener();
    // The range was already placed (known position) before the store add,
    // and the store-add reconcile rendered — just render for the active
    // state, no doc-walk.
    this.render();
    const r = this.lastRanges.get(itemId);
    if (r) this.scrollToRange(r);
    this.focusReplyForThread(itemId);
  }

  /** Signature gating an AI card's re-population: turns + active +
   *  in-flight. */
  private aiThreadSignature(threadId: string, isActive: boolean): string {
    const t = learnStore.getAiThread(threadId);
    return JSON.stringify({
      a: isActive,
      f: this.aiInFlight.has(threadId),
      c: (t?.comments ?? []).map((c) => [c.author, c.text, c.ai ?? false]),
    });
  }

  /** Fill an AI-thread card from the store. No turns → header + "ask"
   *  input (producer state); collapsed → one-line preview; active →
   *  the conversation + reply box + actions. Purple via `pmd-ai-card`. */
  private populateAiThread(card: HTMLElement, threadId: string, isActive: boolean): void {
    card.replaceChildren();
    card.classList.add('pmd-ai-card');
    card.classList.toggle('pmd-comment-thread-active', isActive);
    const thread = learnStore.getAiThread(threadId);
    if (!thread) return; // vanished — next render drops it

    if (thread.comments.length === 0) {
      // Producer state renders the same active or not (see signature),
      // so the input doesn't get recreated — and lose focus — on a
      // stray cursor move.
      card.appendChild(this.buildThreadHeader(makeCardTypeChip('ai'), thread.createdAt, () => this.deleteAiThread(threadId)));
      card.appendChild(this.buildAiInput(threadId, 'Ask a question', 'Ask'));
      return;
    }
    if (!isActive) {
      card.appendChild(this.buildThreadHeader(makeCardTypeChip('ai'), thread.createdAt));
      card.appendChild(this.renderAiPreview(thread));
      return;
    }
    card.appendChild(this.buildThreadHeader(makeCardTypeChip('ai'), thread.createdAt, () => this.deleteAiThread(threadId)));
    // The opening question renders as the root (un-indented) — it begins
    // the conversation, it isn't a reply. Answers + follow-ups are replies.
    thread.comments.forEach((c, i) => card.appendChild(this.renderAiComment(c, i === 0)));
    if (this.aiInFlight.has(threadId)) card.appendChild(this.renderAiThinkingPlaceholder(true));
    card.appendChild(this.buildAiInput(threadId, 'Reply…', 'Reply'));
    card.appendChild(this.buildAiConvertButton(threadId));
  }

  private renderAiPreview(thread: { comments: LocalComment[] }): HTMLElement {
    const block = document.createElement('div');
    block.className = 'pmd-comment-preview';
    const first = thread.comments[0]!;
    const text = document.createElement('span');
    text.className = 'pmd-comment-preview-text';
    const body = first.text.replace(/\s+/g, ' ').trim();
    text.textContent = body.length > 80 ? `${body.slice(0, 80).trimEnd()}…` : body || '(empty)';
    block.appendChild(text);
    if (thread.comments.length > 1) {
      const count = document.createElement('span');
      count.className = 'pmd-comment-preview-count';
      count.textContent = `${thread.comments.length}`;
      block.appendChild(count);
    }
    return block;
  }

  /** Render a local-thread turn (AI thread or note). The opening turn
   *  (`isRoot`) renders un-indented like a comment root; later turns
   *  indent as replies. AI turns carry a purple avatar (`pmd-comment-ai`);
   *  the card-level "AI" chip already marks the thread, so turns aren't
   *  chipped. When `onEdit` is given (notes), an inline edit button is
   *  shown; AI threads omit it (you don't edit a model conversation).
   *  No per-turn delete — the header ✕ removes the whole thread. */
  private renderAiComment(
    c: LocalComment,
    isRoot: boolean,
    onEdit?: (text: string) => void,
  ): HTMLElement {
    const block = document.createElement('div');
    block.className = isRoot ? 'pmd-comment-root' : 'pmd-comment-reply';
    if (c.ai) block.classList.add('pmd-comment-ai');
    const header = document.createElement('header');
    header.className = 'pmd-comment-header';
    const badge = document.createElement('span');
    badge.className = 'pmd-comment-initials';
    fillBadge(badge, c.author, c.ai ? aiPersonaInitials(c.author) : '');
    header.appendChild(badge);
    // Stacked identity — see renderComment.
    const idcol = document.createElement('span');
    idcol.className = 'pmd-comment-idcol';
    const name = document.createElement('span');
    name.className = 'pmd-comment-author';
    name.textContent = c.author || 'Unknown';
    idcol.appendChild(name);
    if (c.at) {
      const date = document.createElement('span');
      date.className = 'pmd-comment-date';
      date.textContent = formatDate(c.at);
      idcol.appendChild(date);
    }
    header.appendChild(idcol);
    const body = document.createElement('div');
    body.className = 'pmd-comment-body';
    for (const line of c.text.split('\n')) {
      const p = document.createElement('p');
      p.textContent = line;
      body.appendChild(p);
    }
    if (onEdit) {
      header.appendChild(
        this.buildEditButton(() => this.startInlineEdit(body, c.text, onEdit)),
      );
    }
    block.appendChild(header);
    block.appendChild(body);
    return block;
  }

  /** Question / reply input for an AI thread. Mirrors `buildInputForm`
   *  but keyed by the AI item id and routed to `askAi`. */
  private buildAiInput(threadId: string, placeholder: string, submitLabel: string): HTMLFormElement {
    const itemId = AI_PREFIX + threadId;
    const form = document.createElement('form');
    form.className = 'pmd-comment-reply-form';
    const ta = document.createElement('textarea');
    ta.className = 'pmd-comment-reply-input';
    ta.rows = 1;
    ta.placeholder = placeholder;
    this.autoGrow(ta);
    if (this.activeReplyThreadId === itemId) ta.value = this.activeReplyText;
    ta.addEventListener('focus', () => {
      this.activeReplyThreadId = itemId;
      this.activeReplyText = ta.value;
    });
    ta.addEventListener('input', () => {
      if (this.activeReplyThreadId === itemId) this.activeReplyText = ta.value;
    });
    ta.addEventListener('blur', () => {
      if (this.suppressBlurReset) return;
      this.activeReplyThreadId = null;
      this.activeReplyText = '';
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    form.appendChild(ta);
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'pmd-comment-reply-submit';
    submitBtn.title = submitLabel;
    setIcon(submitBtn, 'send-cursor');
    form.appendChild(submitBtn);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = ta.value.trim();
      if (!t) return;
      this.askAi(threadId, t);
    });
    return form;
  }

  /** Record a user turn on an AI thread, then fire the model request;
   *  the reply lands as an `ai: true` turn in the same local thread. */
  private askAi(threadId: string, text: string): void {
    this.suppressBlurReset = true;
    this.activeReplyThreadId = null;
    this.activeReplyText = '';
    this.activeThreadId = AI_PREFIX + threadId;
    this.activeBy = 'click';
    learnStore.appendAiComment(threadId, {
      author: settings.get('commentAuthor'),
      text,
      at: new Date().toISOString(),
      ai: false,
    });
    this.suppressBlurReset = false;
    this.invokeAiLocal('ai', threadId);
  }

  /** Run the AI explainer against a LOCAL AI thread. Mirrors `invokeAi`
   *  (the comment-thread variant) but reads turns from / writes the
   *  reply to the LearnStore `AiThread` — no `comment_range` mark, so
   *  nothing serializes into the shared doc. Builds the multi-turn
   *  message list (user turns → `user`, `ai: true` turns → `assistant`),
   *  wrapping the first user turn in the context-rich explainer prompt. */
  private invokeAiLocal(kind: 'ai' | 'note', id: string): void {
    const view = this.getView();
    if (!view) return;
    if (!aiGateToast()) return;
    const apiKey = activeApiKey();
    const item = kind === 'ai' ? learnStore.getAiThread(id) : learnStore.getNote(id);
    if (!item) return;

    let ctx = this.aiContextByThread.get(id) ?? null;
    if (!ctx) ctx = this.contextFromLocal(kind, id);
    if (!ctx) {
      showToast('Could not build context for AI request.');
      return;
    }
    const promptCtx = ctx;
    this.aiContextByThread.set(id, promptCtx);

    const messages = item.comments.flatMap((c, i): LlmMessage[] => {
      if (!c.text.trim()) return [];
      if (c.ai) return [{ role: 'assistant', content: c.text }];
      const isFirstUserTurn = !item.comments.slice(0, i).some((p) => !p.ai && p.text.trim());
      const content = isFirstUserTurn ? formatExplainFirstTurn(c.text, promptCtx) : c.text;
      return [{ role: 'user', content }];
    });
    if (messages.length === 0) return;

    const prefix = kind === 'ai' ? AI_PREFIX : NOTE_PREFIX;
    this.aiInFlight.add(id);
    this.activeThreadId = prefix + id;
    this.activeBy = 'click';
    this.refreshStickyDismissListener();
    this.render();
    this.startActivityTicker();

    void (async () => {
      try {
        const reply = await callLlm({ apiKey, system: EXPLAIN_SYSTEM_PROMPT, messages });
        // Drop the in-flight flag BEFORE appending so the store-driven
        // re-render shows the reply without the Thinking… placeholder.
        this.aiInFlight.delete(id);
        if (this.aiInFlight.size === 0) this.stopActivityTicker();
        const aiTurn = {
          author: aiPersonaName(),
          text: reply.text.trim(),
          at: new Date().toISOString(),
          ai: true,
        };
        if (kind === 'ai') learnStore.appendAiComment(id, aiTurn);
        else learnStore.appendNoteComment(id, aiTurn);
      } catch (e) {
        aiFailureNotice('AI', e);
      } finally {
        this.aiInFlight.delete(id);
        if (this.aiInFlight.size === 0) this.stopActivityTicker();
        this.render();
      }
    })();
  }

  /** Build an `ExplainContext` from an AI thread's current grounding —
   *  the live highlight range if resolved, else the stored descriptor —
   *  for the case where no context was cached at creation (e.g. a
   *  follow-up after reload). */
  private contextFromLocal(
    kind: 'ai' | 'note',
    id: string,
  ): ReturnType<typeof buildExplainContext> {
    const view = this.getView();
    if (!view) return null;
    const prefix = kind === 'ai' ? AI_PREFIX : NOTE_PREFIX;
    let range = this.lastRanges.get(prefix + id) ?? null;
    if (!range) {
      const item = kind === 'ai' ? learnStore.getAiThread(id) : learnStore.getNote(id);
      if (item?.anchor) {
        const r = resolveDescriptor(view.state.doc, item.anchor);
        if (r) range = { from: r.from, to: r.to };
      }
    }
    if (!range) return null;
    const TextSelection = (view.state.selection.constructor as unknown) as {
      create: (doc: PMNode, from: number, to: number) => never;
    };
    const synth = view.state.apply(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, range.from, range.to)),
    );
    return buildExplainContext(synth);
  }

  /** Promoted, filled-blue "Convert to Flashcard" button, sitting just
   *  below the reply box (the AI card's delete lives in the header ✕). */
  private buildAiConvertButton(threadId: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmd-ai-convert-btn';
    btn.textContent = 'Convert to Flashcard';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      void this.convertAiThreadToFlashcard(threadId, btn);
    });
    return btn;
  }

  /** Ask the model for a flashcard that captures what the AI thread
   *  explored, then open the create-flashcard editor pre-populated so the
   *  user can tweak or confirm. The new card grounds to the SAME
   *  selection as the AI question. */
  private async convertAiThreadToFlashcard(threadId: string, btn: HTMLButtonElement): Promise<void> {
    if (!aiGateToast()) return;
    const apiKey = activeApiKey();
    const thread = learnStore.getAiThread(threadId);
    if (!thread) return;
    const ctx = this.aiContextByThread.get(threadId) ?? this.contextFromLocal('ai', threadId);
    if (!ctx) {
      showToast('Could not build context for the flashcard.');
      return;
    }
    const turns = thread.comments
      .filter((c) => c.text.trim())
      .map((c) => ({ role: c.ai ? ('assistant' as const) : ('user' as const), text: c.text }));
    if (turns.length === 0) {
      showToast('Ask a question first, then convert.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Generating…';
    let card: NewCardDef;
    try {
      card = await requestFlashcard(apiKey, ctx, turns);
    } catch (e) {
      aiFailureNotice('AI', e);
      btn.disabled = false;
      btn.textContent = 'Convert to Flashcard';
      return;
    }
    btn.disabled = false;
    btn.textContent = 'Convert to Flashcard';

    // Pre-populate the editor; show the anchor it'll inherit (the AI
    // question's selection) when the thread is grounded.
    const anchorQuote = thread.anchor?.quote;
    const edited = await openCardEditor({
      initial: card,
      title: 'Convert to flashcard',
      ...(anchorQuote ? { selectedText: anchorQuote } : {}),
    });
    if (!edited) return;
    const cardId = crypto.randomUUID();
    learnStore.upsertCard(
      { id: cardId, type: edited.type, front: edited.front, back: edited.back },
      localToday(),
    );
    // Ground the flashcard to the same selection the AI question used.
    learnStore.setAnchor(cardId, thread.docId, thread.anchor);
    showToast('Flashcard created.');
  }

  /** Shared two-click delete button for an AI thread. */
  private buildAiDeleteButton(threadId: string): HTMLButtonElement {
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'pmd-flashcard-card-action pmd-flashcard-card-delete';
    del.textContent = 'Delete';
    let armed = false;
    let timer: number | null = null;
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!armed) {
        armed = true;
        del.textContent = 'Delete?';
        del.classList.add('is-armed');
        timer = window.setTimeout(() => {
          armed = false;
          del.textContent = 'Delete';
          del.classList.remove('is-armed');
        }, 3000);
        return;
      }
      if (timer !== null) window.clearTimeout(timer);
      this.deleteAiThread(threadId);
    });
    return del;
  }

  private deleteAiThread(threadId: string): void {
    if (this.activeThreadId === AI_PREFIX + threadId) {
      this.activeThreadId = null;
      this.activeBy = null;
      this.refreshStickyDismissListener();
    }
    // Store removal fires the subscription → re-resolve + re-render.
    learnStore.removeAiThread(threadId);
  }

  /** Re-ground an unanchored AI thread to the current editor selection
   *  (mirrors `regroundCard`). */
  private regroundAiThread(threadId: string): void {
    const view = this.getView();
    if (!view) return;
    const sel = view.state.selection;
    if (sel.empty) {
      showToast('Select text in the document, then click Re-ground.');
      return;
    }
    const descriptor = buildDescriptor(view.state.doc, sel.from, sel.to);
    this.placeLocalAnnotation(threadId, sel.from, sel.to, 'ai');
    learnStore.setAiThreadAnchor(threadId, descriptor);
    showToast('AI note re-grounded.');
  }

  private renderUnanchoredAiRow(thread: AiThread): HTMLElement {
    const row = document.createElement('div');
    row.className = 'pmd-comments-unanchored-row';
    const front = document.createElement('div');
    front.className = 'pmd-comments-unanchored-front';
    const first = thread.comments[0];
    const body = (first?.text ?? '').replace(/\s+/g, ' ').trim();
    front.textContent = (body.length > 80 ? `${body.slice(0, 80).trimEnd()}…` : body) || 'AI note';
    row.appendChild(front);
    const was = document.createElement('div');
    was.className = 'pmd-comments-unanchored-was';
    if (thread.anchor && thread.anchor.quote) {
      const q = thread.anchor.quote.replace(/\s+/g, ' ').trim();
      was.textContent = `was attached to: “${q.length > 70 ? q.slice(0, 70).trimEnd() + '…' : q}”`;
    } else {
      was.textContent = 'not yet grounded to text';
    }
    row.appendChild(was);
    const actions = document.createElement('div');
    actions.className = 'pmd-flashcard-card-actions';
    const rg = document.createElement('button');
    rg.type = 'button';
    rg.className = 'pmd-flashcard-card-action';
    rg.textContent = 'Re-ground';
    rg.addEventListener('click', (e) => {
      e.stopPropagation();
      this.regroundAiThread(thread.threadId);
    });
    actions.appendChild(rg);
    actions.appendChild(this.buildAiDeleteButton(thread.threadId));
    row.appendChild(actions);
    return row;
  }

  // ── notes (private comment threads) ────────────────────────────────
  // Mirror the AI-thread card flow, minus the AI semantics: a note is a
  // plain user-authored comment thread that lives in the LearnStore
  // (never serialized into the doc unless exported), green-chipped.

  /** Activate (expand + scroll to) a note card. Mirrors
   *  `activateAiThread`. */
  activateNote(noteId: string): void {
    const itemId = NOTE_PREFIX + noteId;
    this.activeThreadId = itemId;
    this.activeBy = 'click';
    this.refreshStickyDismissListener();
    // Range already placed at creation (known position) — just render.
    this.render();
    const r = this.lastRanges.get(itemId);
    if (r) this.scrollToRange(r);
    this.focusReplyForThread(itemId);
  }

  /** Signature gating a note card's re-population: turns + active. The
   *  empty (producer) state renders the same active or not, so it's
   *  active-invariant — otherwise a stray cursor move recreates the
   *  input and steals focus. */
  private noteSignature(noteId: string, isActive: boolean): string {
    const n = learnStore.getNote(noteId);
    const empty = (n?.comments.length ?? 0) === 0;
    return JSON.stringify({
      a: empty ? 'empty' : isActive,
      f: this.aiInFlight.has(noteId),
      c: (n?.comments ?? []).map((c) => [c.author, c.text, c.ai ?? false]),
    });
  }

  /** Fill a note card from the store. No turns → header + "write a note"
   *  input; collapsed → one-line preview; active → the thread + reply
   *  box. Green via `pmd-note-card`. */
  private populateNote(card: HTMLElement, noteId: string, isActive: boolean): void {
    card.replaceChildren();
    card.classList.add('pmd-note-card');
    card.classList.toggle('pmd-comment-thread-active', isActive);
    const note = learnStore.getNote(noteId);
    if (!note) return; // vanished — next render drops it

    const chipKind: CardTypeChipKind = note.kind ?? 'note';
    const emptyPlaceholder =
      note.kind === 'cutter-guidance'
        ? 'How should cards in this file be cut? (strategy, antecedents, what to prioritize)'
        : note.kind === 'cutter-section'
        ? 'Why this section matters to cuts (optional — the text itself is the context)'
        : 'Write a note';

    if (note.comments.length === 0) {
      card.appendChild(this.buildThreadHeader(makeCardTypeChip(chipKind), note.createdAt, () => this.deleteNote(noteId)));
      card.appendChild(this.buildNoteInput(noteId, emptyPlaceholder, 'Add'));
      return;
    }
    if (!isActive) {
      card.appendChild(this.buildThreadHeader(makeCardTypeChip(chipKind), note.createdAt));
      card.appendChild(this.renderAiPreview(note));
      return;
    }
    card.appendChild(this.buildThreadHeader(makeCardTypeChip(chipKind), note.createdAt, () => this.deleteNote(noteId)));
    note.comments.forEach((c, i) =>
      card.appendChild(
        this.renderAiComment(c, i === 0, (text) => learnStore.editNoteComment(noteId, i, text)),
      ),
    );
    if (this.aiInFlight.has(noteId)) card.appendChild(this.renderAiThinkingPlaceholder(true));
    card.appendChild(this.buildNoteInput(noteId, 'Reply…', 'Reply'));
  }

  /** Message / reply input for a note. Routes to `addNoteComment`, which
   *  only calls the model when the message mentions `@AI` (or the note
   *  already has an AI turn) — otherwise it's a plain private note. */
  private buildNoteInput(noteId: string, placeholder: string, submitLabel: string): HTMLFormElement {
    const itemId = NOTE_PREFIX + noteId;
    const form = document.createElement('form');
    form.className = 'pmd-comment-reply-form';
    const ta = document.createElement('textarea');
    ta.className = 'pmd-comment-reply-input';
    ta.rows = 1;
    ta.placeholder = placeholder;
    this.autoGrow(ta);
    if (this.activeReplyThreadId === itemId) ta.value = this.activeReplyText;
    ta.addEventListener('focus', () => {
      this.activeReplyThreadId = itemId;
      this.activeReplyText = ta.value;
    });
    ta.addEventListener('input', () => {
      if (this.activeReplyThreadId === itemId) this.activeReplyText = ta.value;
    });
    ta.addEventListener('blur', () => {
      if (this.suppressBlurReset) return;
      this.activeReplyThreadId = null;
      this.activeReplyText = '';
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    form.appendChild(ta);
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'pmd-comment-reply-submit';
    submitBtn.title = submitLabel;
    setIcon(submitBtn, 'send-cursor');
    form.appendChild(submitBtn);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = ta.value.trim();
      if (!t) return;
      this.addNoteComment(noteId, t);
    });
    return form;
  }

  /** Append a user turn to a note (the store change re-renders), then
   *  re-focus the reply box for continued typing. */
  private addNoteComment(noteId: string, text: string): void {
    this.suppressBlurReset = true;
    this.activeReplyThreadId = null;
    this.activeReplyText = '';
    this.activeThreadId = NOTE_PREFIX + noteId;
    this.activeBy = 'click';
    learnStore.appendNoteComment(noteId, {
      author: settings.get('commentAuthor'),
      text,
      at: new Date().toISOString(),
    });
    this.suppressBlurReset = false;
    this.focusReplyForThread(NOTE_PREFIX + noteId);
    // `@AI …` in a note summons the model too (the reply lands as a
    // private AI turn on the note).
    this.maybeInvokeAiForNote(noteId, text);
  }

  private deleteNote(noteId: string): void {
    if (this.activeThreadId === NOTE_PREFIX + noteId) {
      this.activeThreadId = null;
      this.activeBy = null;
      this.refreshStickyDismissListener();
    }
    // Store removal fires the subscription → re-resolve + re-render.
    learnStore.removeNote(noteId);
  }

  /** Shared two-click delete button for a note. */
  private buildNoteDeleteButton(noteId: string): HTMLButtonElement {
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'pmd-flashcard-card-action pmd-flashcard-card-delete';
    del.textContent = 'Delete';
    let armed = false;
    let timer: number | null = null;
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!armed) {
        armed = true;
        del.textContent = 'Delete?';
        del.classList.add('is-armed');
        timer = window.setTimeout(() => {
          armed = false;
          del.textContent = 'Delete';
          del.classList.remove('is-armed');
        }, 3000);
        return;
      }
      if (timer !== null) window.clearTimeout(timer);
      this.deleteNote(noteId);
    });
    return del;
  }

  /** Re-ground an unanchored note to the current editor selection. */
  private regroundNote(noteId: string): void {
    const view = this.getView();
    if (!view) return;
    const sel = view.state.selection;
    if (sel.empty) {
      showToast('Select text in the document, then click Re-ground.');
      return;
    }
    const descriptor = buildDescriptor(view.state.doc, sel.from, sel.to);
    this.placeLocalAnnotation(noteId, sel.from, sel.to, 'note');
    learnStore.setNoteAnchor(noteId, descriptor);
    showToast('Note re-grounded.');
  }

  private renderUnanchoredNoteRow(note: Note): HTMLElement {
    const row = document.createElement('div');
    row.className = 'pmd-comments-unanchored-row';
    const front = document.createElement('div');
    front.className = 'pmd-comments-unanchored-front';
    const first = note.comments[0];
    const body = (first?.text ?? '').replace(/\s+/g, ' ').trim();
    front.textContent = (body.length > 80 ? `${body.slice(0, 80).trimEnd()}…` : body) || 'Note';
    row.appendChild(front);
    const was = document.createElement('div');
    was.className = 'pmd-comments-unanchored-was';
    if (note.anchor && note.anchor.quote) {
      const q = note.anchor.quote.replace(/\s+/g, ' ').trim();
      was.textContent = `was attached to: “${q.length > 70 ? q.slice(0, 70).trimEnd() + '…' : q}”`;
    } else {
      was.textContent = 'not yet grounded to text';
    }
    row.appendChild(was);
    const actions = document.createElement('div');
    actions.className = 'pmd-flashcard-card-actions';
    const rg = document.createElement('button');
    rg.type = 'button';
    rg.className = 'pmd-flashcard-card-action';
    rg.textContent = 'Re-ground';
    rg.addEventListener('click', (e) => {
      e.stopPropagation();
      this.regroundNote(note.noteId);
    });
    actions.appendChild(rg);
    actions.appendChild(this.buildNoteDeleteButton(note.noteId));
    row.appendChild(actions);
    return row;
  }

  /** One-line preview used when a thread is collapsed. Shows the
   *  root comment's author badge, name, and a truncated body
   *  excerpt — enough that the user can identify the thread at a
   *  glance without it crowding the column. */
  private renderThreadPreview(thread: Thread): HTMLElement {
    const block = document.createElement('div');
    block.className = 'pmd-comment-preview';
    const root = thread.comments[0]!;
    const text = document.createElement('span');
    text.className = 'pmd-comment-preview-text';
    const body = root.text.replace(/\s+/g, ' ').trim();
    const excerpt = body.length > 80 ? `${body.slice(0, 80).trimEnd()}…` : body;
    text.textContent = excerpt || '(empty)';
    block.appendChild(text);
    if (thread.comments.length > 1) {
      const count = document.createElement('span');
      count.className = 'pmd-comment-preview-count';
      count.textContent = `${thread.comments.length}`;
      block.appendChild(count);
    }
    return block;
  }

  /** `local` → match a local AI thread's turn (persona name + derived
   *  initials + AI chip); default → match a comment-thread AI reply
   *  (fixed `'AI'` badge initials), so the placeholder doesn't visually
   *  jump when the response arrives. */
  private renderAiThinkingPlaceholder(local = false): HTMLElement {
    const block = document.createElement('div');
    block.className = 'pmd-comment-reply pmd-comment-ai pmd-comment-ai-thinking';
    const header = document.createElement('header');
    header.className = 'pmd-comment-header';
    const badge = document.createElement('span');
    badge.className = 'pmd-comment-initials';
    const author = aiPersonaName();
    if (local) fillBadge(badge, author, aiPersonaInitials(author));
    else badge.textContent = 'AI';
    header.appendChild(badge);
    // Same stacked-identity structure as a real comment header (the
    // panel redesign moved names into .pmd-comment-idcol; a bare name
    // span here left the placeholder mis-aligned against every real
    // block around it — field find, 2026-08-18). No date: the reply
    // doesn't exist yet.
    const idcol = document.createElement('span');
    idcol.className = 'pmd-comment-idcol';
    const name = document.createElement('span');
    name.className = 'pmd-comment-author';
    name.textContent = author;
    idcol.appendChild(name);
    // The activity text sits WHERE A REAL COMMENT'S TIMESTAMP sits —
    // the second identity line beside the avatar's lower half. A body
    // block below left a hole there (the avatar is two lines tall and
    // nothing filled line two), which read as the text floating
    // mis-aligned below its box (field find, 2026-08-18).
    const line = document.createElement('span');
    line.className = 'pmd-comment-ai-thinking-dots';
    const stage = makeActivityStage(this.inFlightActivityText());
    // The identity column constrains the width; opt out of the
    // activity-cycler's auto-width so long activity strings wrap
    // inside the column instead of pushing past it.
    stage.classList.add('pmd-activity-stage-fixed-width');
    line.appendChild(stage);
    idcol.appendChild(line);
    header.appendChild(idcol);
    block.appendChild(header);
    // Tag with `data-activity-target` so the activity-cycling tick
    // can find this stage without re-rendering the whole column.
    stage.dataset['activityTarget'] = '1';
    return block;
  }

  private inFlightActivityText(): string {
    if (!settings.get('clodEnabled')) return 'Thinking…';
    const pool = activitiesForNow({
      customByTime: settings.get('clodActivitiesByTime'),
      ranges: settings.get('clodTimePeriods'),
    });
    const raw = pickRandomActivity(pool);
    return personalizeActivity(raw, getAiPersona());
  }

  /** Tick the in-flight placeholders' text to fresh Clod activities
   *  every few seconds while at least one AI request is pending. */
  private startActivityTicker(): void {
    if (this.activityTimer !== null) return;
    const tick = (): void => {
      if (this.aiInFlight.size === 0 || !settings.get('clodEnabled')) {
        this.stopActivityTicker();
        return;
      }
      const stages = this.root.querySelectorAll<HTMLElement>('[data-activity-target]');
      for (const stage of stages) {
        cycleActivityText(stage, this.inFlightActivityText());
      }
    };
    this.activityTimer = window.setInterval(tick, ACTIVITY_TICK_MS);
  }

  private stopActivityTicker(): void {
    if (this.activityTimer !== null) {
      window.clearInterval(this.activityTimer);
      this.activityTimer = null;
    }
  }

  private renderPrimaryInput(thread: Thread, root: Comment): HTMLElement {
    return this.buildInputForm(thread, 'Add a comment…', (text) => {
      this.commitRootText(thread.id, root.id, text);
      // The first comment message is an AI trigger too — `@AI …` here
      // must summon the model, not just replies.
      this.maybeInvokeAiForComment(thread.id, text);
    }, 'Comment');
  }

  private renderReplyForm(thread: Thread): HTMLElement {
    const form = this.buildInputForm(thread, 'Reply…', (text) => {
      this.submitReply(thread.id, text);
    }, 'Reply');
    // One-click 👍 — an ordinary emoji-only reply, so it round-trips
    // through docx/Word as a plain comment reply (the format has no
    // durable reaction primitive; this is the portable equivalent).
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'pmd-comment-thumb';
    thumb.title = 'Reply 👍';
    thumb.textContent = '\u{1F44D}';
    thumb.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.submitReply(thread.id, '\u{1F44D}');
    });
    form.appendChild(thumb);
    return form;
  }

  /** Make a composer textarea auto-grow with its content: spawns one
   *  line tall (so the send/👍 squares match its empty height), grows
   *  to fit as the user types, and caps at the CSS max-height (~6
   *  lines), where the internal scrollbar takes over. Manual resize
   *  is off — the drag handle fought the auto-height on every input.
   *  Runs once immediately for restored / pre-filled text. */
  private autoGrow(ta: HTMLTextAreaElement): void {
    const grow = (): void => {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight + 2}px`; // +2: borders (border-box)
    };
    ta.addEventListener('input', grow);
    // The element isn't in the DOM yet at build time — scrollHeight
    // reads 0 there — so measure on the next frame.
    requestAnimationFrame(grow);
  }

  private buildInputForm(
    thread: Thread,
    placeholder: string,
    onSubmit: (text: string) => void,
    submitLabel: string,
  ): HTMLFormElement {
    const form = document.createElement('form');
    form.className = 'pmd-comment-reply-form';

    const ta = document.createElement('textarea');
    ta.className = 'pmd-comment-reply-input';
    ta.rows = 1;
    ta.placeholder = placeholder;
    this.autoGrow(ta);
    if (this.activeReplyThreadId === thread.id) ta.value = this.activeReplyText;
    ta.addEventListener('focus', () => {
      this.activeReplyThreadId = thread.id;
      this.activeReplyText = ta.value;
    });
    ta.addEventListener('input', () => {
      if (this.activeReplyThreadId === thread.id) this.activeReplyText = ta.value;
    });
    ta.addEventListener('blur', () => {
      if (this.suppressBlurReset) return;
      this.activeReplyThreadId = null;
      this.activeReplyText = '';
    });
    // Enter submits, Shift-Enter inserts a newline.
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    form.appendChild(ta);

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'pmd-comment-reply-submit';
    submitBtn.title = submitLabel;
    setIcon(submitBtn, 'send-cursor');
    form.appendChild(submitBtn);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text) return;
      onSubmit(text);
    });
    return form;
  }

  private commitRootText(threadId: string, commentId: string, text: string): void {
    const view = this.getView();
    if (!view) return;
    this.suppressBlurReset = true;
    this.activeReplyThreadId = null;
    this.activeReplyText = '';
    view.dispatch(
      view.state.tr.setMeta(commentsKey, editCommentTextMeta(threadId, commentId, text)),
    );
    this.suppressBlurReset = false;
    view.focus();
  }

  /** A small pencil edit button for a comment header. */
  private buildEditButton(onClick: () => void): HTMLButtonElement {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'pmd-comment-edit';
    edit.title = 'Edit';
    setIcon(edit, 'edit');
    edit.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return edit;
  }

  /** Swap a rendered comment body for an inline edit form (textarea +
   *  Save / Cancel). `commit(text)` persists the new text (which triggers
   *  a re-render that replaces this form); Cancel / Esc restores the
   *  original body untouched. Shared by human comments and notes. */
  private startInlineEdit(
    body: HTMLElement,
    currentText: string,
    commit: (text: string) => void,
  ): void {
    const form = document.createElement('form');
    form.className = 'pmd-comment-edit-form';
    // Clicks inside the editor shouldn't toggle/collapse the card.
    form.addEventListener('click', (e) => e.stopPropagation());
    const ta = document.createElement('textarea');
    ta.className = 'pmd-comment-reply-input pmd-comment-edit-input';
    ta.rows = 1;
    ta.value = currentText;
    this.autoGrow(ta);
    form.appendChild(ta);
    const actions = document.createElement('div');
    actions.className = 'pmd-comment-edit-actions';
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'pmd-comment-edit-btn pmd-comment-edit-save';
    save.textContent = 'Save';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'pmd-comment-edit-btn';
    cancel.textContent = 'Cancel';
    actions.append(save, cancel);
    form.appendChild(actions);
    body.replaceWith(form);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
    const restore = (): void => {
      form.replaceWith(body);
    };
    cancel.addEventListener('click', (e) => {
      e.stopPropagation();
      restore();
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        restore();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text) return;
      commit(text);
    });
  }

  private renderComment(thread: Thread, comment: Comment, isRoot: boolean): HTMLElement {
    const block = document.createElement('div');
    block.className = isRoot ? 'pmd-comment-root' : 'pmd-comment-reply';
    // Purple styling keys off `isAiComment` (initials + legacy
    // name-suffix detection), not the `kind` field, which doesn't
    // round-trip through docx.
    if (isAiComment(comment)) block.classList.add('pmd-comment-ai');

    const header = document.createElement('header');
    header.className = 'pmd-comment-header';
    const badge = document.createElement('span');
    badge.className = 'pmd-comment-initials';
    fillBadge(badge, comment.author, comment.initials);
    header.appendChild(badge);
    // Stacked identity: name over a small muted timestamp, so neither
    // can wrap raggedly at any panel width (the pre-redesign layout
    // put them side by side and both wrapped).
    const idcol = document.createElement('span');
    idcol.className = 'pmd-comment-idcol';
    const name = document.createElement('span');
    name.className = 'pmd-comment-author';
    name.textContent = isAiComment(comment) ? displayAuthor(comment) : comment.author || 'Unknown';
    idcol.appendChild(name);
    if (comment.date) {
      const date = document.createElement('span');
      date.className = 'pmd-comment-date';
      date.textContent = formatDate(comment.date);
      idcol.appendChild(date);
    }
    header.appendChild(idcol);

    const body = document.createElement('div');
    body.className = 'pmd-comment-body';
    for (const line of comment.text.split('\n')) {
      const p = document.createElement('p');
      p.textContent = line;
      body.appendChild(p);
    }

    // Edit any comment in place (root or reply). Persists via the
    // comments plugin's edit-text meta, keyed by the comment id.
    header.appendChild(
      this.buildEditButton(() =>
        this.startInlineEdit(body, comment.text, (text) =>
          this.commitRootText(thread.id, comment.id, text),
        ),
      ),
    );
    // Thread-level delete lives in the card header; replies keep a
    // per-turn ✕ to delete just that reply.
    if (!isRoot) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'pmd-comment-delete';
      del.title = 'Delete reply';
      setIcon(del, 'close');
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteComment(thread.id, comment.id);
      });
      header.appendChild(del);
    }
    block.appendChild(header);
    block.appendChild(body);
    return block;
  }

  /** Flip a thread's resolved flag — the checkmark's action. Goes
   *  through the plugin meta so undo, collab mirroring, and every
   *  serialization path see it like any other comment mutation. */
  private toggleResolved(threadId: string, resolved: boolean): void {
    const view = this.getView();
    if (!view) return;
    view.dispatch(view.state.tr.setMeta(commentsKey, setResolvedMeta(threadId, resolved)));
  }

  private submitReply(threadId: string, text: string): void {
    const view = this.getView();
    if (!view) return;
    const comment: Comment = {
      id: newCommentId(),
      author: settings.get('commentAuthor'),
      // Store only the user's explicit setting — derivation happens
      // at render time so the badge can fall back to a silhouette
      // when there's no good initials to compute.
      initials: settings.get('commentAuthorInitials').trim(),
      date: new Date().toISOString(),
      text,
      kind: 'human',
      parentId: threadId,
    };
    this.suppressBlurReset = true;
    this.activeReplyThreadId = null;
    this.activeReplyText = '';
    view.dispatch(view.state.tr.setMeta(commentsKey, addReplyMeta(threadId, comment)));
    this.suppressBlurReset = false;
    view.focus();
    this.maybeInvokeAiForComment(threadId, text);
  }

  /** AI re-invocation rules for a comment thread, run on any new message
   *  (the root's first text AND replies):
   *   - if the thread already contains an AI comment, every human turn
   *     re-invokes the model with the full thread as history;
   *   - otherwise only an explicit `@AI` mention re-invokes (turning a
   *     plain thread into an AI one).
   *  Reads thread state AFTER the message landed, so the new text is
   *  included in the history. */
  private maybeInvokeAiForComment(threadId: string, text: string): void {
    if (!settings.get('aiFeaturesEnabled')) return;
    const view = this.getView();
    if (!view) return;
    const thread = getCommentsState(view.state).threads.get(threadId);
    if (!thread) return;
    const hasAiHistory = thread.comments.some((c) => isAiComment(c));
    if (hasAiHistory || hasAiMention(text)) this.invokeAi(threadId);
  }

  /** Same rules for a note thread (uses the `ai` turn flag and the local
   *  AI invoke). */
  private maybeInvokeAiForNote(noteId: string, text: string): void {
    if (!settings.get('aiFeaturesEnabled')) return;
    const note = learnStore.getNote(noteId);
    if (!note) return;
    const hasAiHistory = note.comments.some((c) => c.ai);
    if (hasAiHistory || hasAiMention(text)) this.invokeAiLocal('note', noteId);
  }

  /** Run the AI explainer against `threadId`. Builds the message
   *  list from the thread's full comment history (human turns →
   *  `user`, AI turns → `assistant`), with the first user message
   *  wrapped in the context-rich explainer prompt. The context is
   *  cached at thread creation; if none is cached (e.g. an `@AI`
   *  mention in a regular `+` thread, or a follow-up much later),
   *  we rebuild from the thread's current comment_range position. */
  private invokeAi(threadId: string): void {
    const view = this.getView();
    if (!view) return;
    if (!aiGateToast()) return;
    const apiKey = activeApiKey();
    const thread = getCommentsState(view.state).threads.get(threadId);
    if (!thread) return;

    let ctx = this.aiContextByThread.get(threadId) ?? null;
    if (!ctx) ctx = this.contextFromCurrentRange(threadId);
    if (!ctx) {
      showToast('Could not build context for AI request.');
      return;
    }
    const promptCtx = ctx;
    // Re-cache so subsequent multi-turn requests can reuse it
    // without rebuilding (and so we know what context the AI saw
    // originally even if the doc has shifted).
    this.aiContextByThread.set(threadId, promptCtx);

    // Build the multi-turn message list. First user turn carries
    // the formatted prompt with the surrounding context; later
    // turns are plain. Skip empty bodies defensively (e.g. an
    // empty-root thread that was opened then closed).
    const messages = thread.comments.flatMap((c, i): LlmMessage[] => {
      if (!c.text.trim()) return [];
      if (isAiComment(c)) {
        return [{ role: 'assistant', content: c.text }];
      }
      const isFirstUserTurn = !thread.comments.slice(0, i).some((p) => !isAiComment(p) && p.text.trim());
      const content = isFirstUserTurn ? formatExplainFirstTurn(c.text, promptCtx) : c.text;
      return [{ role: 'user', content }];
    });
    if (messages.length === 0) return;

    // Identity for the AI comment: the persona name (or `'AI'` when Clod
    // is off) plus fixed `'AI'` initials. The initials survive docx
    // round-trip (comments.xml `w:initials`) and are what `isAiComment`
    // keys off to re-apply purple styling on re-import — so the author
    // name stays clean (no `(AI)` suffix). `kind` is written `'human'`
    // (Word strips an unknown `kind` anyway).
    const aiAuthor = aiPersonaName();
    const aiInitials = 'AI';
    // Pin the reply's TARGET at initiation: the view the thread lives in,
    // and the comment id (whose random-vs-sequential mode follows the
    // ACTIVE doc's session). Resolving either at completion time landed the
    // reply — with a wrong-mode id — in whichever pane the user had focused
    // by the time the AI answered (audit find, 2026-07-10).
    const targetView = this.getView();
    const replyId = newCommentId();

    this.aiInFlight.add(threadId);
    // Force the AI thread to be the active (expanded) one for the
    // duration of the request. Without this, the textarea-blur
    // path on submit could shuffle active state and the user
    // would lose sight of the Thinking… placeholder and the
    // arriving AI reply.
    this.activeThreadId = threadId;
    this.activeBy = 'click';
    this.refreshStickyDismissListener();
    this.render();
    this.startActivityTicker();

    void (async () => {
      try {
        const reply = await callLlm({
          apiKey,
          system: EXPLAIN_SYSTEM_PROMPT,
          messages,
        });
        const aiComment: Comment = {
          id: replyId,
          author: aiAuthor,
          initials: aiInitials,
          date: new Date().toISOString(),
          text: reply.text.trim(),
          // Always `'human'` on new comments — AI-ness is encoded in
          // `author` + `initials` so it survives docx round-trip.
          kind: 'human',
          parentId: threadId,
        };
        const v2 = targetView && !targetView.isDestroyed ? targetView : null;
        if (!v2) return;
        // The thread may have been deleted (locally or by a partner) while
        // the request was in flight — don't reply into nothing.
        if (!getCommentsState(v2.state).threads.has(threadId)) return;
        v2.dispatch(v2.state.tr.setMeta(commentsKey, addReplyMeta(threadId, aiComment)));
      } catch (e) {
        if (e instanceof LlmError) {
          aiFailureNotice('AI', e);
        } else {
          aiFailureNotice('AI', e);
        }
      } finally {
        this.aiInFlight.delete(threadId);
        // Keep aiContextByThread so future follow-ups (multi-turn)
        // reuse the original surrounding context.
        if (this.aiInFlight.size === 0) this.stopActivityTicker();
        this.render();
      }
    })();
  }

  /** Rebuild an `ExplainContext` from the thread's CURRENT range
   *  in the doc. Used when an AI invocation happens on a thread
   *  whose original context wasn't cached (e.g. an `@AI` mention
   *  in a user-created thread). Returns null when the mark is no
   *  longer in the doc. */
  private contextFromCurrentRange(threadId: string): ReturnType<typeof buildExplainContext> {
    const view = this.getView();
    if (!view) return null;
    const ranges = collectRanges(view.state.doc);
    const range = ranges.get(threadId);
    if (!range) return null;
    const TextSelection = (view.state.selection.constructor as unknown) as {
      create: (doc: PMNode, from: number, to: number) => never;
    };
    const synth = view.state.apply(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, range.from, range.to)),
    );
    return buildExplainContext(synth);
  }

  private deleteThread(threadId: string): void {
    const view = this.getView();
    if (!view) return;
    // Strip the comment_range mark from the doc, then drop the
    // thread from plugin state. (The plugin's GC would also clean
    // it up, but doing both in one transaction keeps the undo
    // history coherent.)
    const tr = view.state.tr;
    const commentType = schema.marks['comment_range'];
    if (commentType) {
      view.state.doc.descendants((node, pos) => {
        if (!node.isText && node.type.name !== 'image') return;
        for (const mark of node.marks) {
          if (mark.type.name === 'comment_range' && mark.attrs['threadId'] === threadId) {
            tr.removeMark(pos, pos + node.nodeSize, commentType);
            return;
          }
        }
      });
    }
    tr.setMeta(commentsKey, deleteThreadMeta(threadId));
    view.dispatch(tr);
  }

  private deleteComment(threadId: string, commentId: string): void {
    const view = this.getView();
    if (!view) return;
    view.dispatch(view.state.tr.setMeta(commentsKey, deleteCommentMeta(threadId, commentId)));
  }

  private scrollToRange(range: { from: number; to: number }): void {
    const view = this.getView();
    if (!view) return;
    // Move the editor cursor to the start of the range (drives the
    // cursor → active-thread tracking in `editor/index.ts`).
    const TextSelection = (view.state.selection.constructor as unknown) as {
      create: (doc: PMNode, from: number, to?: number) => never;
    };
    try {
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, range.from)));
    } catch {
      // Cursor placement may fail if the position isn't inside an
      // inline-content block — skip the caret move, still scroll below.
    }
    // Jump the EDITOR to the anchored text — same mechanism as the nav
    // pane's reliable "jump to heading" (`preciseScrollIntoView`): an
    // instant scroll that re-measures + converges, so it doesn't
    // undershoot when content-visibility:auto cards realize their real
    // height mid-scroll (the cause of the "smooth but inaccurate" drift).
    try {
      const at = view.domAtPos(range.from);
      let node: Node | null = at.node ?? null;
      while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
      if (node instanceof HTMLElement) preciseScrollIntoView(view, node, 'center');
    } catch {
      // Position detached / not yet laid out — ignore.
    }
  }

  /** Focus a thread's reply input so the user can start typing
   *  immediately (e.g. right after "add comment" creates a thread). */
  focusReplyForThread(threadId: string): void {
    this.activeReplyThreadId = threadId;
    this.activeReplyText = '';
    // Defer to next frame so the DOM has been re-rendered.
    requestAnimationFrame(() => {
      const card = this.root.querySelector(
        `[data-thread-id="${cssEscape(threadId)}"]`,
      );
      if (!card) return;
      const ta = card.querySelector<HTMLTextAreaElement>('textarea.pmd-comment-reply-input');
      if (ta) ta.focus();
    });
  }
}

// ----------------------- helpers --------------------------------

function collectRanges(doc: PMNode): Map<string, { from: number; to: number }> {
  // Lowest position wins (= first occurrence in doc order). Multiple
  // segments of the same thread get merged into a single range
  // spanning their min/max positions, so a multi-paragraph comment
  // still scroll-anchors to its first segment.
  const out = new Map<string, { from: number; to: number }>();
  doc.descendants((node, pos) => {
    // Images (inline atoms) carry the mark on the node; text on its chars.
    if (!node.isText && node.type.name !== 'image') return;
    for (const mark of node.marks) {
      if (mark.type.name !== 'comment_range') continue;
      const id = String(mark.attrs['threadId'] ?? '');
      if (!id) continue;
      const r = out.get(id);
      if (r) {
        r.from = Math.min(r.from, pos);
        r.to = Math.max(r.to, pos + node.nodeSize);
      } else {
        out.set(id, { from: pos, to: pos + node.nodeSize });
      }
    }
  });
  return out;
}

/** Decide what to render in the avatar circle. Returns a short
 *  initials string when we have something better than slicing two
 *  letters off a single-word name (which produces "Yo" for "You"
 *  and similarly silly results). Returns null when the caller
 *  should render a generic silhouette icon instead. */
function badgeText(authorName: string, explicitInitials: string): string | null {
  const explicit = explicitInitials.trim();
  if (explicit) return explicit.slice(0, 3).toUpperCase();
  const parts = authorName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
  }
  // Single-word or empty author name — no good initials to derive.
  return null;
}

/** Build a small head-and-shoulders silhouette SVG. Sized to fit
 *  inside the 1.4rem badge circle without specific width/height —
 *  inherits via 100%/100% so the badge's existing dimensions
 *  apply. */
function buildSilhouetteSvg(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('width', '60%');
  svg.setAttribute('height', '60%');
  svg.setAttribute('aria-hidden', 'true');
  const head = document.createElementNS(ns, 'circle');
  head.setAttribute('cx', '12');
  head.setAttribute('cy', '8');
  head.setAttribute('r', '4');
  const body = document.createElementNS(ns, 'path');
  body.setAttribute('d', 'M4 22c0-4.4 3.6-8 8-8s8 3.6 8 8H4z');
  svg.appendChild(head);
  svg.appendChild(body);
  return svg;
}

/** Populate a badge element with either initials text or a silhouette
 *  icon. Always clears `el` first so re-renders don't accumulate
 *  stale children. */
function fillBadge(el: HTMLElement, authorName: string, storedInitials: string): void {
  el.replaceChildren();
  const text = badgeText(authorName, storedInitials);
  if (text) {
    el.textContent = text;
  } else {
    el.appendChild(buildSilhouetteSvg());
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Short local-time format — matches Word's compact comment date.
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function cssEscape(s: string): string {
  // Minimal CSS escape: escapes every non-[a-zA-Z0-9_-] char — enough
  // for numeric thread ids and `fc:`/`ai:`/`note:` synthetic ids.
  return s.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

// ----------------------- commands --------------------------------

/** Apply a comment_range mark to the current selection and add the
 *  thread to plugin state. Returns the new thread's id (so the
 *  caller can scroll the side column to the new card). No-op when
 *  the selection is empty or already entirely commented. */
export function addCommentToSelection(view: EditorView): string | null {
  const { state } = view;
  const sel = state.selection;
  if (sel.empty) return null;
  const commentType = schema.marks['comment_range'];
  if (!commentType) return null;

  const threadId = newCommentId();
  const commentId = threadId; // root comment id == thread id
  const root: Comment = {
    id: commentId,
    author: settings.get('commentAuthor'),
    initials: settings.get('commentAuthorInitials').trim(),
    date: new Date().toISOString(),
    text: '',
    kind: 'human',
    parentId: null,
  };
  const thread: Thread = { id: threadId, comments: [root] };

  const tr = state.tr;
  tr.addMark(sel.from, sel.to, commentType.create({ threadId }));
  tr.setMeta(commentsKey, addThreadMeta(thread));
  view.dispatch(tr);
  return threadId;
}
