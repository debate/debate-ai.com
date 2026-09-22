/**
 * @fileoverview Season standings — the bid list and Elo ratings behind the
 * app's rankings surface.
 *
 * `getLeaderboard` merges TOC bids with DebateDrills Elo for the current
 * season and returns Elo alone for past ones, which is why a row may carry
 * either number and the table renders a dash rather than a zero for the one
 * it does not have.
 *
 * @module screens/RankingsScreen
 */

import { useState } from "react";
import { getLeaderboard, type LeaderboardEntry } from "debate-api-client";

import { unwrap } from "../api";
import { AsyncBoundary, ResultCount, SelectField } from "../primitives";
import { useAsync } from "../useAsync";
import type { WebUIContext } from "../types";

const DIVISIONS = [
  { value: "VPF", label: "Varsity Public Forum" },
  { value: "VLD", label: "Varsity Lincoln-Douglas" },
  { value: "VCX", label: "Varsity Policy" },
] as const;

/** Seasons the route serves: the current one, plus the Elo-only archive. */
const YEARS = ["2026", "2025", "2024", "2023", "2022", "2021"] as const;

const YEAR_OPTIONS = YEARS.map((year) => ({ value: year, label: year }));

/** Rows shown at once — enough to read a top table without a scroll of its own. */
const ROW_LIMIT = 25;

export function RankingsScreen({ client, openRoute }: WebUIContext) {
  const [division, setDivision] = useState<string>("VPF");
  const [year, setYear] = useState<string>(YEARS[0]);

  const { data, loading, error, reload } = useAsync<LeaderboardEntry[]>(
    async () => {
      const payload = await unwrap(
        getLeaderboard(
          { query: { division: division as "VPF" | "VLD" | "VCX", year } },
          { client },
        ),
      );
      return Array.isArray(payload) ? payload : [];
    },
    [division, year],
  );

  const entries = data ?? [];

  return (
    <>
      <div className="dai-filters">
        <SelectField
          id="dai-rank-division"
          label="Division"
          value={division}
          options={DIVISIONS}
          onChange={setDivision}
        />
        <SelectField
          id="dai-rank-year"
          label="Season"
          value={year}
          options={YEAR_OPTIONS}
          onChange={setYear}
        />
      </div>

      {data && <ResultCount count={entries.length} noun="team" />}

      <AsyncBoundary
        loading={loading}
        error={error}
        empty={entries.length === 0}
        emptyText="No standings for that division and season."
        onRetry={reload}
      >
        <table className="dai-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Team</th>
              <th scope="col">Debaters</th>
              <th scope="col">Bids</th>
              <th scope="col">Elo</th>
            </tr>
          </thead>
          <tbody>
            {entries.slice(0, ROW_LIMIT).map((entry, index) => (
              <tr key={`${entry.teamName}-${index}`}>
                <td className="dai-num">{index + 1}</td>
                <td>{entry.teamName}</td>
                <td>{entry.students || "—"}</td>
                <td className="dai-num">{entry.bids ?? "—"}</td>
                <td className="dai-num">
                  {typeof entry.debateElo === "number" ? Math.round(entry.debateElo) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AsyncBoundary>

      {entries.length > ROW_LIMIT && (
        <p className="dai-footnote">
          Showing the top {ROW_LIMIT} of {entries.length}.{" "}
          <button type="button" className="dai-link" onClick={() => openRoute("/rank")}>
            Open the full standings
          </button>
          .
        </p>
      )}
    </>
  );
}
