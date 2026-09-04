"use client";

import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { Compartment, EditorState } from "@codemirror/state";
import { drawSelection, EditorView, keymap } from "@codemirror/view";
import { githubDark } from "@fsegurai/codemirror-theme-github-dark";
import { githubLight } from "@fsegurai/codemirror-theme-github-light";
import { X } from "@phosphor-icons/react";
import { vim } from "@replit/codemirror-vim";
import { useEffect, useMemo, useRef, useState } from "react";

import { Tip } from "../ui/tooltip";
import { focusActiveHot } from "../../lib/grid/hotInstance";
import { makeCellCompletionSource } from "../../lib/rfd/cellCompletion";
import { renderRfdHtml } from "../../lib/rfd/markdown";
import { authoredPeerNotes } from "../../lib/rfd/peerNotes";
import { useFlowStore } from "../../lib/store/useFlowStore";
import { ebbThemeScopeEl } from "../../lib/theme/themeScope";

/**
 * Structural tweaks over the GitHub theme, which owns the editor and the
 * completion popup. Strips the popup's border and chrome to a bare list (it is
 * a tool, not a card), marks each option with a side-colored dot in the icon
 * slot, and inks the whole option aff blue / neg red to match the grid.
 * Applied after the theme so these selectors win.
 */
const rfdTheme = EditorView.theme({
    "&": { height: "100%", fontSize: "14px" },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": { overflow: "auto", fontFamily: "inherit", lineHeight: "1.5" },
    ".cm-content": { padding: "10px 14px" },
    ".cm-tooltip.cm-tooltip-autocomplete": {
        border: "none",
        borderRadius: "0",
        backgroundColor: "var(--popover)",
        boxShadow: "none",
        padding: "0",
    },
    ".cm-tooltip-autocomplete > ul": {
        border: "none",
        fontFamily: "inherit",
        fontSize: "13px",
        maxHeight: "16em",
    },
    ".cm-tooltip-autocomplete > ul > li": {
        padding: "2px 8px",
        color: "var(--popover-foreground)",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
        backgroundColor: "var(--accent)",
    },
    // CodeMirror underlines the matched substring; make it clearly the query.
    ".cm-completionMatchedText": { textDecoration: "underline", fontWeight: "600" },
    // The icon slot holds a bare side-colored dot instead of a code-symbol glyph.
    ".cm-completionIcon": { paddingRight: "8px", opacity: "1" },
    ".cm-completionIcon-aff::after, .cm-completionIcon-neg::after": {
        content: '""',
        display: "inline-block",
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        verticalAlign: "middle",
    },
    ".cm-completionIcon-aff::after": { backgroundColor: "var(--aff)" },
    ".cm-completionIcon-neg::after": { backgroundColor: "var(--neg)" },
    // Scoped to the row so the side ink outweighs the default option color above.
    ".cm-tooltip-autocomplete > ul > li.cm-rfd-aff": { color: "var(--aff)" },
    ".cm-tooltip-autocomplete > ul > li.cm-rfd-neg": { color: "var(--neg)" },
});

/**
 * Tracks the resolved appearance off the `.dark` class on <html>, the single
 * source of truth useThemeSync maintains, so it covers both the manual setting
 * and live OS changes under "system".
 */
function useIsDark(): boolean {
    const [dark, setDark] = useState(() => ebbThemeScopeEl().classList.contains("dark"));
    useEffect(() => {
        const el = ebbThemeScopeEl();
        const obs = new MutationObserver(() => setDark(el.classList.contains("dark")));
        obs.observe(el, { attributes: true, attributeFilter: ["class"] });
        return () => obs.disconnect();
    }, []);
    return dark;
}

