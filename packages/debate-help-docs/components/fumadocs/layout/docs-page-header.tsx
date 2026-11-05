/**
 * @file docs-page-header.tsx
 * @description The top of every docs page: a breadcrumb trail, then the
 * page's title in a modest heading.
 *
 * Hovering (or tabbing to) a crumb opens a dropdown of everything at that
 * level of the tree, so a reader can jump to a sibling section or page
 * without the sidebar. Pure CSS (`group-hover` / `group-focus-within`), so
 * it renders on the server with no client JavaScript.
 *
 * The page's own leading `#` heading is dropped when it repeats this title
 * (`lib/mdx/remark-drop-title-heading.ts`), so the title shows once.
 */
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PageBreadcrumb } from '../../../lib/fumadocs/page-breadcrumbs';

export function DocsPageHeader({
  title,
  breadcrumbs,
}: {
  title: ReactNode;
  breadcrumbs: PageBreadcrumb[];
}) {
  return (
    <header className="docs-page-header not-prose flex flex-col gap-2 pt-2">
      {breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-0.5 text-sm text-fd-muted-foreground">
            {breadcrumbs.map((crumb, i) => {
              const last = i === breadcrumbs.length - 1;
              return (
                <li key={i} className="flex min-w-0 items-center gap-0.5">
                  <Crumb crumb={crumb} last={last} />
                  {!last && <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <h1 className="text-2xl font-semibold tracking-tight text-fd-foreground">{title}</h1>
    </header>
  );
}

function Crumb({ crumb, last }: { crumb: PageBreadcrumb; last: boolean }) {
  const label = (
    <span className="max-w-[16rem] truncate">{crumb.name}</span>
  );
  const others = crumb.siblings.length > 1;
  const triggerClass = `inline-flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground ${
    last ? 'font-medium text-fd-foreground' : ''
  }`;

  return (
    <div className="group relative min-w-0">
      {crumb.url ? (
        <Link href={crumb.url} className={triggerClass} aria-current={last ? 'page' : undefined}>
          {label}
          {others && <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />}
        </Link>
      ) : (
        <span className={triggerClass} tabIndex={others ? 0 : undefined}>
          {label}
          {others && <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />}
        </span>
      )}
      {others && (
        // The top padding bridges the gap to the trigger, so the pointer can
        // travel down into the menu without it closing.
        <div className="invisible absolute start-0 top-full z-50 pt-1 opacity-0 transition-opacity duration-100 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
          <ul className="max-h-80 min-w-56 max-w-sm overflow-y-auto rounded-lg border bg-fd-popover p-1 text-fd-popover-foreground shadow-lg">
            {crumb.siblings.map((sibling) => (
              <li key={sibling.url}>
                <Link
                  href={sibling.url}
                  aria-current={sibling.current ? 'true' : undefined}
                  className={`block truncate rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground ${
                    sibling.current ? 'bg-fd-primary/10 font-medium text-fd-primary' : ''
                  }`}
                >
                  {sibling.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
