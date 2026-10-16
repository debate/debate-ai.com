"use client";

/**
 * The Debate Majors season calendar, rebuilt from the standalone
 * `debate-majors-a-to-z.html` page as a React component. Weeks A–Y run
 * Monday–Sunday from September 1, 2026 through February 21, 2027, and week Z
 * groups the season-ending championships (March–June) rather than one calendar
 * week; championship tournaments land in Z regardless of their date range, and
 * undated non-championships drop to the planning-windows strip below.
 *
 * The page's `data` array is now `DEBATE_MAJORS` in `./data`, so the calendar and
 * the circuit judge pool stay on one copy; a test fails if they drift.
 */

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn, Input, Select } from "../primitives";
import { CHAMPIONSHIP_IDS, DEBATE_MAJORS, type DebateMajor } from "./data";

type Circuit = "All" | "LD" | "PF" | "NDT" | "CX";
const CIRCUIT_FILTERS: readonly Circuit[] = ["All", "LD", "PF", "NDT", "CX"];

const TONES: Record<Exclude<Circuit, "All">, string> = {
  LD: "bg-violet-400/15 text-violet-300",
  PF: "bg-sky-400/15 text-sky-300",
  NDT: "bg-amber-400/15 text-amber-300",
  CX: "bg-rose-400/15 text-rose-300",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** The page's `dt(s)`: local-noon Date, so weekday math lands on the calendar day. */
function dt(iso: string): Date {
  return new Date(iso + "T12:00:00");
}

/** Local YYYY-MM-DD, matching the page's `iso()` helper. */
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Apr 17, 2027". */
function full(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface Week {
  start: Date;
  end: Date;
  number: number;
}

const SEASON_END = dt("2027-02-21");

/** The 25 lettered weeks (A–Y) then the championship week (Z) at index 25. */
const SEASON_WEEKS: readonly Week[] = (() => {
  const weeks: Week[] = [];
  for (let start = dt("2026-09-01"); start <= SEASON_END; ) {
    let end = new Date(start);
    end.setDate(start.getDate() + ((7 - start.getDay()) % 7));
    if (end > SEASON_END) end = new Date(SEASON_END);
    weeks.push({ start: new Date(start), end: new Date(end), number: weeks.length + 1 });
    start = new Date(end);
    start.setDate(start.getDate() + 1);
  }
  weeks.push({ start: dt("2027-03-01"), end: dt("2027-06-30"), number: 26 });
  return weeks;
})();

/** Week index a major belongs to: 25 for championships, -1 for undated non-championships, else its best-overlap lettered week. */
function weekOf(major: DebateMajor): number {
  if (CHAMPIONSHIP_IDS.has(major.id)) return 25;
  if (!major.start) return -1;
  let best = -1;
  let max = 0;
  for (let i = 0; i < 25; i++) {
    const { start, end } = SEASON_WEEKS[i];
    let overlap = 0;
    for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      const s = iso(day);
      if (s >= major.start && s <= major.end) overlap++;
    }
    if (overlap > max) {
      max = overlap;
      best = i;
    }
  }
  return best;
}

function toneFor(circuit: Circuit, major: DebateMajor): string {
  const key = circuit === "All" ? major.formats[0] : circuit;
  return (TONES as Record<string, string>)[key] ?? "bg-slate-400/15 text-slate-300";
}

function StatusBadge({ status }: { status: DebateMajor["status"] }) {
  const dot = status === "published" ? "●" : status === "provisional" ? "◌" : "◇";
  const color = status === "published" ? "text-lime-300" : status === "provisional" ? "text-amber-300" : "text-slate-400";
  return (
    <span className={cn("text-[9px] uppercase font-bold", color)}>
      {dot} {status}
    </span>
  );
}

/** A tournament square in a week column, or in the pending strip. */
function MajorButton({ major, circuit, onSelect }: { major: DebateMajor; circuit: Circuit; onSelect: (m: DebateMajor) => void }) {
  const isPending = !major.start;
  return (
    <button
      type="button"
      data-id={major.id}
      onClick={() => onSelect(major)}
      className={cn(
        "w-full text-left rounded-xl p-4",
        isPending ? "border border-slate-800 bg-slate-900/40" : "border border-transparent",
        toneFor(circuit, major),
        major.status === "provisional" && !isPending ? "border-dashed border-amber-400/50" : "",
      )}
    >
      <StatusBadge status={major.status} />
      {major.note.includes("CONFLICT") ? <span className="text-[9px] text-amber-300"> ⚠ Conflict</span> : null}
      <div className="font-semibold text-xs mt-1">{major.name}</div>
      <div className="text-[10px] opacity-75 mt-1">
        {major.formats.join(" / ")} · {major.start ? `${full(dt(major.start))} – ${full(dt(major.end))}` : major.note}
      </div>
    </button>
  );
}

function DetailModal({ major, close }: { major: DebateMajor; close: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const week = weekOf(major);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [close]);

  return createPortal(
    <section
      ref={panelRef as React.Ref<HTMLElement>}
      tabIndex={-1}
      aria-label="Tournament details"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 outline-none"
      onClick={close}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close details"
          onClick={close}
          className="absolute top-3 right-3 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:text-slate-200"
        >
          <X aria-hidden />
        </button>
        <StatusBadge status={major.status} />
        <h2 className="text-2xl font-bold mt-3">{major.name}</h2>
        <p className="text-slate-400 mt-2">{major.formats.join(" / ")}</p>
        <p className="mt-5 font-semibold">
          {major.start ? `${full(dt(major.start))} through ${full(dt(major.end))}` : "Exact dates unresolved"}
        </p>
        {week >= 0 ? (
          <p className="text-sm text-lime-300 mt-2">
            Shown in {String.fromCharCode(65 + week)}{week === 25 ? " · Championships" : ""}
          </p>
        ) : null}
        <p className="text-sm text-slate-400 mt-3">{major.note}</p>
        <a
          className="inline-block text-lime-300 underline text-sm mt-5"
          target="_blank"
          rel="noopener noreferrer"
          href={major.source}
        >
          Open date source ↗
        </a>
      </div>
    </section>,
    document.body,
  );
}

export interface DebateMajorsCalendarProps {
  /** Caption under the heading; defaults to the season range line. */
  caption?: string;
}

export function DebateMajorsCalendar({ caption }: DebateMajorsCalendarProps) {
  const [circuit, setCircuit] = useState<Circuit>("All");
  const [status, setStatus] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [today, setToday] = useState("");
  const [selected, setSelected] = useState<DebateMajor | null>(null);

  // Only highlight the current week on the client, so server and client HTML
  // never disagree about which week is "today".
  useEffect(() => setToday(iso(new Date())), []);

  const list = useMemo(
    () =>
      DEBATE_MAJORS.filter(
        (e) =>
          (circuit === "All" || e.formats.includes(circuit)) &&
          (status === "all" || status === e.status) &&
          `${e.name} ${e.note}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [circuit, status, query],
  );

  const pending = useMemo(
    () => list.filter((e) => !e.start && !CHAMPIONSHIP_IDS.has(e.id)),
    [list],
  );

  return (
    <main className="max-w-7xl mx-auto p-4 sm:p-8">
      <header className="border-b border-slate-800 pb-5 flex justify-between">
        <strong>
          CIRCUIT<span className="text-lime-400">/</span>CAL
        </strong>
        <span className="text-slate-500">2026–27</span>
      </header>

      <section className="py-8">
        <p className="text-lime-400 uppercase tracking-widest text-xs">The whole season at a glance</p>
        <h1 className="text-5xl font-black mt-3">Debate majors.</h1>
        <p className="text-slate-400 mt-4">
          {caption ?? "September 2026 – June 2027 · Weeks A–Y + Z championships · One placement per tournament"}
        </p>
      </section>

      <div className="flex flex-wrap gap-2 sticky top-0 z-10 bg-[#080d18]/95 py-4">
        <div className="flex gap-2">
          {CIRCUIT_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              data-filter={f}
              aria-pressed={f === circuit}
              onClick={() => setCircuit(f)}
              className={cn(
                "px-3 py-2 text-sm rounded-lg font-bold",
                f === circuit ? "bg-lime-400 text-slate-950" : "bg-slate-900 text-slate-400",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Date status">
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="provisional">Provisional</option>
          <option value="estimated">Estimated</option>
        </Select>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tournament…"
          aria-label="Search tournament"
          className="bg-slate-900 w-full sm:ml-auto sm:w-64"
        />
      </div>

      <div className="border border-slate-800 rounded-xl p-4 text-xs text-slate-400 mb-6">
        A is September 1–6, 2026; B–Y run Monday–Sunday through February 21, 2027. Z groups all
        season-ending championships, not a single calendar week. Every square shows its dates, and
        every tournament retains its own date range. Undated championships remain in Z with estimated
        windows; other undated events remain below.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {SEASON_WEEKS.map((w, i) => {
          const hits = list.filter((e) => weekOf(e) === i).sort((a, b) => (a.start || "2027-99").localeCompare(b.start || "2027-99"));
          const current = today && iso(w.start) <= today && iso(w.end) >= today;
          const isChamp = i === 25;
          return (
            <section
              key={i}
              className={cn(
                "min-h-[170px] p-3 border rounded-xl space-y-2 mt-3",
                current ? "border-lime-400/50 bg-lime-400/5" : "border-slate-800 bg-slate-900/40",
              )}
            >
              <div className="flex justify-between">
                <h2 className={cn("text-lg font-black", current ? "text-lime-300" : "text-slate-200")}>
                  {String.fromCharCode(65 + i)}
                  {isChamp ? " · Championships" : ""}
                </h2>
                <span className="text-xs text-slate-500 pt-1">{hits.length || ""}</span>
              </div>
              <p className="text-[10px] text-slate-500">
                {isChamp ? "March–June 2027 · Multiple dates" : `${full(w.start)} – ${full(w.end)}`}
              </p>
              <div className="space-y-2">
                {hits.length ? (
                  hits.map((e) => (
                    <MajorButton key={e.id} major={e} circuit={circuit} onSelect={setSelected} />
                  ))
                ) : (
                  <p className="text-[10px] text-slate-600">No matching events</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">Estimated planning windows</h2>
        <p className="text-sm text-slate-500 mt-2">Non-championship events without exact dates. Estimated championships appear in Z.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {pending.length ? (
            pending.map((e) => <MajorButton key={e.id} major={e} circuit={circuit} onSelect={setSelected} />)
          ) : (
            <p className="text-slate-500">No matching estimated windows.</p>
          )}
        </div>
      </section>

      <footer className="text-xs text-slate-500 border-t border-slate-800 mt-10 pt-5">
        User-supplied schedule research; not live or an official ranking. NDT = college policy; CX = high-school policy. Published ranges may not apply to every circuit. Reconfirm with organizers.
      </footer>

      {selected ? <DetailModal major={selected} close={() => setSelected(null)} /> : null}
    </main>
  );
}
