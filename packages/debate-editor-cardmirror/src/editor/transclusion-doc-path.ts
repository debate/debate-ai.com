/**
 * Per-EditorView doc-path registry.
 *
 * A transclusion refresh needs the transcluding document's own on-disk path to
 * resolve its doc-relative `source_ref`. Each editor surface (single-doc and
 * every multi-pane slot) registers its view's current file path here whenever a
 * document is opened or saved into it; the refresh path reads it back. Keyed by
 * a WeakMap so closed views are collected automatically. Null path (a
 * never-saved doc) means "can't refresh yet — render from cache."
 */
import type { EditorView } from 'prosemirror-view';

const viewDocPaths = new WeakMap<EditorView, string | null>();

export function setViewDocPath(view: EditorView, docPath: string | null): void {
  viewDocPaths.set(view, docPath);
}

export function getViewDocPath(view: EditorView): string | null {
  return viewDocPaths.get(view) ?? null;
}
