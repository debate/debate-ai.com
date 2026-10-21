/**
 * Judge paradigms and judging records: the shapes the tournament pages show
 * when a judge's name is clicked, and the parsing that turns Tabroom's
 * answers into them. Safe to import in the browser — the fetching and the
 * HTML sanitizing that need a server live in `./paradigms-server`.
 *
 * Tabroom serves a judge two ways, both behind a signed-in Tabroom session:
 *
 * - **The API** (`indexcards`, vendored under `vendor/tabroom-build`):
 *   `GET /v1/rest/paradigms/:personId` answers `ParadigmDetails`
 *   (`{ id, name, lastReviewed, paradigm, certifications }`, `paradigm`
 *   being HTML) and `GET /v1/rest/paradigms/:personId/record` answers
 *   `JudgeRecord[]`, one row per panel the judge sat on. See
 *   `vendor/.../controllers/rest/paradigmsController.ts` and
 *   `services/results/judgeRecords.js`.
 * - **The classic page**, `www.tabroom.com/index/paradigm.mhtml?judge_person_id=N`
 *   (`web/index/paradigm.mhtml` + `paradigm.mas` in speechanddebate/tabroom):
 *   the paradigm in `<div class="paradigm …">` and the record in
 *   `<table id="judgerecord">`. {@link parseClassicParadigmPage} reads it.
 */

/** One round a judge decided, as Tabroom's `JudgeRecord` has it. */
export interface JudgeRecordRow {
  Tourn: { id: number | string; name: string };
  /** ISO date of the tournament (Tabroom dates the round by its tournament). */
  roundDate: string;
  /** e.g. `"R2"`, `"Quarters"`. */
  roundLabel: string;
  eventAbbr: string;
  affTeam: string;
  affLabel: string;
  negTeam: string;
  negLabel: string;
  /** This judge's vote, as a side label (`"Aff"`, `"Pro"`, …); empty when unknown. */
  vote: string;
  /** The panel's decision, as a side label, or `"Tie"`. */
  panelVote: string;
  /** Ballots aff-neg, e.g. `"2-1"`. */
  record: string;
}

/** A certification badge a judge holds on Tabroom. */
export interface JudgeCertification {
  label: string;
  description?: string | null;
}

/** Where a {@link JudgeProfile}'s Tabroom half came from. */
export type JudgeProfileSource = "tabroom-api" | "tabroom-page" | "hosted" | "none";

/** A judge's paradigm and judging record, as the judge dialog shows them. */
export interface JudgeProfile {
  /** Tabroom person id, when the judge has been matched to one. */
  personId: number | null;
  name: string;
  /** The Tabroom paradigm as sanitized HTML, or `null` when there is none. */
  paradigmHtml: string | null;
  /** The paradigm as plain text, paragraphs split by blank lines, where no sanitized HTML is at hand. */
  paradigmText?: string | null;
  /** When Tabroom says the paradigm was last reviewed (ISO, or Tabroom's own wording). */
  lastReviewed: string | null;
  record: JudgeRecordRow[];
  certifications: JudgeCertification[];
  /**
   * A paradigm the judge wrote on this site. Shown in place of the Tabroom
   * one only once the account is verified as this Tabroom person.
   */
  ownParadigm?: { html: string; updatedAt: string } | null;
  source: JudgeProfileSource;
  /** When the Tabroom half was fetched (ISO); `null` when it never was. */
  syncedAt: string | null;
  /** The cached copy is older than the refresh window and Tabroom could not be reached. */
  stale?: boolean;
  /** Why Tabroom had nothing, for the dialog to say (e.g. "Tabroom sign-in is not configured"). */
  note?: string | null;
}

/** Counts across a judging record. */
export interface JudgeRecordSummary {
  rounds: number;
  /** Rounds where the judge's vote went to the aff (or pro / gov) side. */
  affVotes: number;
  negVotes: number;
  /** Rounds judged on a panel (more than one ballot). */
  panels: number;
  /** Panel rounds where the judge was the lone dissent. */
  squirrels: number;
  /** Rounds per event abbreviation, most first. */
  events: Array<{ event: string; rounds: number }>;
  /** The most recent tournament judged, if any. */
  latest: { name: string; date: string } | null;
}

/** Ballots on a panel from its `"aff-neg"` record; `null` when unreadable. */
function ballots(record: string): { aff: number; neg: number } | null {
  const match = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(record);
  return match ? { aff: Number(match[1]), neg: Number(match[2]) } : null;
}

