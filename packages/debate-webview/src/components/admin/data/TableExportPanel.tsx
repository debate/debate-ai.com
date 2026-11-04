"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../ui/primitives/card";

interface ExportGroupInfo {
  key: string;
  label: string;
  tables: Array<{ name: string; rows: number }>;
}

type ExportFormat = "csv" | "json";

/**
 * Export single tables — videos, teams and schools, tournament records and
 * judges — as CSV or JSON (apps/debate-web/lib/admin/table-export.ts). Every
 * row is exported; the evidence tables are not offered (they are in the SQL
 * backup). One table downloads as a plain file, several as a zip.
 */
export function TableExportPanel() {
  const [groups, setGroups] = useState<ExportGroupInfo[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/table-export");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Failed to load tables");
      setGroups(body.groups);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (name: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const toggleGroup = (group: ExportGroupInfo) =>
    setSelected((current) => {
      const next = new Set(current);
      const all = group.tables.every((table) => next.has(table.name));
      for (const table of group.tables) {
        if (all) next.delete(table.name);
        else next.add(table.name);
      }
      return next;
    });

  const hrefFor = (tables: string[]) =>
    `/api/admin/table-export/download?tables=${encodeURIComponent(tables.join(","))}&format=${format}`;
  const picked = [...selected];
  const visibleGroups = groups?.filter((group) => group.tables.length > 0) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export tables</CardTitle>
        <CardDescription>
          Download whole tables — every row, no limit — to open in a spreadsheet or script. Pick one
          table for a plain <code>.csv</code> or <code>.json</code> file, or several for a zip with
          one file per table. The evidence tables (debate cards, caselists) are not offered here;
          use the SQL backup below for those.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium">Format</span>
          {(["csv", "json"] as const).map((value) => (
            <label key={value} className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="table-export-format"
                checked={format === value}
                onChange={() => setFormat(value)}
              />
              {value.toUpperCase()}
            </label>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {visibleGroups.map((group) => (
            <div key={group.key} className="flex flex-col gap-2 rounded-md border p-3 text-sm">
              <label className="flex cursor-pointer items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={group.tables.every((table) => selected.has(table.name))}
                  onChange={() => toggleGroup(group)}
                />
                {group.label}
              </label>
              <ul className="flex flex-col gap-1">
                {group.tables.map((table) => (
                  <li key={table.name} className="flex items-center justify-between gap-2">
                    <label className="flex min-w-0 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(table.name)}
                        onChange={() => toggle(table.name)}
                      />
                      <code className="truncate">{table.name}</code>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {table.rows.toLocaleString()} rows
                      </span>
                    </label>
                    <a
                      href={hrefFor([table.name])}
                      className="text-primary shrink-0 text-xs underline-offset-2 hover:underline"
                      download
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!groups && !error && <p className="text-muted-foreground text-sm">Loading…</p>}
          {groups && visibleGroups.length === 0 && (
            <p className="text-muted-foreground text-sm">None of the exportable tables exist in this database.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <a
              href={picked.length ? hrefFor(picked) : undefined}
              aria-disabled={picked.length === 0}
              className={picked.length ? undefined : "pointer-events-none opacity-50"}
              download
            >
              {picked.length > 1 ? `Download ${picked.length} tables (.zip)` : "Download selected"}
            </a>
          </Button>
          {picked.length > 0 && (
            <Button variant="outline" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          )}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}
