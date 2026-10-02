"use client";

/**
 * @fileoverview The "open a market" form.
 *
 * - **Debate** — two sides typed by hand, or a hosted Tabroom round picked
 *   from an event, which then settles itself from the ballots.
 * - **Tournament winner** — the field typed one per line, or every entry of a
 *   hosted Tabroom event, settled from its final results.
 * - **Rating move** — a team from the Glicko rankings; settles itself at close
 *   against the rating it has now.
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import { RANKING_DATASETS, loadRankingDataset, type RankingEntry, type RankingDatasetId } from "@debate/rankings-adapter";
import { KIND_LABELS, MARKET_KINDS, type MarketKind, type NewMarket, type PredictionSourcesResponse } from "@debate/predictions";
import { createMarket, fetchPredictionSources } from "@debate/predictions/client";

import { cn } from "../../lib/ui/lib/utils";
import { inputClass } from "./MarketCard";

const labelClass = "flex flex-col gap-1 text-xs font-medium text-muted-foreground";

/** A `datetime-local` value `days` from now, in the reader's time zone. */
function localDateTime(days: number): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  date.setSeconds(0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function NewMarketForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [kind, setKind] = useState<MarketKind>("debate");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [closes, setCloses] = useState(() => localDateTime(7));
  const [hosted, setHosted] = useState(false);
  const [outcomesText, setOutcomesText] = useState("");
  const [sideA, setSideA] = useState("");
  const [sideB, setSideB] = useState("");
  const [sources, setSources] = useState<PredictionSourcesResponse | null>(null);
  const [eventId, setEventId] = useState<number | null>(null);
  const [panelId, setPanelId] = useState<number | null>(null);
  const [datasetId, setDatasetId] = useState<RankingDatasetId>("hspf");
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [teamQuery, setTeamQuery] = useState("");
  const [team, setTeam] = useState<RankingEntry | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hosted Tabroom data, loaded once the form asks for it.
  useEffect(() => {
    if (!hosted || kind === "rating") return;
    let live = true;
    fetchPredictionSources(eventId)
      .then((next) => live && setSources(next))
      .catch((cause: unknown) => live && setError(cause instanceof Error ? cause.message : "Could not load hosted tournaments."));
    return () => {
      live = false;
    };
  }, [hosted, kind, eventId]);

  useEffect(() => {
    if (kind !== "rating") return;
    let live = true;
    setEntries([]);
    setTeam(null);
    loadRankingDataset(datasetId)
      .then((dataset) => live && setEntries(dataset.entries))
      .catch(() => live && setError("Could not load the rankings."));
    return () => {
      live = false;
    };
  }, [kind, datasetId]);

  const matches = useMemo(() => {
    const query = teamQuery.trim().toLowerCase();
    const list = query
      ? entries.filter((entry) => `${entry.name} ${entry.school}`.toLowerCase().includes(query))
      : entries;
    return list.slice(0, 25);
  }, [entries, teamQuery]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    const closesAt = Math.floor(new Date(closes).getTime() / 1000);
    const request: NewMarket = { kind, title, description, closesAt };
    if (kind === "rating") {
      request.rating = team ? { dataset: datasetId, hash: team.hash } : null;
      if (!title.trim() && team) request.title = `Will ${team.name} (${team.school}) gain rating?`;
    } else if (hosted) {
      if (kind === "debate") request.tabroomPanelId = panelId;
      else request.tabroomEventId = eventId;
    } else {
      request.outcomes = kind === "debate" ? [sideA, sideB] : outcomesText.split("\n");
    }
    try {
      await createMarket(request);
      onCreated();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not open that market.");
    } finally {
      setSending(false);
    }
  }

  const selectedPanel = sources?.panels?.find((panel) => panel.id === panelId);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3" aria-label="Open a market">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          What it's about
          <select
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as MarketKind);
              setPanelId(null);
            }}
            className={cn(inputClass, "h-9")}
          >
            {MARKET_KINDS.map((option) => (
              <option key={option} value={option}>
                {KIND_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Betting closes
          <input type="datetime-local" value={closes} onChange={(event) => setCloses(event.target.value)} required className={cn(inputClass, "h-9")} />
        </label>
      </div>

      {kind !== "rating" ? (
        <div className="flex gap-4 text-sm" role="radiogroup" aria-label="Outcomes from">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={!hosted} onChange={() => setHosted(false)} /> Type them in
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={hosted} onChange={() => setHosted(true)} /> From a tournament hosted here
          </label>
        </div>
      ) : null}

      {kind === "rating" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Rankings
            <select value={datasetId} onChange={(event) => setDatasetId(event.target.value as RankingDatasetId)} className={cn(inputClass, "h-9")}>
              {RANKING_DATASETS.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.scope ? `${dataset.label} (${dataset.scope})` : dataset.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Find a team
            <input value={teamQuery} onChange={(event) => setTeamQuery(event.target.value)} placeholder="Name or school" className={cn(inputClass, "h-9")} />
          </label>
          <label className={cn(labelClass, "sm:col-span-2")}>
            Team
            <select
              value={team?.hash ?? ""}
              onChange={(event) => setTeam(entries.find((entry) => entry.hash === event.target.value) ?? null)}
              required
              className={cn(inputClass, "h-9")}
            >
              <option value="">{entries.length ? "Pick a team…" : "Loading the rankings…"}</option>
              {matches.map((entry) => (
                <option key={entry.hash} value={entry.hash}>
                  #{entry.rank} {entry.name} — {entry.school} (rating {entry.rating.toFixed(1)})
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : hosted ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Event
            <select
              value={eventId ?? ""}
              onChange={(event) => {
                setEventId(event.target.value ? Number(event.target.value) : null);
                setPanelId(null);
              }}
              required
              className={cn(inputClass, "h-9")}
            >
              <option value="">{sources ? (sources.events.length ? "Pick an event…" : "No hosted tournaments right now") : "Loading…"}</option>
              {sources?.events.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.tournament} — {option.event}
                </option>
              ))}
            </select>
          </label>
          {kind === "debate" ? (
            <label className={labelClass}>
              Round
              <select
                value={panelId ?? ""}
                onChange={(event) => {
                  const id = event.target.value ? Number(event.target.value) : null;
                  setPanelId(id);
                  const panel = sources?.panels?.find((p) => p.id === id);
                  if (panel && !title.trim()) setTitle(`Who wins ${panel.label}?`);
                }}
                required
                disabled={!eventId}
                className={cn(inputClass, "h-9")}
              >
                <option value="">{eventId ? (sources?.panels?.length ? "Pick a round…" : "No undecided rounds") : "Pick an event first"}</option>
                {sources?.panels?.map((panel) => (
                  <option key={panel.id} value={panel.id}>
                    {panel.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="self-end text-xs text-muted-foreground">
              {eventId && sources?.entries ? `${sources.entries.length} entries become the outcomes.` : null}
            </p>
          )}
          {selectedPanel ? <p className="text-xs text-muted-foreground sm:col-span-2">Outcomes: {selectedPanel.entries.map((e) => e.label).join(" or ")}</p> : null}
        </div>
      ) : kind === "debate" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            One side
            <input value={sideA} onChange={(event) => setSideA(event.target.value)} required placeholder="e.g. Aff — Falk & Sabnani" className={cn(inputClass, "h-9")} />
          </label>
          <label className={labelClass}>
            The other side
            <input value={sideB} onChange={(event) => setSideB(event.target.value)} required placeholder="e.g. Neg — Chan & Chhabra" className={cn(inputClass, "h-9")} />
          </label>
        </div>
      ) : (
        <label className={labelClass}>
          The field, one entry per line
          <textarea value={outcomesText} onChange={(event) => setOutcomesText(event.target.value)} rows={4} required className={cn(inputClass, "resize-y py-2 leading-6")} />
        </label>
      )}

      <label className={labelClass}>
        Question
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required={kind !== "rating"}
          maxLength={140}
          placeholder={kind === "rating" ? "Filled in from the team if left blank" : kind === "debate" ? "Who wins the TOC octafinal?" : "Who wins the Harvard tournament in PF?"}
          className={cn(inputClass, "h-9")}
        />
      </label>
      <label className={labelClass}>
        Details (optional)
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} maxLength={1000} className={cn(inputClass, "resize-y py-2 leading-6")} />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={sending} className="h-8 rounded-full border border-border bg-background px-3 text-xs font-medium hover:bg-accent">
          Cancel
        </button>
        <button
          type="submit"
          disabled={sending}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
          Open market
        </button>
      </div>
    </form>
  );
}
