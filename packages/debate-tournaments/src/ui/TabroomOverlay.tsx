"use client";

/**
 * An overlay holding Tabroom itself, for the parts of tournament setup this
 * app has not rebuilt yet — the full tabroom administration console, at
 * `beta.tabroom.com`, framed over the page rather than navigated away from it.
 *
 * The frame is only mounted once the overlay is open, so the console's own
 * bundle is not fetched by the tournaments list.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { ExternalLink, X } from "lucide-react";
import { buttonVariants } from "./primitives";

/** Tabroom's beta console, framed in the overlay. */
export const TABROOM_BETA_URL = "https://beta.tabroom.com";

export interface TabroomOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Where the frame starts; the whole console by default. */
  url?: string;
  /** The heading, and the dialog's accessible name. */
  title?: string;
  /** A caption under the heading. */
  description?: string;
  children?: ReactNode;
}

export function TabroomOverlay({
  open,
  onClose,
  url = TABROOM_BETA_URL,
  title = "Tabroom",
  description = "Tabroom's own console, framed here so you stay on this page.",
  children,
}: TabroomOverlayProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape closes, and the overlay hands focus back where it came from.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <button type="button" aria-hidden tabIndex={-1} className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative flex h-[min(90vh,56rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border bg-card shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{title}</h2>
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Open in a new tab
              <ExternalLink aria-hidden />
            </a>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close Tabroom overlay"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background transition-colors hover:bg-accent"
            >
              <X aria-hidden />
            </button>
          </div>
        </div>
        {children}
        <iframe
          src={url}
          title={title}
          loading="lazy"
          referrerPolicy="origin"
          className="min-h-0 flex-1 border-0 bg-background"
        />
      </div>
    </div>
  );
}
