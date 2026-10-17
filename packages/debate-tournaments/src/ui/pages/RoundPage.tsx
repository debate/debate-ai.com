"use client";

import { Fragment, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { RoundSchematic } from "../client";
import { isLiveDemo, type LiveRoomInput } from "../live/demo-live";
import { LiveRoomPanel, LiveStatusCell, useNow } from "../live/LiveRoom";
import { Badge, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../primitives";
import { BackLink, Empty, Loaded, formatDate, useApi, useTournaments } from "../shared";

/** The emblem in the top-right corner of a round's pairings. */
export const PAIRINGS_EMBLEM = "https://i.imgur.com/ejU0Qon.png";

/** A quote and its source line. */
export interface Quote {
  text: string;
  source: string;
}

/** The quote the emblem shows as its tooltip and at the top of its dialog. */
export const PANOPTICON_QUOTE: Quote = {
  text: "“Panopticon, subtly arranged so that an observer may observe, at a glance, so many different individuals, also enables everyone to come and observe any of the observers.”",
  source: "— Michel Foucault, Discipline and Punish, translated by Alan Sheridan, “Panopticism,” p. 207.",
};

/** Related passages listed under the main quote in the emblem's dialog. */
export const PANOPTICON_RELATED: Quote[] = [
  {
    text: "“It has become a transparent building in which the exercise of power may be supervised by society as a whole.”",
    source: "— Foucault, Discipline and Punish, p. 207.",
  },
  {
    text: "“The disciplinary mechanism will be democratically controlled, since it will be constantly accessible ‘to the great tribunal committee of the world’.”",
    source: "— Foucault, Discipline and Punish, p. 207; the embedded phrase comes from Bentham.",
  },
  {
    text: "“Its aim is to strengthen the social forces—to increase production, to develop the economy, spread education, raise the level of public morality; to increase and multiply.”",
    source: "— Foucault, Discipline and Punish, pp. 207–208.",
  },
  {
    text: "He who is subjected to a field of visibility, and who knows it, assumes responsibility for the constraints",
    source: "",
  },
];

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

/** The pairings emblem: hovering shows the Foucault quote, clicking opens it in a dialog. */
export function PairingsEmblem() {
  const [open, setOpen] = useState(false);
  const tooltip = `${PANOPTICON_QUOTE.text}\n\n${PANOPTICON_QUOTE.source}`;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        title={tooltip}
        aria-label="Show the Panopticon quote"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="shrink-0 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img src={PAIRINGS_EMBLEM} alt="" width={80} height={80} className="size-16 rounded-full md:size-20" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Panopticism"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
        >
          <button type="button" aria-hidden tabIndex={-1} className="absolute inset-0 cursor-default" onClick={() => setOpen(false)} />
          <div className="relative max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-xl border bg-card p-6 shadow-lg">
            <button
              type="button"
              autoFocus
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            <img src={PAIRINGS_EMBLEM} alt="" width={80} height={80} className="mx-auto size-20 rounded-full" />
            <figure className="space-y-2">
              <blockquote className="text-base italic leading-relaxed">{PANOPTICON_QUOTE.text}</blockquote>
              <figcaption className="text-sm text-muted-foreground">{PANOPTICON_QUOTE.source}</figcaption>
            </figure>
            <ul className="space-y-4 border-t pt-4">
              {PANOPTICON_RELATED.map((quote) => (
                <li key={quote.text}>
                  <figure className="space-y-1">
                    <blockquote className="text-sm italic leading-relaxed">{quote.text}</blockquote>
                    <figcaption className="text-xs text-muted-foreground">{quote.source}</figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * `live` adds the demo tournament's simulated live status beside each room
 * (`../live/demo-live`), with a stream panel that opens under the room.
 */
export function Schematic({
  round,
  live = false,
}: {
  round: RoundSchematic;
  live?: boolean;
}) {
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
        <PairingsEmblem />
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
