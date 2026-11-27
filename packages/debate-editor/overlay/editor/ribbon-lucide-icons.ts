/**
 * Lucide replacements for the toolbar's icons.
 *
 * The engine draws every ribbon icon as `.pmd-icon` — a `currentColor` box
 * masked by the `--pmd-icon` data-URI (`icons.css`). Rather than touch the
 * engine's markup (it re-skins buttons by swapping `pmd-icon-*` classes), the
 * Lucide glyphs are rendered once to static SVG and installed as
 * `--pmd-icon` overrides scoped under `#ribbon`, so they inherit colour,
 * hover, pressed and disabled states exactly like the old icons did, and the
 * "classic" emoji fallback in `icons.css` keeps working.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ArrowDownToLine,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardType,
  FilePlus2,
  Flag,
  FolderOpen,
  Highlighter,
  Keyboard,
  Layers,
  List,
  ListChecks,
  ListRestart,
  MessageSquare,
  Mic,
  Minus,
  PaintBucket,
  Pilcrow,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  Sparkles,
  StickyNote,
  Tag,
  Timer,
  Undo2,
  CornerDownRight,
  type LucideIcon,
} from 'lucide-react';

/** `pmd-icon-<key>` class → Lucide glyph. Keys not listed keep the engine icon. */
export const RIBBON_LUCIDE_ICONS: Record<string, LucideIcon> = {
  undo: Undo2,
  redo: Redo2,
  open: FolderOpen,
  new: FilePlus2,
  save: Save,
  autosave: RefreshCw,
  mic: Mic,
  'speech-mark': Flag,
  'send-cursor': CornerDownRight,
  'send-end': ArrowDownToLine,
  search: Search,
  tag: Tag,
  manage: ListChecks,
  add: Plus,
  highlight: Highlighter,
  shading: PaintBucket,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'chevron-right': ChevronRight,
  'paragraph-integrity': Pilcrow,
  'read-mode': BookOpen,
  book: BookOpen,
  comments: MessageSquare,
  note: StickyNote,
  flashcard: Layers,
  ai: Sparkles,
  list: List,
  reset: RotateCcw,
  restart: ListRestart,
  'paste-text': ClipboardType,
  settings: Settings,
  shortcuts: Keyboard,
  timer: Timer,
  plus: Plus,
  minus: Minus,
};

const STYLE_ID = 'dec-ribbon-lucide-icons';

function toMaskUrl(Icon: LucideIcon): string {
  const svg = renderToStaticMarkup(
    createElement(Icon, { size: 24, strokeWidth: 2, color: '#000', absoluteStrokeWidth: false }),
  );
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** The `<style>` text: one scoped `--pmd-icon` override per mapped icon, plus
 *  classic-mode glyphs for the two icons that used to be bare text (↻ and T). */
export function buildRibbonLucideCss(): string {
  const rules = Object.entries(RIBBON_LUCIDE_ICONS).map(
    ([name, Icon]) => `#ribbon .pmd-icon-${name} { --pmd-icon: ${toMaskUrl(Icon)}; }`,
  );
  rules.push(
    ':root[data-icons="classic"] #ribbon .pmd-icon-restart::before { content: "\\21BB"; }',
    ':root[data-icons="classic"] #ribbon .pmd-icon-paste-text::before { content: "T"; font-weight: 700; }',
  );
  return rules.join('\n');
}

/** Idempotent; safe to call before or after the engine boots. */
export function installRibbonLucideIcons(doc: Document = document): HTMLStyleElement {
  const existing = doc.getElementById(STYLE_ID);
  if (existing instanceof HTMLStyleElement) return existing;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = buildRibbonLucideCss();
  doc.head.appendChild(style);
  return style;
}
