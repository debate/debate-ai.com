/**
 * @file page-navigation-menu.tsx
 * @description The docs header's Navigation button, right after Search.
 *
 * Hovering (or tabbing to) it opens a menu with one row per level of the
 * page's breadcrumb trail, the main section first and the page last, then an
 * "On this page" row for the page's outline. Each row opens a submenu to its
 * side: the other sections or pages at that level of the tree, or the page's
 * headings. Clicking a row goes to that level's page.
 *
 * Pure CSS (named `group-hover` / `group-focus-within` groups), like the
 * breadcrumb dropdowns in `docs-page-header.tsx`, so it renders on the server
 * with no client JavaScript. It is a toolbar item (`[data-toolbar-item]`), so
 * the button takes the toolbar's large-icon look from `styles/docs.css`.
 */
import Link from 'next/link';
import { ChevronRight, Compass, ListTree } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PageBreadcrumb } from '../../../lib/fumadocs/page-breadcrumbs';
import { buttonVariants } from '../../ui/button';

/** One heading of the page's outline, as fumadocs' `toc` gives it. */
export interface NavigationOutlineItem {
  title: ReactNode;
  /** The heading's anchor, e.g. `#setup`. */
  url: string;
  /** Heading level: 2 for `##`, 3 for `###`, … */
  depth: number;
}

/** Shared look of a menu row and a submenu entry. */
const ROW =
  'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground';
/** A submenu panel: opens to the side of its row while the row is hovered or focused. */
const SUBMENU =
  'invisible absolute start-full top-0 z-50 ps-1 opacity-0 transition-opacity duration-100 group-hover/navrow:visible group-hover/navrow:opacity-100 group-focus-within/navrow:visible group-focus-within/navrow:opacity-100';
const PANEL = 'rounded-lg border bg-fd-popover p-1 text-fd-popover-foreground shadow-lg';

export function PageNavigationMenu({
  breadcrumbs,
  outline,
}: {
  breadcrumbs: PageBreadcrumb[];
  outline: NavigationOutlineItem[];
}) {
  if (breadcrumbs.length === 0 && outline.length === 0) return null;
  return (
    <span data-toolbar-item="Navigation" className="group/docnav relative inline-flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-label="Navigation: this page's sections and outline"
        className={buttonVariants({ size: 'sm', className: 'gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground' })}
      >
        <Compass aria-hidden />
        <span>Navigation</span>
      </button>
      {/* The top padding bridges the gap to the button, so the pointer can
          travel down into the menu without it closing. */}
      <div className="invisible absolute start-0 top-full z-50 pt-1 opacity-0 transition-opacity duration-100 group-hover/docnav:visible group-hover/docnav:opacity-100 group-focus-within/docnav:visible group-focus-within/docnav:opacity-100">
        <nav aria-label="Page navigation" className={`w-64 ${PANEL}`}>
          <ul className="flex flex-col">
            {breadcrumbs.map((crumb, depth) => (
              <BreadcrumbRow key={depth} crumb={crumb} depth={depth} last={depth === breadcrumbs.length - 1} />
            ))}
            {outline.length > 0 && (
              <>
                {breadcrumbs.length > 0 && <li role="separator" className="my-1 h-px bg-fd-border" />}
                <OutlineRow outline={outline} />
              </>
            )}
          </ul>
        </nav>
      </div>
    </span>
  );
}

/** One level of the trail, indented by its depth, with that level's siblings as a submenu. */
function BreadcrumbRow({ crumb, depth, last }: { crumb: PageBreadcrumb; depth: number; last: boolean }) {
  const others = crumb.siblings.length > 1;
  const content = (
    <>
      <span className="min-w-0 flex-1 truncate">{crumb.name}</span>
      {others && <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />}
    </>
  );
  const className = `${ROW} ${last ? 'font-medium text-fd-foreground' : 'text-fd-muted-foreground'}`;
  const indent = { paddingInlineStart: `${0.5 + depth * 0.75}rem` };
  return (
    <li className="group/navrow relative">
      {crumb.url ? (
        <Link href={crumb.url} className={className} style={indent} aria-current={last ? 'page' : undefined}>
          {content}
        </Link>
      ) : (
        <span className={className} style={indent} tabIndex={others ? 0 : undefined}>
          {content}
        </span>
      )}
      {others && (
        <div className={SUBMENU}>
          <ul className={`max-h-80 w-60 overflow-y-auto ${PANEL}`}>
            {crumb.siblings.map((sibling) => (
              <li key={sibling.url}>
                <Link
                  href={sibling.url}
                  aria-current={sibling.current ? 'true' : undefined}
                  className={`${ROW} ${sibling.current ? 'bg-fd-primary/10 font-medium text-fd-primary' : ''}`}
                >
                  <span className="min-w-0 truncate">{sibling.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

/** "On this page": the page's headings, indented by level. */
function OutlineRow({ outline }: { outline: NavigationOutlineItem[] }) {
  const top = Math.min(...outline.map((item) => item.depth));
  return (
    <li className="group/navrow relative">
      <span className={`${ROW} text-fd-muted-foreground`} tabIndex={0}>
        <ListTree className="size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">On this page</span>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
      </span>
      <div className={SUBMENU}>
        <ul className={`max-h-96 w-72 overflow-y-auto ${PANEL}`}>
          {outline.map((item) => (
            <li key={item.url}>
              <a
                href={item.url}
                className={ROW}
                style={{ paddingInlineStart: `${0.5 + (item.depth - top) * 0.75}rem` }}
              >
                <span className="min-w-0 truncate">{item.title}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
