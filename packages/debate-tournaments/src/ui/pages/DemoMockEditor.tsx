"use client";

/**
 * The demo tournament's mock-data editor, shown on its admin view only: edit
 * entries, judges, rounds, each section's judges and winner, and result sets,
 * or reset everything to the seed. Writes go to `{apiBase}/host/demo/*` (see
 * `../../host/demo-edit`), which only ever touch the demo's own rows — never
 * a hosted tournament or Tabroom data.
 */

import { useMemo, useState, type ReactNode } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import type { DemoEdit, DemoSection, TournamentAdmin } from "../client";
import { Badge, Button, Card, Input, Label, Select, tabsListClass, tabsTriggerClass } from "../primitives";
import { Empty, ErrorNote, Loaded, Section, useApi, useTournaments } from "../shared";

type MockTab = "entries" | "judges" | "rounds" | "pairings" | "results";

const TABS: Array<[MockTab, string]> = [
  ["entries", "Entries"],
  ["judges", "Judges"],
  ["rounds", "Rounds"],
  ["pairings", "Pairings"],
  ["results", "Result sets"],
];

/** Rows listed at once; the filter narrows the rest. */
const PAGE = 40;

type Save = (edit: DemoEdit) => Promise<void>;

export function DemoMockEditor({ view, onChanged }: { view: TournamentAdmin; onChanged: () => Promise<void> | void }) {
  const { client } = useTournaments();
  const [tab, setTab] = useState<MockTab>("entries");
  const [error, setError] = useState<Error | null>(null);
  const [resetting, setResetting] = useState(false);
  /** Bumped after every save, so the pairings list reloads. */
  const [version, setVersion] = useState(0);

  const save: Save = async (edit) => {
    setError(null);
    try {
      await client.editDemo(edit);
      setVersion((v) => v + 1);
      await onChanged();
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  };

  const reset = async () => {
    if (typeof window !== "undefined" && !window.confirm("Reset the demo tournament to its original mock data? Every edit is lost.")) return;
    setResetting(true);
    setError(null);
    try {
      await client.resetDemo();
      setVersion((v) => v + 1);
      await onChanged();
    } catch (e) {
      setError(e as Error);
    } finally {
      setResetting(false);
    }
  };

  return (
    <Section
      title="Edit mock data"
      actions={
        <Button variant="outline" onClick={reset} disabled={resetting}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          {resetting ? "Resetting…" : "Reset demo data"}
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Pencil className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Change the demo&apos;s entries, judges, rounds, pairings and results to try things out. Edits only touch this demo
          tournament, are shared by everyone browsing it, and last until it is reset.
        </p>
        {error ? <ErrorNote error={error} /> : null}
        <nav className={tabsListClass} aria-label="Mock data">
          {TABS.map(([key, label]) => (
            <button key={key} type="button" className={tabsTriggerClass(key === tab)} aria-pressed={key === tab} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </nav>
        {tab === "entries" ? <EntriesEditor view={view} save={save} /> : null}
        {tab === "judges" ? <JudgesEditor view={view} save={save} /> : null}
        {tab === "rounds" ? <RoundsEditor view={view} save={save} /> : null}
        {tab === "pairings" ? <PairingsEditor view={view} save={save} version={version} /> : null}
        {tab === "results" ? <ResultSetsEditor view={view} save={save} /> : null}
      </div>
    </Section>
  );
}

/** A filter box and the first {@link PAGE} rows matching it. */
function Filtered<T>({ items, text, render, empty }: { items: T[]; text: (item: T) => string; render: (item: T) => ReactNode; empty: string }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((item) => text(item).toLowerCase().includes(q)) : items;
  }, [items, query, text]);
  if (items.length === 0) return <Empty>{empty}</Empty>;
  return (
    <div className="space-y-2">
      <Input placeholder="Filter…" aria-label="Filter" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" />
      <div className="space-y-2">{matches.slice(0, PAGE).map(render)}</div>
      {matches.length > PAGE ? (
        <p className="text-xs text-muted-foreground">
          Showing {PAGE} of {matches.length}. Filter to find the rest.
        </p>
      ) : null}
    </div>
  );
}

/**
 * One editable row: its fields start at `initial`, and Save sends only the
 * fields that changed.
 */
function EditRow<F extends Record<string, string | boolean>>({
  title,
  initial,
  fields,
  onSave,
}: {
  title: ReactNode;
  initial: F;
  fields: (values: F, set: <K extends keyof F>(key: K, value: F[K]) => void) => ReactNode;
  onSave: (changed: Partial<F>) => Promise<void>;
}) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const changed = Object.fromEntries(Object.entries(values).filter(([key, value]) => initial[key] !== value)) as Partial<F>;
  const dirty = Object.keys(changed).length > 0;
  const set = <K extends keyof F>(key: K, value: F[K]) => setValues((v) => ({ ...v, [key]: value }));
  return (
    <Card className="flex flex-wrap items-end gap-3 px-4 py-3">
      <div className="min-w-32 text-sm font-medium">{title}</div>
      {fields(values, set)}
      <div className="ml-auto flex gap-2">
        {dirty ? (
          <Button variant="ghost" onClick={() => setValues(initial)} disabled={saving}>
            Undo
          </Button>
        ) : null}
        <Button
          disabled={!dirty || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(changed);
            } catch {
              // Shown by the editor's error note.
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex h-9 items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

const ENTRY_STATUSES = ["active", "unconfirmed", "waitlist", "dropped"] as const;

function EntriesEditor({ view, save }: { view: TournamentAdmin; save: Save }) {
  return (
    <Filtered
      items={view.entries}
      empty="No entries."
      text={(e) => [e.code, e.name, e.eventAbbr, e.schoolName].join(" ")}
      render={(e) => (
        <EditRow
          key={`${e.id}:${e.code}:${e.name}:${e.status}`}
          title={
            <>
              {e.eventAbbr ? <Badge variant="outline">{e.eventAbbr}</Badge> : null} <span className="text-muted-foreground">{e.schoolName}</span>
            </>
          }
          initial={{ code: e.code ?? "", name: e.name ?? "", status: e.status as string }}
          onSave={(changed) => save({ kind: "entry", id: e.id, ...changed } as DemoEdit)}
          fields={(v, set) => (
            <>
              <Field label="Code">
                <Input value={v.code} onChange={(ev) => set("code", ev.target.value)} className="w-32" />
              </Field>
              <Field label="Name">
                <Input value={v.name} onChange={(ev) => set("name", ev.target.value)} className="w-56" />
              </Field>
              <Field label="Status">
                <Select value={v.status} onChange={(ev) => set("status", ev.target.value)} className="w-36 capitalize">
                  {ENTRY_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}
        />
      )}
    />
  );
}

function JudgesEditor({ view, save }: { view: TournamentAdmin; save: Save }) {
  return (
    <Filtered
      items={view.judges}
      empty="No judges."
      text={(j) => [j.code, j.name, j.schoolName].join(" ")}
      render={(j) => (
        <EditRow
          key={`${j.id}:${j.code}:${j.first}:${j.last}:${j.active}`}
          title={<span className="text-muted-foreground">{j.schoolName ?? "Hired"}</span>}
          initial={{ first: j.first ?? "", last: j.last ?? "", code: j.code ?? "", active: j.active }}
          onSave={(changed) => save({ kind: "judge", id: j.id, ...changed })}
          fields={(v, set) => (
            <>
              <Field label="First">
                <Input value={v.first} onChange={(ev) => set("first", ev.target.value)} className="w-36" />
              </Field>
              <Field label="Last">
                <Input value={v.last} onChange={(ev) => set("last", ev.target.value)} className="w-36" />
              </Field>
              <Field label="Code">
                <Input value={v.code} onChange={(ev) => set("code", ev.target.value)} className="w-20" />
              </Field>
              <Toggle label="Active" checked={v.active} onChange={(checked) => set("active", checked)} />
            </>
          )}
        />
      )}
    />
  );
}

function RoundsEditor({ view, save }: { view: TournamentAdmin; save: Save }) {
  return (
    <Filtered
      items={view.rounds}
      empty="No rounds."
      text={(r) => [r.eventAbbr, r.label, `Round ${r.name}`].join(" ")}
      render={(r) => (
        <EditRow
          key={`${r.id}:${r.label}:${r.published}:${r.resultsPosted}`}
          title={<Badge variant="outline">{r.eventAbbr}</Badge>}
          initial={{ label: r.label ?? "", published: r.published, resultsPosted: r.resultsPosted }}
          onSave={(changed) => save({ kind: "round", id: r.id, ...changed })}
          fields={(v, set) => (
            <>
              <Field label="Label">
                <Input value={v.label} placeholder={`Round ${r.name}`} onChange={(ev) => set("label", ev.target.value)} className="w-44" />
              </Field>
              <Toggle label="Pairings published" checked={v.published} onChange={(checked) => set("published", checked)} />
              <Toggle label="Results posted" checked={v.resultsPosted} onChange={(checked) => set("resultsPosted", checked)} />
            </>
          )}
        />
      )}
    />
  );
}

function ResultSetsEditor({ view, save }: { view: TournamentAdmin; save: Save }) {
  return (
    <Filtered
      items={view.resultSets}
      empty="No result sets."
      text={(r) => [r.eventAbbr, r.label].join(" ")}
      render={(r) => (
        <EditRow
          key={`${r.id}:${r.label}:${r.published}`}
          title={r.eventAbbr ? <Badge variant="outline">{r.eventAbbr}</Badge> : null}
          initial={{ label: r.label ?? "", published: r.published }}
          onSave={(changed) => save({ kind: "resultSet", id: r.id, ...changed })}
          fields={(v, set) => (
            <>
              <Field label="Label">
                <Input value={v.label} onChange={(ev) => set("label", ev.target.value)} className="w-56" />
              </Field>
              <Toggle label="Published" checked={v.published} onChange={(checked) => set("published", checked)} />
            </>
          )}
        />
      )}
    />
  );
}

const roundTitle = (r: TournamentAdmin["rounds"][number]) => `${r.eventAbbr} · ${r.label || `Round ${r.name}`}`;

function PairingsEditor({ view, save, version }: { view: TournamentAdmin; save: Save; version: number }) {
  const { client } = useTournaments();
  const [roundId, setRoundId] = useState<number | null>(view.rounds[0]?.id ?? null);
  if (roundId === null) return <Empty>No rounds.</Empty>;
  return (
    <div className="space-y-3">
      <Field label="Round">
        <Select value={roundId} onChange={(e) => setRoundId(Number(e.target.value))} className="max-w-xs">
          {view.rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {roundTitle(r)}
            </option>
          ))}
        </Select>
      </Field>
      <SectionsList key={roundId} roundId={roundId} view={view} save={save} version={version} load={(signal) => client.demoSections(roundId, signal)} />
    </div>
  );
}

function SectionsList({
  roundId,
  view,
  save,
  version,
  load,
}: {
  roundId: number;
  view: TournamentAdmin;
  save: Save;
  version: number;
  load: (signal: AbortSignal) => Promise<DemoSection[]>;
}) {
  const state = useApi(`demo-sections:${roundId}:${version}`, load);
  return (
    <Loaded state={state}>
      {(sections) =>
        sections.length === 0 ? (
          <Empty>No sections in this round.</Empty>
        ) : (
          <div className="space-y-2">
            {sections.map((section) => (
              <SectionRow key={section.id} section={section} view={view} save={save} />
            ))}
          </div>
        )
      }
    </Loaded>
  );
}

const sideLabel = (side: number | null) => (side === 1 ? "Aff" : side === 2 ? "Neg" : null);

function SectionRow({ section, view, save }: { section: DemoSection; view: TournamentAdmin; save: Save }) {
  const [busy, setBusy] = useState(false);
  const run = async (edit: DemoEdit) => {
    setBusy(true);
    try {
      await save(edit);
    } catch {
      // Shown by the editor's error note.
    } finally {
      setBusy(false);
    }
  };
  const winner = section.entries.find((e) => e.scored > 0 && e.wins * 2 > e.scored);
  const debate = section.entries.length === 2 && section.entries.every((e) => e.side === 1 || e.side === 2);
  return (
    <Card className="space-y-2 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Section {section.letter ?? section.id}</span>
        {section.room ? <span className="text-muted-foreground">{section.room}</span> : null}
        {section.bye ? <Badge variant="outline">Bye</Badge> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {section.entries.map((e) => (
          <Badge key={e.id} variant={winner?.id === e.id ? "default" : "outline"}>
            {sideLabel(e.side) ? `${sideLabel(e.side)} ` : ""}
            {e.code ?? e.id}
            {winner?.id === e.id ? " · won" : ""}
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {section.judges.map((judge) => (
          <Field key={judge.id} label="Judge">
            <Select
              value={judge.id}
              disabled={busy}
              onChange={(e) => run({ kind: "section", id: section.id, fromJudgeId: judge.id, judgeId: Number(e.target.value) })}
              className="w-56"
            >
              {view.judges.map((j) => (
                <option key={j.id} value={j.id}>
                  {[j.code, j.name].filter(Boolean).join(" ")}
                </option>
              ))}
            </Select>
          </Field>
        ))}
        {debate ? (
          <Field label="Winner">
            <Select
              value={winner?.id ?? ""}
              disabled={busy}
              onChange={(e) => e.target.value && run({ kind: "section", id: section.id, winnerEntryId: Number(e.target.value) })}
              className="w-44"
            >
              <option value="">Not decided</option>
              {section.entries.map((e) => (
                <option key={e.id} value={e.id}>
                  {sideLabel(e.side)} {e.code ?? e.id}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>
    </Card>
  );
}
