/**
 * Shared "is focus in a text box?" check + global keyboard guards that depend
 * on it.
 *
 * `isEditableTarget` is true for an <input>, <textarea>, <select>, or any node
 * inside a contenteditable region (the ProseMirror editor, a settings field,
 * a dialog input, …). It's the test global key handlers use to tell "the user
 * is typing somewhere" from "focus is on the chrome / nothing."
 */

/** True when `target` is (or sits inside) a text-entry element. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  // `isContentEditable` is authoritative in a real browser; jsdom doesn't
  // implement it (returns undefined), so also accept an explicit
  // contenteditable attribute on the element or an ancestor.
  return (
    target.isContentEditable ||
    target.closest('[contenteditable=""], [contenteditable="true"]') !== null
  );
}

/**
 * Suppress the browser's default "select the whole page" on Mod+A when focus
 * isn't in a text box — e.g. you just alt-tabbed back to the window and haven't
 * clicked into the editor, so Mod+A would otherwise select the entire GUI.
 *
 * A no-op when focus IS in a text box: the editor's ProseMirror keymap and a
 * native input/textarea both still select their own contents. Only plain Mod+A
 * (no Shift/Alt) is considered; anything else passes through untouched.
 */
export function suppressGuiSelectAll(e: KeyboardEvent): void {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
  if (e.key !== 'a' && e.key !== 'A') return;
  if (isEditableTarget(e.target)) return;
  e.preventDefault();
}