/** Tallies a judging record: sides voted for, panels, squirrels and events. */
export function summarizeJudgeRecord(rows: readonly JudgeRecordRow[]): JudgeRecordSummary {
  let affVotes = 0;
  let negVotes = 0;
  let panels = 0;
  let squirrels = 0;
  const events = new Map<string, number>();
  for (const row of rows) {
    if (row.vote && row.vote === row.affLabel) affVotes++;
    else if (row.vote && row.vote === row.negLabel) negVotes++;
    const count = ballots(row.record);
    if (count && count.aff + count.neg > 1) {
      panels++;
      // A lone dissent: the judge's side got exactly one ballot and lost.
      const mine = row.vote === row.affLabel ? count.aff : row.vote === row.negLabel ? count.neg : 0;
      if (row.vote && row.panelVote !== "Tie" && row.vote !== row.panelVote && mine === 1) squirrels++;
    }
    const event = row.eventAbbr.trim() || "—";
    events.set(event, (events.get(event) ?? 0) + 1);
  }
  const latest = rows.reduce<JudgeRecordRow | null>((best, row) => (!best || row.roundDate > best.roundDate ? row : best), null);
  return {
    rounds: rows.length,
    affVotes,
    negVotes,
    panels,
    squirrels,
    events: [...events].map(([event, rounds]) => ({ event, rounds })).sort((a, b) => b.rounds - a.rounds || a.event.localeCompare(b.event)),
    latest: latest ? { name: latest.Tourn.name, date: latest.roundDate } : null,
  };
}

const str = (value: unknown) => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");

/** Reads `GET /rest/paradigms/:id/record`'s body, dropping anything that isn't a record row. */
export function readJudgeRecord(body: unknown): JudgeRecordRow[] {
  if (!Array.isArray(body)) return [];
  const rows: JudgeRecordRow[] = [];
  for (const item of body) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const tourn = (row.Tourn ?? {}) as Record<string, unknown>;
    rows.push({
      Tourn: { id: typeof tourn.id === "number" ? tourn.id : str(tourn.id), name: str(tourn.name) },
      roundDate: str(row.roundDate),
      roundLabel: str(row.roundLabel),
      eventAbbr: str(row.eventAbbr),
      affTeam: str(row.affTeam),
      affLabel: str(row.affLabel) || "Aff",
      negTeam: str(row.negTeam),
      negLabel: str(row.negLabel) || "Neg",
      vote: str(row.vote),
      panelVote: str(row.panelVote),
      record: str(row.record),
    });
  }
  return rows;
}

/** What `GET /rest/paradigms/:id` answers, narrowed to what the dialog reads. */
export interface ParadigmDetails {
  id: number;
  name: string | null;
  lastReviewed: string | null;
  paradigm: string | null;
  certifications: JudgeCertification[];
}

/** Reads `GET /rest/paradigms/:id`'s body; `null` when it isn't one. */
export function readParadigmDetails(body: unknown): ParadigmDetails | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  if (typeof value.id !== "number") return null;
  const certifications = Array.isArray(value.certifications)
    ? value.certifications.flatMap((cert) => {
        const c = cert as Record<string, unknown> | null;
        return c && typeof c.label === "string" ? [{ label: c.label, description: typeof c.description === "string" ? c.description : null }] : [];
      })
    : [];
  return {
    id: value.id,
    name: typeof value.name === "string" ? value.name : null,
    lastReviewed: typeof value.lastReviewed === "string" ? value.lastReviewed : null,
    paradigm: typeof value.paradigm === "string" && value.paradigm.trim() ? value.paradigm : null,
    certifications,
  };
}

const decode = (text: string) =>
  text
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&");

