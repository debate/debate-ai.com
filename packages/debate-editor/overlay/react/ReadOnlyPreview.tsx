"use client";

/**
 * Passive rendering of a CardMirror document — used for the non-live side
 * of a split view (see CardMirrorEditor.tsx / the `live` prop). Not a
 * ProseMirror EditorView: CardMirror's engine is a page singleton (see
 * singleton.ts), so only one side can be a live editable instance at a
 * time. This renders the SAME HTML the live side would produce (CardMirror's
 * own `toDOM` markup, via the html-bridge), read-only, styled with the
 * engine's own stylesheet so pocket/hat/cite/etc. still look right.
 */

export interface ReadOnlyPreviewProps {
  content?: string;
  title?: string;
  className?: string;
  /** Fires on click/focus — the host uses this to promote the pane to
   *  live (see the `live` prop / FlowMainContent's active-pane state). */
  onActivate?: () => void;
}

export function ReadOnlyPreview({
  content = "",
  title,
  className,
  onActivate,
}: ReadOnlyPreviewProps): React.JSX.Element {
  return (
    <div
      className={"dec-cardmirror-readonly h-full w-full overflow-auto cursor-text" + (className ? ` ${className}` : "")}
      role="button"
      tabIndex={0}
      aria-label={title ? `Activate editor for ${title}` : "Activate editor"}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onActivate?.();
      }}
    >
      <div className="pmd-editor-content-readonly" dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}
