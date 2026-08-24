/**
 * Shared prosemirror-tables plugin instances.
 *
 * These MUST be module-level singletons, not per-call `columnResizing()`
 * factories: columnResizing registers its table nodeView (the one that
 * wraps tables in `.tableWrapper`, which all table CSS hangs off) by
 * MUTATING its own plugin spec inside `state.init`. A fresh instance
 * handed to `EditorState.reconfigure` never runs `init` — the plugin
 * key matches the old instance, so ProseMirror preserves the existing
 * state — leaving the fresh instance's `nodeViews` empty. The view then
 * rebuilds node views from the new plugins and re-renders every table
 * WITHOUT the wrapper: cell borders vanish and column resizing dies,
 * stably, until reload. The app reconfigures on every keybinding /
 * macro change, so per-call instances made tables lose their borders
 * the moment the user edited a shortcut.
 *
 * Sharing one instance across all editors (main, panes, quick cards)
 * is safe — plugins are stateless descriptors; per-state data lives in
 * the states themselves. `tests/editor/table-wrapper.test.ts` guards
 * both the upstream trap and this arrangement.
 */

import { columnResizing, tableEditing } from 'prosemirror-tables';
import type { Plugin } from 'prosemirror-state';

export const tableEditingPlugin: Plugin = tableEditing();
export const columnResizingPlugin: Plugin = columnResizing();
