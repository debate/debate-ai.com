/**
 * @file last-revised.tsx
 * @description "Last revised: <date>" line shown under every docs page's
 * header. The date is the page file's last Git commit (fumadocs-mdx
 * `lastModified`, lib/mdx/git-last-modified.ts), so it tracks edits, not an
 * editorial review. Renders nothing when the date is unknown.
 */

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

/** Accepts a Date or anything `new Date()` takes; invalid input renders nothing. */
export function LastRevised({ date }: { date?: Date | string | number | null }) {
  if (date == null) return null;
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return null;
  return (
    <p className="not-prose mt-1 text-sm text-fd-muted-foreground">
      Last revised: <time dateTime={value.toISOString()}>{dateFormatter.format(value)}</time>
    </p>
  );
}