export default function RfdDrawer() {
    const setRfdOpen = useFlowStore((s) => s.setRfdOpen);
    const hostRef = useRef<HTMLDivElement>(null);
    // Default to roughly a third of the viewport; dragging the handle resizes.
    const [height, setHeight] = useState(() => Math.round(window.innerHeight * 0.3));
    // Transient per-mount; the drawer always opens in edit mode.
    const [mode, setMode] = useState<"edit" | "preview">("edit");

    const isDark = useIsDark();
    const rfdVim = useFlowStore((s) => s.rfdVim);
    const viewRef = useRef<EditorView | null>(null);
    // Swaps the GitHub light/dark theme in place without rebuilding the editor.
    const themeComp = useRef(new Compartment());
    // Swaps vim keybindings on/off in place without rebuilding the editor.
    const vimComp = useRef(new Compartment());

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;

        const source = makeCellCompletionSource(() => useFlowStore.getState().round);
        const view = new EditorView({
            parent: host,
            state: EditorState.create({
                doc: useFlowStore.getState().round?.scouting.decision?.rfd ?? "",
                extensions: [
                    // Vim's keymap must precede the default keymaps so it wins;
                    // read at mount from the store to avoid a stale closure.
                    vimComp.current.of(useFlowStore.getState().rfdVim ? vim({ status: true }) : []),
                    history(),
                    drawSelection(),
                    EditorView.lineWrapping,
                    markdown(),
                    themeComp.current.of(
                        ebbThemeScopeEl().classList.contains("dark") ? githubDark : githubLight,
                    ),
                    autocompletion({
                        override: [source],
                        activateOnTyping: true,
                        // The icon slot renders the side dot; optionClass inks the row.
                        icons: true,
                        optionClass: (c) => (c.type ? `cm-rfd-${c.type}` : ""),
                    }),
                    keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap]),
                    rfdTheme,
                    EditorView.updateListener.of((u) => {
                        if (!u.docChanged) return;
                        const { round, setScouting } = useFlowStore.getState();
                        if (!round) return;
                        setScouting({
                            decision: { ...round.scouting.decision, rfd: u.state.doc.toString() },
                        });
                    }),
                ],
            }),
        });
        viewRef.current = view;
        // Defer focus past the current keydown (the Meta+j that opened the
        // drawer) so the grid's focus handling cannot reclaim it.
        const focusRaf = requestAnimationFrame(() => view.focus());
        return () => {
            cancelAnimationFrame(focusRaf);
            view.destroy();
            viewRef.current = null;
            // Closing hands keyboard focus back to the grid so the next
            // keystroke edits the flow instead of falling on <body>.
            focusActiveHot();
        };
    }, []);

    useEffect(() => {
        viewRef.current?.dispatch({
            effects: themeComp.current.reconfigure(isDark ? githubDark : githubLight),
        });
    }, [isDark]);

    useEffect(() => {
        viewRef.current?.dispatch({
            effects: vimComp.current.reconfigure(rfdVim ? vim({ status: true }) : []),
        });
    }, [rfdVim]);

    function startResize(e: React.PointerEvent) {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = height;
        const max = window.innerHeight * 0.8;
        function onMove(ev: PointerEvent) {
            // Dragging up (smaller clientY) grows the drawer.
            setHeight(Math.max(120, Math.min(max, startHeight + (startY - ev.clientY))));
        }
        function onUp() {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        }
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    }

    // The editor's updateListener keeps this current on every keystroke, so
    // preview reads straight from the store.
    const rfd = useFlowStore((s) => s.round?.scouting.decision?.rfd ?? "");
    const previewHtml = mode === "preview" ? renderRfdHtml(rfd) : "";

    // Peer notes belong to the wire, which writes them, and to the preview,
    // which only reads them. Rendering runs per author so no peer's markdown
    // can reach past its own section.
    const peerNotes = useFlowStore((s) => s.round?.scouting.decision?.peerNotes);
    const contacts = useFlowStore((s) => s.contacts);
    const peerSections = useMemo(
        () =>
            mode === "preview"
                ? authoredPeerNotes({ peerNotes }, contacts).map((note) => ({
                      ...note,
                      html: renderRfdHtml(note.text),
                  }))
                : [],
        [mode, peerNotes, contacts],
    );

    return (
        <section
            data-testid="rfd-drawer"
            aria-label="RFD"
            className="no-print border-border bg-card flex flex-none flex-col border-t"
            style={{ height }}
        >
            <div
                role="separator"
                aria-label="Resize RFD drawer"
                onPointerDown={startResize}
                className="hover:bg-accent h-1 flex-none cursor-row-resize"
            />
            <div className="border-border flex items-center justify-between border-b px-3.5 py-2">
                <span className="text-foreground text-[13px] font-semibold tracking-wide">RFD</span>
                <div className="flex items-center gap-2">
                    <div
                        role="tablist"
                        aria-label="RFD view"
                        className="border-border flex overflow-hidden rounded-md border text-[12px]"
                    >
                        <button
                            type="button"
                            role="tab"
                            aria-selected={mode === "edit"}
                            onClick={() => setMode("edit")}
                            className={
                                mode === "edit"
                                    ? "bg-accent text-accent-foreground px-2 py-0.5"
                                    : "text-muted-foreground hover:bg-accent/50 px-2 py-0.5"
                            }
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={mode === "preview"}
                            data-testid="rfd-preview-toggle"
                            onClick={() => setMode("preview")}
                            className={
                                mode === "preview"
                                    ? "bg-accent text-accent-foreground px-2 py-0.5"
                                    : "text-muted-foreground hover:bg-accent/50 px-2 py-0.5"
                            }
                        >
                            Preview
                        </button>
                    </div>
                    <Tip label="Close">
                        <button
                            type="button"
                            aria-label="Close RFD"
                            data-testid="rfd-close"
                            onClick={() => setRfdOpen(false)}
                            className="text-muted-foreground hover:text-foreground rounded transition-colors focus-visible:outline-2"
                        >
                            <X className="size-4" />
                        </button>
                    </Tip>
                </div>
            </div>
            <div
                ref={hostRef}
                className="min-h-0 flex-1 overflow-hidden"
                style={{ display: mode === "preview" ? "none" : undefined }}
            />
            {mode === "preview" && (
                <div
                    data-testid="rfd-preview"
                    className="text-foreground [&_blockquote]:border-border [&_blockquote]:text-muted-foreground min-h-0 flex-1 overflow-auto px-3.5 py-2.5 text-[14px] leading-relaxed [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_h1]:mt-2 [&_h1]:mb-1 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:my-1.5"
                >
                    <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    {peerSections.length > 0 && (
                        <div data-testid="rfd-peer-notes" className="mt-3">
                            {peerSections.map((note) => (
                                <section
                                    key={note.endpointId}
                                    data-testid="rfd-peer-note"
                                    className="border-border mt-3 border-t pt-3 first:mt-0"
                                >
                                    <h3 className="text-muted-foreground mb-1 text-[12px] font-semibold tracking-wide">
                                        {note.author}
                                    </h3>
                                    <div dangerouslySetInnerHTML={{ __html: note.html }} />
                                </section>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
