"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../ui/primitives/button";
import { Badge } from "../../../ui/primitives/badge";
import { Input } from "../../../ui/primitives/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/primitives/card";
import {
  fetchSchoolDirectoryReport,
  type SchoolDirectoryReport,
  type SchoolMissingInfo,
} from "@debate-ai/rankings/src/schools/school-directory";

const MISSING_LABELS: Record<SchoolMissingInfo, string> = {
  name: "No name",
  logo: "No logo",
};

/** Rows shown before "Show all". */
const PAGE = 100;

/**
 * Schools with missing info: every college and high school of the last ten
 * seasons that the school directory (rebuilt daily) could not fully fill in,
 * and names that look like one school split across two pages. Each school
 * links to its page.
 */
export function SchoolDirectoryPanel() {
  const [report, setReport] = useState<SchoolDirectoryReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<SchoolMissingInfo | "all">("name");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async (rebuild = false) => {
    setBusy(true);
    try {
      setReport(await fetchSchoolDirectoryReport(rebuild));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (report?.missing ?? []).filter(
      (school) =>
        (filter === "all" || school.missing.includes(filter)) &&
        (!needle || school.name.toLowerCase().includes(needle) || school.handle.includes(needle)),
    );
  }, [report, filter, query]);

  const count = (kind: SchoolMissingInfo) => report?.missing.filter((s) => s.missing.includes(kind)).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Schools with missing info</CardTitle>
          <CardDescription>
            Every college and high school ranked in the last ten seasons has a page at its @handle. These are the
            schools whose pages are missing something. Rebuilt daily from the current rankings, the saved high school
            seasons and the college tables.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {report && (
              <span className="text-muted-foreground">
                {report.total.toLocaleString()} schools ({report.counts.college} colleges,{" "}
                {report.counts.highSchool.toLocaleString()} high schools)
                {report.builtAt ? ` · built ${new Date(report.builtAt).toLocaleString()}` : " · not built yet"}
              </span>
            )}
            <Button size="sm" variant="outline" className="ml-auto" disabled={busy} onClick={() => void load(true)}>
              {busy ? "Working…" : "Rebuild now"}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            {(["name", "logo", "all"] as const).map((kind) => (
              <Button
                key={kind}
                size="sm"
                variant={filter === kind ? "default" : "outline"}
                onClick={() => setFilter(kind)}
              >
                {kind === "all" ? `All (${report?.missing.length ?? 0})` : `${MISSING_LABELS[kind]} (${count(kind)})`}
              </Button>
            ))}
            <Input
              className="h-8 max-w-56"
              placeholder="Filter by name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {report && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing missing here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3">School</th>
                    <th className="py-1 pr-3">Level</th>
                    <th className="py-1 pr-3">Seasons</th>
                    <th className="py-1 pr-3">Missing</th>
                    <th className="py-1">Also known as</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAll ? rows : rows.slice(0, PAGE)).map((school) => (
                    <tr key={school.handle} className="border-t align-top">
                      <td className="py-1.5 pr-3">
                        <a href={`/@${school.handle}`} className="font-medium hover:underline">
                          {school.name}
                        </a>
                        <div className="text-xs text-muted-foreground">@{school.handle}</div>
                      </td>
                      <td className="py-1.5 pr-3">{school.level === "college" ? "College" : "High school"}</td>
                      <td className="py-1.5 pr-3 tabular-nums">
                        {school.firstYear === school.lastYear ? school.lastYear : `${school.firstYear}–${school.lastYear}`}
                        {school.ranked && <Badge className="ml-1" variant="secondary">ranked now</Badge>}
                      </td>
                      <td className="py-1.5 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {school.missing.map((kind) => (
                            <Badge key={kind} variant="outline">
                              {MISSING_LABELS[kind]}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-1.5 text-xs text-muted-foreground">{school.aliases.join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!showAll && rows.length > PAGE && (
                <Button size="sm" variant="ghost" className="mt-2" onClick={() => setShowAll(true)}>
                  Show all {rows.length.toLocaleString()}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Similar names</CardTitle>
          <CardDescription>
            Names that look like one school but open different pages. Colleges are merged automatically by the alias
            table in debate-rankings (src/schools/school-alias-data.ts); add a high school pair to
            SCHOOL_HANDLE_OVERRIDES to merge it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report && report.similar.length === 0 ? (
            <p className="text-sm text-muted-foreground">No similar names.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {(report?.similar ?? []).map((group) => (
                <li key={group.key} className="flex flex-wrap gap-x-3 gap-y-1 border-t pt-2">
                  {group.schools.map((school) => (
                    <a key={school.handle} href={`/@${school.handle}`} className="hover:underline">
                      {school.name} <span className="text-xs text-muted-foreground">@{school.handle} · {school.lastYear}</span>
                    </a>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
