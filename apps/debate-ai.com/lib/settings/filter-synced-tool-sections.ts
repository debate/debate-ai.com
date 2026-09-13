/**
 * @fileoverview Search filter for the `/settings` → Account → "Tool data"
 * list (`components/settings/ToolDataSyncSettings.tsx`). The catalog it
 * renders (`debate-data-sync/src/state/toolRecordCollections.ts`) has grown
 * past fifty tools across seven sections, per that catalog's own comment —
 * long enough that finding one tool means scanning the whole grouped list.
 * This is the pure matching logic behind the search box, kept here (rather
 * than inline in the component) so it can be unit tested: this app's
 * `components` directory carries no Vitest project of its own (see
 * `vitest.config.ts`) — only its `lib` subfolders' `__tests__` directories do.
 *
 * @module lib/settings/filter-synced-tool-sections
 */

/** One tool row, as `ToolDataSyncSettings` builds it from the collection catalog. */
export interface SyncedToolEntry {
  href: string;
  label: string;
}

/** One section of the grouped tool list, as `ToolDataSyncSettings` renders it. */
export interface SyncedToolSectionGroup<TSection extends string = string, TTool extends SyncedToolEntry = SyncedToolEntry> {
  section: TSection;
  tools: TTool[];
}

/**
 * Filters the grouped tool list by a free-text query, matching a tool's
 * label or its section's name, case-insensitively. An empty (or
 * whitespace-only) query returns every group unchanged — the default,
 * unfiltered view.
 *
 * A section whose own name matches keeps every tool in it (typing "Videos"
 * shows the whole Videos group, not just a tool named "Videos"); otherwise
 * only the tools within it whose label matches are kept, and a section left
 * with none is dropped entirely rather than rendered as an empty heading.
 *
 * @param groups - The full, unfiltered grouped list.
 * @param query - The visitor's search text, e.g. from a controlled input.
 */
export function filterSyncedToolSections<TSection extends string, TTool extends SyncedToolEntry>(
  groups: readonly SyncedToolSectionGroup<TSection, TTool>[],
  query: string,
): SyncedToolSectionGroup<TSection, TTool>[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...groups];

  const filtered: SyncedToolSectionGroup<TSection, TTool>[] = [];
  for (const group of groups) {
    const sectionMatches = group.section.toLowerCase().includes(normalized);
    const tools = sectionMatches
      ? group.tools
      : group.tools.filter((tool) => tool.label.toLowerCase().includes(normalized));
    if (tools.length > 0) filtered.push({ ...group, tools });
  }
  return filtered;
}
