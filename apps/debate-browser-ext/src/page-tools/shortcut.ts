/**
 * The search shortcut: the backtick / tilde key, the one under Escape.
 *
 * Matched by `event.code` (`Backquote`), the physical key, so it is the same
 * key on layouts where it types something else, and with or without Shift.
 * It only fires with text selected, and never while the reader is typing in a
 * field, where the key has to keep typing a backtick.
 */

/** The bits of a `KeyboardEvent` the check reads, so it tests without a DOM event. */
export interface ShortcutKeyEvent {
  code: string;
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
  isComposing?: boolean;
}

/** Whether `event` is the search key on its own (Shift allowed, for tilde). */
export function isSearchShortcut(event: ShortcutKeyEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.isComposing) {
    return false;
  }
  return event.code === 'Backquote' || event.key === '`' || event.key === '~';
}

/** Whether `target` is somewhere the reader types: an input, a textarea, an editor. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || typeof element.closest !== 'function') return false;
  if (element.isContentEditable) return true;
  return Boolean(element.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
}
