"use client";

import { useState, type CSSProperties } from "react";
import { Check, ChevronDown, ChevronsLeftRight, ChevronsRightLeft } from "lucide-react";
import { ballotScore, buildBracket, isElimRound, type BracketColumn, type BracketMatchup } from "../bracket";
import type { PublishedRound, RoundSchematic, TournamentSource } from "../client";
import { EntryLabel, JudgeName } from "../enrichment";
import { Collapsible, CollapsibleContent, CollapsibleTrigger, HoverCard, HoverCardContent, HoverCardTrigger } from "../hover-card";
import { Badge, Card, cn } from "../primitives";
import { Loaded, useApi, useTournaments } from "../shared";

/** Height of one first-round slot; every later round's slots are a multiple of it. */
const SLOT_HEIGHT = 92;

/**
 * One event's elimination rounds as a single bracket: the published elim
 * rounds are loaded together and drawn column by column, each matchup beside
 * the one its winner reached. Renders nothing for an event without elims.
 * `currentRound` (a round name) is highlighted.
 */
export function ElimBracket({
  tournId,
  eventAbbr,
  currentRound,
  rounds,
}: {
  tournId: number;
  eventAbbr: string;
  currentRound?: number;
  /** The tournament's published rounds, from `client.rounds`. */
  rounds: readonly PublishedRound[];
}) {
  const { client } = useTournaments();
  const elims = rounds
    .filter((round) => round.Event.abbr === eventAbbr && isElimRound(round.type))
    .map((round) => round.name)
    .sort((a, b) => a - b);
  const state = useApi(`bracket:${tournId}:${eventAbbr}:${elims.join(",")}`, (signal) =>
    // A round that fails to load is left out rather than hiding the rest.
    Promise.all(elims.map((name) => client.round(tournId, eventAbbr, String(name), signal).catch(() => null))).then((loaded) =>
      loaded.filter((round): round is RoundSchematic => round !== null),
    ),
  );
  if (elims.length === 0) return null;
  return (
    <Loaded state={state}>
      {(loaded) => {
        const columns = buildBracket(loaded);
        if (columns.length === 0) return null;
        return (
          <BracketCard
            columns={columns}
            eventName={loaded[0].Event.name}
            eventType={loaded[0].Event.type}
            eventAbbr={eventAbbr}
            tournId={tournId}
            currentRound={currentRound}
            source={client.sourceOf(tournId)}
          />
        );
      }}
    </Loaded>
  );
}

interface BracketContext {
  tournId: number;
  eventAbbr: string;
  eventName: string;
  eventType: string;
  source?: TournamentSource;
}

