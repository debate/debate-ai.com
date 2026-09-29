/**
 * @fileoverview Loads `./stored-cmir` — and with it CardMirror's engine —
 * only when a stored file actually has to be converted.
 *
 * `ReasonDocsProvider` wraps every page of the app, but it only needs the
 * engine to open, save, import or download a `.cmir`. A static import put the
 * whole editor (ProseMirror, the OOXML reader, the gzip codec) into the app
 * shell's startup bundle; going through here keeps it in its own chunk.
 *
 * `./stored-cmir` registers itself on evaluation, so once any chunk that
 * imports it statically has run (the `/reason-editor` screen does, to mount
 * the editor), {@link storedCmirIfLoaded} answers synchronously — which the
 * two callers that cannot await (rendering a document for the editor, and
 * the `pagehide` flush) rely on.
 *
 * @module lib/cardmirror/lazy-stored-cmir
 */

import type * as StoredCmirModule from "./stored-cmir";

/** The conversions `ReasonDocsProvider` runs through CardMirror. */
export type StoredCmir = Pick<
  typeof StoredCmirModule,
  "storedContentToHtml" | "htmlToDocxBytes" | "htmlToStoredCmir" | "htmlToStoredCmirSync" | "fileToStoredCmir"
>;

let loaded: StoredCmir | null = null;
let loading: Promise<StoredCmir> | null = null;

/** Called by `./stored-cmir` as it evaluates. */
export function registerStoredCmir(module: StoredCmir): void {
  loaded = module;
}

/** The conversions, if the engine has already been loaded; otherwise `null`. */
export function storedCmirIfLoaded(): StoredCmir | null {
  return loaded;
}

/** Loads the engine (once) and resolves with the conversions. */
export function loadStoredCmir(): Promise<StoredCmir> {
  if (loaded) return Promise.resolve(loaded);
  loading ??= import("./stored-cmir").then((module) => {
    // Registration happens on evaluation; this covers a bundler that hands
    // back the namespace without having run the side effect first.
    loaded ??= module;
    return loaded;
  });
  return loading;
}