/** The visible text of an HTML fragment, whitespace collapsed. */
export function htmlText(html: string): string {
  return decode(html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** An HTML fragment as plain text, one paragraph per block or line break, separated by blank lines. */
export function htmlParagraphs(html: string): string {
  return html
    .split(/<\/(?:p|div|li|h[1-6]|blockquote|tr)>|<br\s*\/?>/i)
    .map(htmlText)
    .filter(Boolean)
    .join("\n\n");
}

/**
 * The inner HTML of the element whose opening tag starts at `start`,
 * balancing nested tags of the same name. `null` when it never closes.
 */
function innerOf(html: string, start: number, tag: string): string | null {
  const open = html.indexOf(">", start);
  if (open === -1) return null;
  const pattern = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  pattern.lastIndex = open + 1;
  let depth = 1;
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return html.slice(open + 1, match.index);
  }
  return null;
}

/** Whether a classic Tabroom page is its login page rather than what was asked for. */
export function isTabroomLoginPage(html: string): boolean {
  return /\/user\/login\/login\.mhtml|name=["']?password["']?/i.test(html) && !/id=["']?judgerecord/i.test(html);
}

/** The Result cell's winner-first count (`"2-1"` for a Neg win) in aff-neg order, like the API's. */
function ballotsAffNeg(count: string | undefined, panelVote: string): string | null {
  const match = /^(\d+)\s*-\s*(\d+)$/.exec(count ?? "");
  if (!match) return null;
  return /^(neg|con|opp)/i.test(panelVote) ? `${match[2]}-${match[1]}` : `${match[1]}-${match[2]}`;
}

/** What the classic paradigm page holds. */
export interface ClassicParadigmPage {
  name: string | null;
  /** Raw (unsanitized) paradigm HTML. */
  paradigmHtml: string | null;
  lastReviewed: string | null;
  record: JudgeRecordRow[];
}

/**
 * Reads `tabroom.com/index/paradigm.mhtml?judge_person_id=N`: the judge's
 * name (the page's `<h3>`), the paradigm statement, its "Last reviewed on"
 * line and the "Full Judging Record" table — whose columns are Tournament,
 * Lv, Date, Ev, Rd, Aff, Neg, Vote, Result (`paradigm.mas`). The Result
 * cell holds the panel's side and ballot count, winner first (`"Neg 2-1"`),
 * which is turned around to the API's aff-neg order (`"1-2"`).
 */
export function parseClassicParadigmPage(html: string): ClassicParadigmPage {
  const main = html.slice(Math.max(0, html.search(/<div\b[^>]*class=["'][^"']*\bmain\b/i)));
  const nameMatch = /<h3\b[^>]*>([\s\S]*?)<\/h3>/i.exec(main);
  const name = nameMatch ? htmlText(nameMatch[1]) || null : null;

  // The statement is `<div class="paradigm ltborderbottom">`; its wrapper,
  // `<div class="screens paradigm">`, is the tab and also holds the heading.
  let paradigmHtml: string | null = null;
  const statement = /<div\b[^>]*class=["']paradigm(?:\s[^"']*)?["'][^>]*>/i.exec(main);
  if (statement) {
    const inner = innerOf(main, statement.index, "div");
    if (inner && htmlText(inner)) paradigmHtml = inner.trim();
  }

  const reviewed = /Last reviewed on([\s\S]*?)<\/span>/i.exec(main);
  const lastReviewed = reviewed ? htmlText(reviewed[1]) || null : null;

  const record: JudgeRecordRow[] = [];
  const table = /<table\b[^>]*id=["']?judgerecord["']?[^>]*>([\s\S]*?)<\/table>/i.exec(main);
  const body = table ? (/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i.exec(table[1])?.[1] ?? table[1]) : "";
  for (const [row] of body.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
    if (cells.length < 9) continue;
    // Sort keys Tabroom hides in the date and round cells.
    const visible = (cell: string) => htmlText(cell.replace(/<span\b[^>]*class=["']hidden["'][^>]*>[\s\S]*?<\/span>/gi, " "));
    const tournId = /tourn_id=(\d+)/.exec(cells[0])?.[1];
    const result = visible(cells[8]);
    const resultMatch = /^(.*?)\s*(\d+\s*-\s*\d+)?$/.exec(result);
    const vote = visible(cells[7]);
    const panelVote = resultMatch?.[1]?.trim() || vote;
    record.push({
      Tourn: { id: tournId ? Number(tournId) : "", name: visible(cells[0]) },
      roundDate: visible(cells[2]),
      roundLabel: visible(cells[4]),
      eventAbbr: visible(cells[3]),
      affTeam: visible(cells[5]),
      affLabel: "Aff",
      negTeam: visible(cells[6]),
      negLabel: "Neg",
      vote,
      panelVote,
      record: ballotsAffNeg(resultMatch?.[2], panelVote) ?? (vote ? (/^(aff|pro|gov|prop)/i.test(vote) ? "1-0" : "0-1") : ""),
    });
  }
  // Classic pages print the event's own side labels as the vote; label each
  // row's sides with whichever two labels its votes use, defaulting to Aff/Neg.
  for (const row of record) {
    if (row.vote && !/^(aff|neg)$/i.test(row.vote)) {
      if (/^(pro|gov|prop)/i.test(row.vote)) row.affLabel = row.vote;
      else row.negLabel = row.vote;
    }
    if (row.panelVote && !/^(aff|neg|tie)$/i.test(row.panelVote)) {
      if (/^(pro|gov|prop)/i.test(row.panelVote)) row.affLabel = row.panelVote;
      else row.negLabel = row.panelVote;
    }
  }
  return { name, paradigmHtml, lastReviewed, record };
}

/** Tabroom's public paradigm page for a judge. */
export function tabroomParadigmPageUrl(personId: number): string {
  return `https://www.tabroom.com/index/paradigm.mhtml?judge_person_id=${personId}`;
}