/** The bracket in a collapsible card, with a collapse toggle on every round. */
export function BracketCard({
  columns,
  eventName,
  eventType,
  eventAbbr,
  tournId,
  currentRound,
  source,
}: {
  columns: BracketColumn[];
  eventName: string;
  eventType: string;
  eventAbbr: string;
  tournId: number;
  currentRound?: number;
  source?: TournamentSource;
}) {
  const [open, setOpen] = useState(true);
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set());
  const toggle = (roundName: number) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(roundName)) next.add(roundName);
      return next;
    });
  const allCollapsed = collapsed.size === columns.length;
  const ctx: BracketContext = { tournId, eventAbbr, eventName, eventType, source };
  // Sized by the first round still shown, so collapsing early rounds shrinks the bracket.
  const firstShown = columns.find((column) => !collapsed.has(column.roundName)) ?? columns[0];
  const height = Math.max(1, firstShown.slots.length) * SLOT_HEIGHT;
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <Card className="overflow-hidden" data-elim-bracket="">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
          <CollapsibleTrigger className="group flex min-w-0 items-center gap-2 rounded-md text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
            <span className="truncate">{eventName} — Elimination bracket</span>
          </CollapsibleTrigger>
          {open && columns.length > 1 ? (
            <button
              type="button"
              onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(columns.map((column) => column.roundName)))}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {allCollapsed ? <ChevronsLeftRight aria-hidden className="size-3.5" /> : <ChevronsRightLeft aria-hidden className="size-3.5" />}
              {allCollapsed ? "Expand rounds" : "Collapse rounds"}
            </button>
          ) : null}
        </div>
        <CollapsibleContent>
          <div className="overflow-x-auto p-4">
            <div className="flex min-w-max gap-6">
              {columns.map((column, index) => (
                <RoundColumn
                  key={column.roundId}
                  column={column}
                  ctx={ctx}
                  height={height}
                  current={column.roundName === currentRound}
                  collapsed={collapsed.has(column.roundName)}
                  onToggle={() => toggle(column.roundName)}
                  linkLeft={index > 0 && !collapsed.has(columns[index - 1].roundName)}
                  linkRight={index < columns.length - 1 && !collapsed.has(columns[index + 1].roundName)}
                />
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function RoundColumn({
  column,
  ctx,
  height,
  current,
  collapsed,
  onToggle,
  linkLeft,
  linkRight,
}: {
  column: BracketColumn;
  ctx: BracketContext;
  height: number;
  current: boolean;
  collapsed: boolean;
  onToggle: () => void;
  linkLeft: boolean;
  linkRight: boolean;
}) {
  const count = column.slots.filter(Boolean).length;
  if (collapsed) {
    return (
      <section aria-label={column.label} className="flex w-9 flex-col items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={false}
          title={`Show ${column.label}`}
          className={cn(
            "flex w-full flex-1 flex-col items-center gap-2 rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
            current && "border-primary text-primary",
          )}
        >
          <ChevronDown aria-hidden className="size-3.5 -rotate-90" />
          <span className="[writing-mode:vertical-rl]">
            {column.label} · {count}
          </span>
        </button>
      </section>
    );
  }
  // Pair the slots: slots 2p and 2p + 1 feed slot p of the next round.
  const pairs: Array<[BracketMatchup | null, BracketMatchup | null | undefined]> = [];
  for (let i = 0; i < column.slots.length; i += 2) pairs.push([column.slots[i], column.slots[i + 1]]);
  return (
    <section aria-label={column.label} className="flex w-64 flex-col gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded
        title={`Collapse ${column.label}`}
        className={cn(
          "flex items-center justify-between rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
          current && "bg-primary/10 text-primary",
        )}
      >
        <span>{column.label}</span>
        <span className="flex items-center gap-1 text-xs tabular-nums">
          {count}
          <ChevronDown aria-hidden className="size-3.5" />
        </span>
      </button>
      <div className="flex flex-col" style={{ height }}>
        {pairs.map(([top, bottom], index) => (
          <div key={index} className="relative flex flex-1 flex-col">
            <Slot matchup={top} column={column} ctx={ctx} linkLeft={linkLeft} />
            {bottom !== undefined ? <Slot matchup={bottom} column={column} ctx={ctx} linkLeft={linkLeft} /> : null}
            {linkRight && top ? <Connector half="top" whole={bottom === undefined} /> : null}
            {linkRight && bottom ? <Connector half="bottom" /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The line from a matchup to the one its winner plays next: half of a "⊐"
 * joining the pair's two slots, meeting at the pair's middle. A pair with a
 * single slot gets a straight line instead.
 */
function Connector({ half, whole = false }: { half: "top" | "bottom"; whole?: boolean }) {
  const style: CSSProperties = whole ? { top: "50%" } : half === "top" ? { top: "25%", height: "25%" } : { top: "50%", height: "25%" };
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        "pointer-events-none absolute -right-3 w-3 border-border",
        whole ? "border-t" : half === "top" ? "rounded-tr-md border-t border-r" : "rounded-br-md border-b border-r",
      )}
    />
  );
}

function Slot({
  matchup,
  column,
  ctx,
  linkLeft,
}: {
  matchup: BracketMatchup | null;
  column: BracketColumn;
  ctx: BracketContext;
  linkLeft: boolean;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 items-center">
      {matchup ? (
        <>
          {linkLeft ? <span aria-hidden className="pointer-events-none absolute -left-3 top-1/2 w-3 border-t border-border" /> : null}
          <MatchupCard matchup={matchup} column={column} ctx={ctx} />
        </>
      ) : null}
    </div>
  );
}

/** A matchup's entries; hovering (or tapping) shows its judges, decision and ballots. */
function MatchupCard({ matchup, column, ctx }: { matchup: BracketMatchup; column: BracketColumn; ctx: BracketContext }) {
  const [open, setOpen] = useState(false);
  // Clicking inside the card (a judge's name opens their paradigm) keeps it
  // open until the pointer goes down somewhere else.
  const [pinned, setPinned] = useState(false);
  const debate = ctx.eventType !== "speech" && ctx.eventType !== "congress";
  const decided = matchup.winnerId !== null;
  return (
    <HoverCard
      open={open}
      onOpenChange={(next) => {
        if (!next && pinned) return;
        setOpen(next);
      }}
      openDelay={150}
      closeDelay={100}
    >
      <HoverCardTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          aria-label={`${column.label}: ${matchup.entries.map((entry) => entry.code).join(" vs ")}`}
          data-matchup={matchup.sectionId}
          onClick={() => setOpen((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpen((value) => !value);
            }
          }}
          className="w-full cursor-pointer divide-y rounded-lg border bg-card text-sm shadow-xs transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {matchup.entries.length === 0 ? <p className="px-2.5 py-1.5 text-muted-foreground">TBD</p> : null}
          {matchup.entries.map((entry) => {
            const won = entry.id === matchup.winnerId;
            return (
              <div
                key={entry.id}
                data-winner={won ? "" : undefined}
                className={cn("flex min-w-0 items-center gap-1.5 px-2.5 py-1.5", decided && !won && "opacity-55", won && "font-semibold")}
              >
                <span className="min-w-0 flex-1 truncate">
                  {debate ? (
                    <EntryLabel
                      side={entry.side}
                      query={{ code: entry.code, name: entry.name, school: entry.school, event: { abbr: ctx.eventAbbr, name: ctx.eventName, type: ctx.eventType } }}
                    />
                  ) : (
                    entry.code
                  )}
                </span>
                {matchup.decidedBy === "ballots" ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{entry.wins}</span> : null}
                {won ? <Check aria-label="Advanced" className="size-3.5 shrink-0 text-primary" /> : null}
              </div>
            );
          })}
          {matchup.bye ? (
            <p className="px-2.5 py-1 text-xs text-muted-foreground">Bye</p>
          ) : null}
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-80 p-0"
        side="right"
        align="start"
        onPointerDown={() => setPinned(true)}
        onPointerDownOutside={() => {
          setPinned(false);
          setOpen(false);
        }}
        onEscapeKeyDown={() => {
          setPinned(false);
          setOpen(false);
        }}
      >
        <MatchupDetails matchup={matchup} column={column} ctx={ctx} />
      </HoverCardContent>
    </HoverCard>
  );
}

/** The hover card's body: decision, each judge's ballot and points, and a link to the round. */
export function MatchupDetails({ matchup, column, ctx }: { matchup: BracketMatchup; column: BracketColumn; ctx: BracketContext }) {
  const { hrefs, Link } = useTournaments();
  const winner = matchup.entries.find((entry) => entry.id === matchup.winnerId);
  const score = ballotScore(matchup);
  const codeOf = (id: number | null) => matchup.entries.find((entry) => entry.id === id)?.code ?? null;
  const decision = winner
    ? matchup.decidedBy === "ballots"
      ? `${winner.code} won ${score}${winner.side ? ` on the ${winner.side === "aff" ? "Aff" : "Neg"}` : ""}`
      : matchup.bye
        ? `${winner.code} advanced on a bye`
        : `${winner.code} advanced (no ballots posted)`
    : "Decision not posted yet";
  return (
    <div className="text-sm">
      <div className="space-y-0.5 border-b px-4 py-3">
        <p className="font-semibold">
          {column.label}
          {matchup.letter ? <span className="font-normal text-muted-foreground"> · Section {matchup.letter}</span> : null}
        </p>
        {matchup.room ? <p className="text-xs text-muted-foreground">Room {matchup.room}</p> : null}
        <p className={cn("pt-1", winner ? "text-foreground" : "text-muted-foreground")} data-decision="">
          {decision}
        </p>
      </div>
      {matchup.ballots.length > 0 ? (
        <ul className="max-h-64 space-y-2 overflow-y-auto px-4 py-3">
          {matchup.ballots.map((ballot, index) => (
            <li key={index} className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="min-w-0 truncate font-medium">
                  <JudgeName judge={ballot.judge} source={ctx.source} />
                </span>
                {ballot.judge.chair ? <Badge variant="secondary">Chair</Badge> : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {ballot.winnerId !== null ? (
                  <>
                    Voted <span className="font-medium text-foreground">{codeOf(ballot.winnerId)}</span>
                  </>
                ) : (
                  "No decision posted"
                )}
                {ballot.points.size > 0 ? (
                  <span className="tabular-nums">
                    {" · "}
                    {matchup.entries
                      .filter((entry) => ballot.points.has(entry.id))
                      .map((entry) => `${entry.side ? (entry.side === "aff" ? "Aff" : "Neg") : entry.code} ${ballot.points.get(entry.id)}`)
                      .join(", ")}
                  </span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      ) : matchup.judges.length > 0 ? (
        <ul className="space-y-1 px-4 py-3">
          {matchup.judges.map((judge, index) => (
            <li key={index} className="flex items-center gap-1.5">
              <JudgeName judge={judge} source={ctx.source} />
              {judge.chair ? <Badge variant="secondary">Chair</Badge> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-xs text-muted-foreground">No judges posted.</p>
      )}
      <div className="border-t px-4 py-2">
        <Link href={hrefs.round(ctx.tournId, ctx.eventAbbr, column.roundName)} className="text-xs font-medium text-primary hover:underline">
          {column.label} pairings
        </Link>
      </div>
    </div>
  );
}
