/**
 * Icon helper. Returns a `<span class="pmd-icon pmd-icon-NAME">` that
 * the generated `icons.css` paints — Untitled UI line icons in
 * `currentColor` under `:root[data-icons="modern"]` (default), or an
 * emoji glyph under `:root[data-icons="classic"]`. The set is
 * switched at runtime by the `iconSet` setting (see `applyIconSet` in
 * index.ts); no element needs rebuilding.
 *
 * `IconName` must stay in sync with the MAP in `scripts/gen-icons.mjs`.
 */

export type IconName =
  | 'open'
  | 'new'
  | 'save'
  | 'autosave'
  | 'paragraph-integrity'
  | 'mic'
  | 'speech-mark'
  | 'send-cursor'
  | 'send-end'
  | 'search'
  | 'tag'
  | 'manage'
  | 'add'
  | 'highlight'
  | 'shading'
  | 'image'
  | 'settings'
  | 'home'
  | 'close'
  | 'plus'
  | 'reset'
  | 'undo'
  | 'redo'
  | 'arrow-up'
  | 'arrow-down'
  | 'chevron-up'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'expand'
  | 'minus'
  | 'read-mode'
  | 'nav-toggle'
  | 'comments'
  | 'shortcuts'
  | 'timer'
  | 'link'
  | 'link-broken'
  | 'flashcard'
  | 'note'
  | 'edit'
  | 'ai'
  // Curated general-purpose set for custom ribbon buttons.
  | 'star'
  | 'bookmark'
  | 'flag'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'list'
  | 'check'
  | 'heart'
  | 'trash'
  | 'copy'
  | 'download'
  | 'upload'
  | 'printer'
  | 'bell'
  | 'zap'
  | 'lightbulb'
  | 'scissors'
  // Second wave of the curated custom-button set (cap grew 6 → 10).
  | 'rocket'
  | 'target'
  | 'globe'
  | 'calendar'
  | 'mail'
  | 'camera'
  | 'music'
  | 'shield'
  | 'lock'
  | 'key'
  | 'sun'
  | 'moon'
  | 'smile'
  | 'thumbs-up'
  | 'trophy'
  | 'gift'
  | 'send'
  | 'puzzle'
  | 'palette'
  | 'megaphone'
  | 'filter'
  | 'tool'
  | 'pin'
  | 'book'
  | 'coins'
  | 'archive'
  | 'infinity'
  | 'anchor'
  | 'hash'
  | 'compass';

/** Curated set of icons offered when a user picks an icon for a custom
 *  ribbon button — a sensible general-purpose spread from the Untitled UI
 *  pack (the full set is far too many to browse). Order is the picker order. */
export const CUSTOM_BUTTON_ICONS: IconName[] = [
  'star',
  'bookmark',
  'flag',
  'check',
  'heart',
  'zap',
  'lightbulb',
  'bell',
  'bold',
  'italic',
  'underline',
  'list',
  'edit',
  'highlight',
  'tag',
  'link',
  'search',
  'copy',
  'scissors',
  'trash',
  'download',
  'upload',
  'printer',
  'timer',
  'rocket',
  'target',
  'globe',
  'compass',
  'calendar',
  'mail',
  'send',
  'camera',
  'music',
  'palette',
  'megaphone',
  'book',
  'pin',
  'shield',
  'lock',
  'key',
  'sun',
  'moon',
  'smile',
  'thumbs-up',
  'trophy',
  'gift',
  'puzzle',
  'filter',
  'tool',
  'coins',
  'archive',
  'infinity',
  'anchor',
  'hash',
];

/** Create an icon span. Decorative by default (`aria-hidden`); pass a
 *  `label` for standalone icon buttons whose accessible name should be
 *  the icon itself. */
export function icon(name: IconName, opts: { label?: string } = {}): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `pmd-icon pmd-icon-${name}`;
  if (opts.label) span.setAttribute('aria-label', opts.label);
  else span.setAttribute('aria-hidden', 'true');
  return span;
}

/** Replace an element's contents with an icon (clears text glyphs). */
export function setIcon(el: HTMLElement, name: IconName, opts?: { label?: string }): void {
  el.replaceChildren(icon(name, opts));
}
