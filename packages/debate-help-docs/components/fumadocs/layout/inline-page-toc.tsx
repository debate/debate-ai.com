/**
 * @file inline-page-toc.tsx
 * @description A table of contents inside the page body, under the page
 * header, so a reader sees what a long page covers before scrolling. Shown on
 * Debate Basics pages (`lib/fumadocs/inline-toc.ts`); the side TOC is unchanged.
 *
 * A native `<details>` (open by default) keeps it collapsible with no client
 * JavaScript. Top-level headings become columns with their sub-headings
 * listed under them.
 */
import type { TOCItemType } from 'fumadocs-core/toc';
import { ListTree } from 'lucide-react';
import { groupInlineToc, inlineTocSize } from '../../../lib/fumadocs/inline-toc';

/** Fewer links than this and the page is short enough not to need one. */
const MIN_LINKS = 2;

export function InlinePageToc({ toc }: { toc: TOCItemType[] }) {
  const groups = groupInlineToc(toc);
  if (inlineTocSize(groups) < MIN_LINKS) return null;
  const flat = groups.every((g) => g.children.length === 0);

  return (
    <details open className="inline-page-toc not-prose mt-6 rounded-xl border bg-fd-card text-sm">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 font-medium text-fd-foreground">
        <ListTree className="size-4 text-fd-muted-foreground" aria-hidden />
        On this page
      </summary>
      <nav aria-label="On this page" className="border-t px-4 py-3">
        {flat ? (
          <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {groups.map((g, i) => g.item && (
              <li key={i}>
                <TocLink item={g.item} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {groups.map((g, i) => (
              <div key={i} className="min-w-0">
                {g.item && (
                  <TocLink item={g.item} className="font-medium text-fd-foreground transition-colors hover:text-fd-primary" />
                )}
                {g.children.length > 0 && (
                  <ul className="mt-1.5 flex flex-col gap-1 border-l ps-3">
                    {g.children.map((child, j) => (
                      <li key={j}>
                        <TocLink item={child} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </nav>
    </details>
  );
}

function TocLink({ item, className }: { item: TOCItemType; className?: string }) {
  return (
    <a
      href={item.url}
      className={
        className ??
        'text-fd-muted-foreground transition-colors hover:text-fd-primary'
      }
    >
      {item.title}
    </a>
  );
}
