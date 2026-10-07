"use client";

import { Fragment, useState } from "react";
import type { RoundSchematic } from "../client";
import { isLiveDemo, type LiveRoomInput } from "../live/demo-live";
import { LiveRoomPanel, LiveStatusCell, useNow } from "../live/LiveRoom";
import { Badge, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../primitives";
import { BackLink, Empty, Loaded, formatDate, useApi, useTournaments } from "../shared";

/** The emblem in the top-right corner of a round's pairings. */
export const PAIRINGS_EMBLEM = "https://i.imgur.com/ejU0Qon.png";

/** One round's pairings: rooms, entries (sides or speaker order) and judges. */
export function RoundPage({ tournId, eventAbbr, roundName }: { tournId: number; eventAbbr: string; roundName: string }) {
  const { client, hrefs } = useTournaments();
  const state = useApi(`round:${tournId}:${eventAbbr}:${roundName}`, (signal) => client.round(tournId, eventAbbr, roundName, signal));
  return (
    <div className="space-y-3">
      <BackLink href={hrefs.rounds(tournId)}>All pairings</BackLink>
      <Loaded state={state}>{(round) => <Schematic round={round} live={isLiveDemo(tournId)} />}</Loaded>
    </div>
  );
}

/**
 * `live` adds the demo tournament's simulated live status beside each room
 * (`../live/demo-live`), with a stream panel that opens under the room.
 */
export function Schematic({ round, live = false }: { round: RoundSchematic; live?: boolean }) {
  const sections = Object.values(round.Sections ?? {});
  const debate = round.Event.type !== "speech" && round.Event.type !== "congress";
  const now = useNow(live ? 1000 : 60_000);
  const [openId, setOpenId] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">
            {round.Event.name} — {round.label || `Round ${round.name}`}
          </h2>
          {round.startTime && <p className="text-sm text-muted-foreground">Starts {formatDate(round.startTime, round.tz, true)}</p>}
          {live && (
            <p className="text-xs text-muted-foreground">
              Demo tournament: live status is simulated. Tune in to a room to follow its speeches, hear them read aloud and read summaries.
            </p>
          )}
        </div>
        <img src={PAIRINGS_EMBLEM} alt="" width={80} height={80} className="size-16 shrink-0 rounded-full md:size-20" />
      </div>
      {sections.length === 0 ? (
        <Empty>No sections in this round.</Empty>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>{debate ? "Entries" : "Speakers"}</TableHead>
                <TableHead>Judges</TableHead>
                {live && <TableHead>Live</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.map((section) => {
                const entries = Object.values(section.Entries ?? {}).sort(
                  (a, b) => (a.side ?? a.speakerorder ?? 0) - (b.side ?? b.speakerorder ?? 0),
                );
                const judges = Object.values(section.Judges ?? {});
                const room: LiveRoomInput = {
                  sectionId: section.id,
                  eventAbbr: round.Event.abbr,
                  eventType: round.Event.type,
                  entries: entries.map((e) => e.code),
                  judgeCount: judges.length,
                };
                const showLive = live && !section.bye && entries.length > 0;
                const open = showLive && openId === section.id;
                return (
                  <Fragment key={section.id}>
                    <TableRow className="align-top">
                      <TableCell className="whitespace-nowrap">
                        {section.Room?.name ?? "—"}
                        {section.letter && <span className="ml-1 text-xs text-muted-foreground">#{section.letter}</span>}
                      </TableCell>
                      <TableCell>
                        {section.bye ? (
                          <Badge variant="outline" className="mb-1">
                            Bye
                          </Badge>
                        ) : null}
                        <span className="flex flex-wrap gap-x-3 gap-y-1">
                          {entries.map((entry) => (
                            <span key={entry.id}>
                              {entry.code}
                              {entry.record && <span className="ml-1 text-xs text-muted-foreground">({entry.record})</span>}
                            </span>
                          ))}
                        </span>
                      </TableCell>
                      <TableCell>
                        {judges.map((j, i) => (
                          <span key={i} className="mr-3 inline-block">
                            {[j.first, j.last].filter(Boolean).join(" ")}
                            {j.chair ? (
                              <Badge variant="secondary" className="ml-1">
                                Chair
                              </Badge>
                            ) : null}
                          </span>
                        ))}
                      </TableCell>
                      {live && (
                        <TableCell>
                          {showLive ? (
                            <LiveStatusCell
                              room={room}
                              roundId={round.id}
                              now={now}
                              open={open}
                              onToggle={() => setOpenId(open ? null : section.id)}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                    {open && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={4} className="whitespace-normal p-3">
                          <LiveRoomPanel room={room} roundId={round.id} now={now} onClose={() => setOpenId(null)} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
