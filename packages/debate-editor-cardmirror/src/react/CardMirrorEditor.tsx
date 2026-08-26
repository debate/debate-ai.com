"use client";

/**
 * CardMirrorEditor — the React shell around the CardMirror ProseMirror
 * engine (`../editor/index.js`), replacing the prior TipTap-based
 * ReasonEditor. Speaks the same `content`/`onChange`/`contentKey`/`title`
 * HTML contract the host app's call sites already use (see
 * `LexicalEditorHandle`/`ReasonEditorProps` in the reason-editor package
 * this drops into) so those call sites don't need their own props
 * reshaped — only the shim they import through needs to point here.
 *
 * CardMirror's engine is a page-level singleton (see singleton.ts) — it
 * cannot run two live instances at once. `live` (default true) controls
 * whether THIS instance claims the singleton and renders the real editor,
 * or renders `ReadOnlyPreview` instead. Hosts that show two docs side by
 * side (Flow's split mode) render exactly one with `live` and the other
 * with `live={false}`, swapping on click via `onActivate`.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { MenuBar, type AppLink } from "./MenuBar.js";
import { ReadOnlyPreview } from "./ReadOnlyPreview.js";
import * as singleton from "./singleton.js";
import "../editor/style.css";
import "../editor/icons.css";
import "../editor/embed-containment.css";

export type { AppLink } from "./MenuBar.js";

export interface LexicalEditorHandle {
  getHTML(): string;
  getJSON(): unknown;
  setHTML(html: string): void;
  focus(): void;
  importDocx(bytes: Uint8Array): Promise<void>;
  exportDocx(): Promise<Uint8Array | null>;
  importCmir(bytes: Uint8Array): Promise<void>;
  exportCmir(): Promise<Uint8Array | null>;
}

export interface ReasonEditorProps {
  content?: string;
  contentKey?: string;
  onChange?: (html: string) => void;
  title?: string;
  onTitleChange?: (title: string) => void;
  onShareClick?: () => void;
  editable?: boolean;
  showToolbar?: boolean;
  showCardTools?: boolean;
  showAiTools?: boolean;
  className?: string;
  autoFocus?: boolean;
  showOutline?: boolean;
  documentId?: string;
  /** Whether THIS instance should claim the page-singleton CardMirror
   *  engine and render live, vs. a read-only preview. Default true —
   *  every existing call site renders exactly one editor at a time, so
   *  this only needs setting explicitly by hosts showing two docs at
   *  once (Flow split mode). */
  live?: boolean;
  /** Read-only preview only: fires when the user clicks/focuses it,
   *  requesting to become the live pane. No-op while `live` is true. */
  onActivate?: () => void;
  /** Extra links into the surrounding host app rendered in the menu
   *  bar's "More Tools" dropdown (e.g. "Speech Documents", "Prep
   *  Notes") — CardMirror's own menu-bar categories only cover editor
   *  commands, so a host that wants the live editor to also surface
   *  related app tools passes them here instead of the user having to
   *  navigate away and back. Ignored when `showToolbar` is false. */
  appLinks?: AppLink[];
}

export const CardMirrorEditor = forwardRef<LexicalEditorHandle, ReasonEditorProps>(
  function CardMirrorEditor(
    {
      content = "",
      contentKey,
      onChange,
      title,
      live = true,
      onActivate,
      className,
      showToolbar = true,
      appLinks,
    },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement>(null);
    const key = contentKey ?? title ?? "default";
    const [claimed, setClaimed] = useState(false);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useEffect(() => {
      if (!live) return;
      let cancelled = false;
      setClaimed(false);
      void singleton
        .claim({ key, onChange: (html) => onChangeRef.current?.(html) }, content)
        .then(() => {
          if (cancelled) return;
          if (hostRef.current) singleton.attachTo(hostRef.current);
          setClaimed(true);
        });
      return () => {
        cancelled = true;
        singleton.release(key);
      };
      // Re-claim when the document identity changes; `content` is applied
      // by the same effect on that path (see singleton.claim's isNewKey
      // branch) so it's intentionally not a dep here — a same-key content
      // change is handled by the effect below instead.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [live, key]);

    // Same-identity external content updates (e.g. a realtime sync
    // overwriting `content` while this key is still the live doc).
    useEffect(() => {
      if (!live || !claimed) return;
      void singleton.claim({ key, onChange: (html) => onChangeRef.current?.(html) }, content);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [live, claimed, content]);

    useImperativeHandle(
      ref,
      (): LexicalEditorHandle => ({
        getHTML: () => {
          const bridge = singleton.getBridgeModule();
          const view = singleton.isLiveKey(key) ? singleton.getEngineModule()?.getActiveView() : null;
          return view && bridge ? bridge.docToHtml(view.state.doc) : content;
        },
        getJSON: () =>
          (singleton.isLiveKey(key) ? singleton.getEngineModule()?.getActiveView() : null)?.state.doc.toJSON() ??
          null,
        setHTML: (html: string) => {
          void singleton.claim({ key, onChange: (h) => onChangeRef.current?.(h) }, html);
        },
        focus: () => {
          singleton.getEngineModule()?.getActiveView()?.focus();
        },
        importDocx: async (bytes: Uint8Array) => {
          const engineApi = await import("../index.js");
          const doc = await engineApi.fromDocx(bytes);
          const bridge = await import("./html-bridge.js");
          await singleton.claim({ key, onChange: (h) => onChangeRef.current?.(h) }, bridge.docToHtml(doc));
        },
        exportDocx: async () => {
          const view = singleton.isLiveKey(key) ? singleton.getEngineModule()?.getActiveView() : null;
          if (!view) return null;
          const engineApi = await import("../index.js");
          return engineApi.toDocx(view.state.doc);
        },
        importCmir: async (bytes: Uint8Array) => {
          const engineApi = await import("../index.js");
          const { doc } = engineApi.parseNative(bytes);
          const bridge = await import("./html-bridge.js");
          await singleton.claim({ key, onChange: (h) => onChangeRef.current?.(h) }, bridge.docToHtml(doc));
        },
        exportCmir: async () => {
          const view = singleton.isLiveKey(key) ? singleton.getEngineModule()?.getActiveView() : null;
          if (!view) return null;
          const engineApi = await import("../index.js");
          return engineApi.serializeNative(view.state.doc);
        },
      }),
      [key, content],
    );

    if (!live) {
      return (
        <ReadOnlyPreview content={content} title={title} className={className} onActivate={onActivate} />
      );
    }

    return (
      <div className={"dec-cardmirror-embed flex h-full w-full flex-col overflow-hidden" + (className ? ` ${className}` : "")}>
        {showToolbar && <MenuBar appLinks={appLinks} />}
        <div ref={hostRef} className="dec-cardmirror-viewport relative min-h-0 flex-1 overflow-hidden" />
        {!claimed && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Loading editor…
          </div>
        )}
      </div>
    );
  },
);
