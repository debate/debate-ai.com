/**
 * ReasonCore — the editor-essentials TipTap extension.
 *
 * The CardMirror schema extensions (schema-extensions.ts) define *what*
 * the document can contain, but on their own give a static document. We
 * deliberately do NOT use TipTap's StarterKit: it would inject its own
 * `doc`/`paragraph`/`text`/`bold`/… nodes and marks that collide with
 * CardMirror's schema. Instead this single extension contributes the
 * baseline editing behavior every editor needs, via raw ProseMirror
 * plugins (re-exported through `@tiptap/pm/*`, so there's one shared
 * prosemirror instance with TipTap):
 *
 *   - history()      undo / redo
 *   - baseKeymap     Enter / Backspace / Delete / Mod-a / arrow handling
 *   - dropCursor     drop indicator for drag-and-drop
 *   - gapCursor      caret placement beside isolating nodes (cards/tables)
 *
 * TipTap's generic mark/node commands (`toggleMark`, `setNode`,
 * `toggleNode`, `isActive`) operate purely by type name, so the toolbar
 * drives the CardMirror marks/nodes without any per-type command code.
 */

import { Extension, callOrReturn, getExtensionField } from '@tiptap/core';
import type { AnyExtension } from '@tiptap/core';
import { baseKeymap } from '@tiptap/pm/commands';
import { dropCursor } from '@tiptap/pm/dropcursor';
import { gapCursor } from '@tiptap/pm/gapcursor';
import { history, redo, undo } from '@tiptap/pm/history';
import { keymap } from '@tiptap/pm/keymap';
import type { Plugin } from '@tiptap/pm/state';

export const ReasonCore = Extension.create({
  name: 'reasonCore',

  /**
   * Surface the prosemirror-tables `tableRole` field that the generated
   * table node extensions carry (schema-extensions.ts) into the built
   * ProseMirror schema. TipTap core calls every extension's
   * `extendNodeSchema(builtNode)` for each node it builds and merges the
   * result; reading the field off the *passed* node is the same
   * mechanism `@tiptap/extension-table` uses. Without this, TipTap core
   * drops the unknown `tableRole` config field and table-aware plugins
   * can't locate cells/rows.
   */
  extendNodeSchema(extension: AnyExtension) {
    const context = {
      name: extension.name,
      options: extension.options,
      storage: extension.storage,
    };
    const tableRole = callOrReturn(
      getExtensionField(extension, 'tableRole' as never, context),
    );
    return tableRole ? { tableRole } : {};
  },

  addProseMirrorPlugins(): Plugin[] {
    return [
      history(),
      keymap({
        'Mod-z': undo,
        'Mod-y': redo,
        'Shift-Mod-z': redo,
      }),
      keymap(baseKeymap),
      dropCursor({ class: 'pmd-dropcursor', width: 2 }),
      gapCursor(),
    ];
  },
});
