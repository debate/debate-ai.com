'use client';
/**
 * @file header-toolbar.tsx
 * @description The docs page toolbar (Copy, Ask AI, the Synergy Slayer tools,
 * Info), shown in the docs header right after the search box.
 *
 * The buttons belong to the page (they need its Markdown URL, title, stats),
 * but the header belongs to the layout. So the layout's search slot,
 * `SearchWithToolbarSlot`, renders the search box followed by an empty
 * `#docs-header-toolbar`, and the page's `HeaderToolbar` portals its buttons
 * into it. On narrow screens (and wherever the slot is missing, e.g. the dev
 * docs) the toolbar stays in the page body instead, under the title.
 *
 * Each button sits in a `ToolbarItem`: a shadcn tooltip that names the button
 * and, when the button has a native `title`, shows that text instead (the
 * attribute is lifted off, so the browser's own tooltip doesn't show twice).
 * The large icon + tiny label look comes from `.docs-header-toolbar` in
 * `styles/docs.css`, so the buttons keep their own markup.
 */
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FullSearchTrigger } from 'fumadocs-ui/layouts/shared/slots/search-trigger';
import { cn } from '../../../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';

/** The element in the docs header the page toolbar is portaled into. */
export const HEADER_TOOLBAR_ID = 'docs-header-toolbar';
/** The toolbar moves into the header from this width up (Tailwind `lg`). */
export const HEADER_TOOLBAR_QUERY = '(min-width: 1024px)';

/** The layout's `searchTrigger.full` slot: the search box, then the toolbar's spot. */
export function SearchWithToolbarSlot(props: ComponentProps<typeof FullSearchTrigger>) {
  return (
    <>
      <FullSearchTrigger {...props} />
      <div id={HEADER_TOOLBAR_ID} className="flex shrink-0 items-center max-lg:hidden" />
    </>
  );
}

/** Where the toolbar renders: the header slot, the page body, or nowhere yet (before hydration). */
function useToolbarHost(): HTMLElement | 'inline' | null {
  const [host, setHost] = useState<HTMLElement | 'inline' | null>(null);
  useEffect(() => {
    const media = window.matchMedia(HEADER_TOOLBAR_QUERY);
    const update = () => {
      const slot = document.getElementById(HEADER_TOOLBAR_ID);
      setHost(media.matches && slot ? slot : 'inline');
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return host;
}

/** The page's toolbar: portaled into the header after search, or inline on small screens. */
export function HeaderToolbar({ children }: { children: ReactNode }) {
  const host = useToolbarHost();
  if (host === null) {
    // Hold the inline toolbar's height on small screens so the body doesn't jump.
    return <div aria-hidden className="h-14 border-b lg:hidden" />;
  }
  if (host === 'inline') {
    return (
      <div role="toolbar" aria-label="Page tools" className="docs-header-toolbar flex flex-row flex-wrap items-center gap-0.5 border-b pt-1 pb-2">
        {children}
      </div>
    );
  }
  return createPortal(
    <div role="toolbar" aria-label="Page tools" className="docs-header-toolbar flex flex-row items-center gap-0.5 ps-2">
      {children}
    </div>,
    host,
  );
}

/**
 * One toolbar button with a shadcn tooltip. `label` names it; a `title` on
 * the first button inside (often state-dependent, e.g. "Stop reading aloud")
 * replaces `tip` while it is set.
 */
export function ToolbarItem({ label, tip, className, children }: { label: string; tip?: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [lifted, setLifted] = useState<string | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const lift = () => {
      const button = root.querySelector('button');
      const title = button?.getAttribute('title');
      if (button && title) {
        setLifted(title);
        button.removeAttribute('title');
      }
    };
    lift();
    const observer = new MutationObserver(lift);
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });
    return () => observer.disconnect();
  }, []);

  const detail = lifted ?? tip;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span ref={ref} data-toolbar-item={label} className={cn('inline-flex', className)}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        <span className="block font-semibold">{label}</span>
        {detail && detail !== label && <span className="block text-slate-300">{detail}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
