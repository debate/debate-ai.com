/**
 * Host-plugin seam: ProseMirror plugins an EMBEDDING host (the React
 * shell's `singleton.ts`) wants on every view, surviving every plugin
 * rebuild.
 *
 * Why: the engine rebuilds a view's whole plugin stack from
 * `buildEditorPlugins` on several paths — a collab session starting or
 * ending (`refreshPlugins`), settings that change keymaps, and every
 * `mountView` (a joined session doc, a new doc). A plugin the host had
 * appended with `state.reconfigure` is silently dropped by the next
 * rebuild, and the host's install-once guard then never puts it back —
 * so a React embed stopped receiving `onChange` the moment a co-editing
 * session started (the exact moment the doc changes most). Plugins
 * registered here are appended by `buildEditorPlugins` itself instead.
 *
 * Zero imports beyond the Plugin type: consulted on the always-loaded
 * editor path.
 */

import type { Plugin } from 'prosemirror-state';

let provider: (() => Plugin[]) | null = null;

/** Register (or clear, with null) the host's plugin provider. */
export function setHostPluginsProvider(fn: (() => Plugin[]) | null): void {
  provider = fn;
}

/** The host's plugins for a fresh stack — `[]` when no host registered any. */
export function hostPlugins(): Plugin[] {
  return provider?.() ?? [];
}
