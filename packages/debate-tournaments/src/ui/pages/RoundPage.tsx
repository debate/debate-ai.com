"use client";

import type { RoundSchematic } from "../client";
import { Empty, Loaded, formatDate, useApi, useTournaments } from "../shared";

/** One round's pairings: rooms, entries (sides or speaker order) and judges. */
export function RoundPage({ tournId, eventAbbr, roundName }: { tournId: number; eventAbbr: string; roundName: string }) {
  const { client, hrefs, Link } = useTournaments();
  const state = useApi(`round:${tournId}:${eventAbbr}:${roundName}`, (signal) =>
    client.round(tournId, eventAbbr, roundName, signal),
  );
  return (
    <div className="space-y-3">
      <Link href={hrefs.rounds(tournId)} className="text-xs text-muted-foreground hover:underline">
        ← All pairings
      </Link>
      <Loaded state={state}>{(round) => <Schematic round={round} />}</Loaded>
    </div>
  );
}

function Schematic({ round }: { round: RoundSchematic }) {
  const sections = Object.values(round.Sections ?? {});
  const debate = round.Event.type !== "speech" && round.Event.type !== "congress";
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">
          {round.Event.name} — {round.label || `Round ${round.name}`}
        </h2>
        {round.startTime && <p className="text-sm text-muted-foreground">Starts {formatDate(round.startTime, round.tz, true)}</p>}
      </div>
      {sections.length === 0 ? (
        <Empty>No sections in this round.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Room</th>
                <th className="px-3 py-2 font-medium">{debate ? "Entries" : "Speakers"}</th>
                <th className="px-3 py-2 font-medium">Judges</th>
              </tr>
            </thead>
            <tbody className="divide-y align-top">
              {sections.map((section) => {
                const entries = Object.values(section.Entries ?? {}).sort(
                  (a, b) => (a.side ?? a.speakerorder ?? 0) - (b.side ?? b.speakerorder ?? 0),
                );
                const judges = Object.values(section.Judges ?? {});
                return (
                  <tr key={section.id}>
                    <td className="whitespace-nowrap px-3 py-2">
                      {section.Room?.name ?? "—"}
                      {section.letter && <span className="ml-1 text-xs text-muted-foreground">#{section.letter}</span>}
                    </td>
                    <td className="px-3 py-2">
                      {section.bracket ? <span className="mr-2 text-xs text-muted-foreground">Bye</span> : null}
                      <span className="flex flex-wrap gap-x-3 gap-y-1">
                        {entries.map((entry) => (
                          <span key={entry.id}>
                            {entry.code}
                            {entry.record && <span className="ml-1 text-xs text-muted-foreground">({entry.record})</span>}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {judges.map((j, i) => (
                        <span key={i} className="mr-3 inline-block">
                          {[j.first, j.last].filter(Boolean).join(" ")}
                          {j.chair ? <span className="ml-1 text-xs text-muted-foreground">(chair)</span> : null}
                        </span>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
