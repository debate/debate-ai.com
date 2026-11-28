#!/usr/bin/env bun
// Scrape the top OpenAlex scholars by h-index through the REST API (cursor paging),
// then derive each scholar's disciplines from the `topics` returned with them and
// write a ranked, scored top-N list for every field (26) and subfield (~252).
//
//   export OPENALEX_API_KEY=your_free_key     # free key: https://openalex.org
//   bun scholar-rank.ts                       # scrape + classify + write, resumable
//
// Options:
//   --top N          how many top scholars to scrape (default 100000)
//   --min-h N        only authors with h-index > N (default 10)
//   --limit N        top N per discipline in output (default 500)
//   --any-field      list an author under every discipline they publish in
//   --out DIR        output dir (default ./out)
//   --api-key KEY    API key (or env OPENALEX_API_KEY)
//   --classify-only  skip scraping, rebuild JSON from out/authors.ndjson
//   --fresh          delete scraped data + cursor and start over
//
// Output (out/):
//   authors.ndjson   every scraped scholar, appended page by page (the raw scrape)
//   cursor.json      resume point
//   fields/<id>_<name>.json, subfields/<id>_<name>.json, results.json   (rebuilt every 30s)
//   progress.json, run.log, errors.log
import fs from 'node:fs/promises';
import { appendFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const API = 'https://api.openalex.org/authors';
const HEARTBEAT_MS = 30_000;
const PER_PAGE = 100;

const FIELDS: Record<number, string> = {
  11: 'Agricultural and Biological Sciences', 12: 'Arts and Humanities',
  13: 'Biochemistry, Genetics and Molecular Biology', 14: 'Business, Management and Accounting',
  15: 'Chemical Engineering', 16: 'Chemistry', 17: 'Computer Science', 18: 'Decision Sciences',
  19: 'Earth and Planetary Sciences', 20: 'Economics, Econometrics and Finance', 21: 'Energy',
  22: 'Engineering', 23: 'Environmental Science', 24: 'Immunology and Microbiology',
  25: 'Materials Science', 26: 'Mathematics', 27: 'Medicine', 28: 'Neuroscience', 29: 'Nursing',
  30: 'Pharmacology, Toxicology and Pharmaceutics', 31: 'Physics and Astronomy', 32: 'Psychology',
  33: 'Social Sciences', 34: 'Veterinary', 35: 'Dentistry', 36: 'Health Professions',
};
const FIELD_BY_NAME = new Map(Object.entries(FIELDS).map(([id, n]) => [n.toLowerCase(), Number(id)]));

interface Topic { count: number; fieldId: number | null; fieldName: string | null; subId: number | null; subName: string | null }
interface Slim { id: string; name: string; orcid: string | null; h: number; i10: number; works: number; cited: number; topics: Topic[] }
interface Cursor { cursor: string | null; fetched: number; minH: number; sort: string; done: boolean }

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const opt: Record<string, string | boolean> = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  let k = argv[i].slice(2), v: string | boolean = true;
  const eq = k.indexOf('=');
  if (eq !== -1) { v = k.slice(eq + 1); k = k.slice(0, eq); }
  else if (['top', 'min-h', 'limit', 'out', 'api-key'].includes(k)) v = argv[++i];
  opt[k] = v;
}
const num = (k: string, d: number): number => {
  const n = opt[k] === undefined ? d : Number(opt[k]);
  if (!Number.isInteger(n) || n < 0) { console.error(`bad --${k}`); process.exit(1); }
  return n;
};
const TOP = num('top', 100000);
const MIN_H = num('min-h', 10);
const LIMIT = Math.max(1, num('limit', 500));
const ANY_FIELD = !!opt['any-field'];
const CLASSIFY_ONLY = !!opt['classify-only'];
const API_KEY = String(opt['api-key'] ?? process.env.OPENALEX_API_KEY ?? '');
const OUT = path.resolve(String(opt['out'] ?? './out'));
mkdirSync(OUT, { recursive: true });
mkdirSync(path.join(OUT, 'fields'), { recursive: true });
mkdirSync(path.join(OUT, 'subfields'), { recursive: true });

// ---------------------------------------------------------------- logging
const ts = () => new Date().toISOString();
const append = (f: string, s: string) => { try { appendFileSync(path.join(OUT, f), s + '\n'); } catch { /* ignore */ } };
const log = (m: string) => { const l = `${ts()} ${m}`; console.log(l); append('run.log', l); };
const logErr = (m: string, e?: unknown) => {
  const d = e instanceof Error ? `\n${e.message}\n${e.stack ?? ''}` : e !== undefined ? `\n${String(e)}` : '';
  const l = `${ts()} ERROR ${m}${d}`;
  console.error(l); append('run.log', l); append('errors.log', l);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

async function writeJson(file: string, data: unknown, pretty = true): Promise<void> {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, pretty ? 2 : undefined));
  await fs.rename(tmp, file);
}

// ---------------------------------------------------------------- scraping
let sortParam = 'summary_stats.h_index:desc';
let sortSwitched = false;
let sampleLogged = false;

const idNum = (id: unknown): number | null => {
  const m = String(id ?? '').match(/(\d+)\/?$/);
  return m ? Number(m[1]) : null;
};

function slim(a: any): Slim {
  const topics: Topic[] = (a.topics ?? []).map((t: any) => {
    const fieldName = t.field?.display_name ?? null;
    return {
      count: Number(t.count ?? 0),
      fieldId: idNum(t.field?.id) ?? (fieldName ? FIELD_BY_NAME.get(String(fieldName).toLowerCase()) ?? null : null),
      fieldName,
      subId: idNum(t.subfield?.id),
      subName: t.subfield?.display_name ?? null,
    };
  });
  return {
    id: a.id, name: a.display_name, orcid: a.orcid ?? null,
    h: Number(a.summary_stats?.h_index ?? 0), i10: Number(a.summary_stats?.i10_index ?? 0),
    works: Number(a.works_count ?? 0), cited: Number(a.cited_by_count ?? 0), topics,
  };
}

async function fetchPage(cursor: string): Promise<any> {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const p = new URLSearchParams({
      filter: `summary_stats.h_index:>${MIN_H}`,
      sort: sortParam,
      per_page: String(PER_PAGE),
      cursor,
      select: 'id,display_name,orcid,summary_stats,works_count,cited_by_count,topics',
    });
    if (API_KEY) p.set('api_key', API_KEY);
    const url = `${API}?${p}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'scholar-rank/1.0' } });
      if (res.ok) return await res.json();
      const body = (await res.text()).slice(0, 600);
      logErr(`HTTP ${res.status} (attempt ${attempt}) ${url.replace(API_KEY || '\u0000', '***')}\n${body}`);
      if (res.status === 400 && !sortSwitched) {
        sortSwitched = true; sortParam = '-summary_stats.h_index';
        log(`retrying with sort=${sortParam}`);
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(`auth/permission error ${res.status}: set OPENALEX_API_KEY (cursor paging needs a free key)`);
      }
      if (res.status === 429 || res.status >= 500) {
        const wait = Number(res.headers.get('retry-after')) * 1000 || Math.min(60_000, 1000 * 2 ** attempt);
        log(`backing off ${Math.round(wait / 1000)}s`);
        await sleep(wait);
        continue;
      }
      throw new Error(`HTTP ${res.status}: ${body}`);
    } catch (e) {
      if (e instanceof Error && /auth\/permission|HTTP 4\d\d:/.test(e.message)) throw e;
      logErr(`network error (attempt ${attempt})`, e);
      await sleep(Math.min(30_000, 1000 * 2 ** attempt));
    }
  }
  throw new Error('page failed after 8 attempts');
}

function loadAuthors(): Map<string, Slim> {
  const map = new Map<string, Slim>();
  const f = path.join(OUT, 'authors.ndjson');
  if (!existsSync(f)) return map;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const a = JSON.parse(line) as Slim; map.set(a.id, a); } catch { /* skip torn line */ }
  }
  return map;
}

// ---------------------------------------------------------------- classify + score
function scoreTiers<T extends { rank: number; score: number }>(rows: T[]): void {
  let idx = 0, size = 100, base = 9;
  while (idx < rows.length) {
    const end = Math.min(idx + size, rows.length);
    for (let j = 0; j < end - idx; j++) {
      rows[idx + j].rank = idx + j + 1;
      rows[idx + j].score = Math.round((base + ((size - j) / size) * 0.9) * 10) / 10;
    }
    idx = end; size *= 2; base = Math.max(0, base - 1);
  }
}

interface Group { kind: 'field' | 'subfield'; id: number | null; name: string; rows: Slim[] }

async function buildOutputs(authors: Map<string, Slim>, scrapeDone: boolean): Promise<void> {
  const groups = new Map<string, Group>();
  for (const [id, name] of Object.entries(FIELDS)) groups.set(`field:${id}`, { kind: 'field', id: Number(id), name, rows: [] });

  const disciplinesOf = (a: Slim) => {
    const f = new Map<string, { id: number | null; name: string; cnt: number }>();
    const s = new Map<string, { id: number | null; name: string; cnt: number }>();
    for (const t of a.topics) {
      if (t.fieldName || t.fieldId) {
        const name = t.fieldId && FIELDS[t.fieldId] ? FIELDS[t.fieldId] : String(t.fieldName);
        const k = `field:${t.fieldId ?? name}`;
        const e = f.get(k) ?? { id: t.fieldId, name, cnt: 0 }; e.cnt += t.count; f.set(k, e);
      }
      if (t.subName || t.subId) {
        const name = String(t.subName ?? t.subId);
        const k = `subfield:${t.subId ?? name}`;
        const e = s.get(k) ?? { id: t.subId, name, cnt: 0 }; e.cnt += t.count; s.set(k, e);
      }
    }
    const rank = (m: Map<string, any>) => [...m.entries()].sort((x, y) => y[1].cnt - x[1].cnt || String(x[0]).localeCompare(String(y[0])));
    return { f: rank(f), s: rank(s) };
  };

  const info = new Map<string, { primaryField: string | null; primarySubfield: string | null; fields: string[] }>();
  let noTopics = 0;
  for (const a of authors.values()) {
    const d = disciplinesOf(a);
    if (!d.f.length) noTopics++;
    info.set(a.id, { primaryField: d.f[0]?.[1].name ?? null, primarySubfield: d.s[0]?.[1].name ?? null, fields: d.f.map(([, v]) => v.name) });
    const put = (list: typeof d.f, kind: 'field' | 'subfield') => {
      for (const [key, v] of ANY_FIELD ? list : list.slice(0, 1)) {
        let g = groups.get(key);
        if (!g) { g = { kind, id: v.id, name: v.name, rows: [] }; groups.set(key, g); }
        g.rows.push(a);
      }
    };
    put(d.f, 'field');
    put(d.s, 'subfield');
  }

  const aggregate: Record<string, unknown> = {};
  const summary: Record<string, number> = {};
  for (const [key, g] of groups) {
    g.rows.sort((a, b) => b.h - a.h || b.i10 - a.i10 || b.cited - a.cited);
    const top = g.rows.slice(0, LIMIT);
    const scored = top.map((a) => ({ a, rank: 0, score: 0 }));
    scoreTiers(scored);
    const scholars = scored.map(({ a, rank, score }) => {
      const i = info.get(a.id)!;
      return {
        rank, score, label: `${g.name} -- ${score.toFixed(1)}`, id: a.id, display_name: a.name, orcid: a.orcid,
        h_index: a.h, i10_index: a.i10, works_count: a.works, cited_by_count: a.cited,
        discipline: g.name, primary_field: i.primaryField, primary_subfield: i.primarySubfield, fields: i.fields,
      };
    });
    const result = { kind: g.kind, id: g.id, name: g.name, total_in_scrape: g.rows.length, count: scholars.length, scholars };
    const dir = g.kind === 'field' ? 'fields' : 'subfields';
    await writeJson(path.join(OUT, dir, `${g.id ?? 'x'}_${slug(g.name)}.json`), result);
    aggregate[key] = result;
    summary[key] = scholars.length;
  }
  await writeJson(path.join(OUT, 'results.json'), { updatedAt: ts(), scrapeComplete: scrapeDone, scholars: authors.size, disciplines: aggregate }, false);
  const empties = Object.entries(summary).filter(([, n]) => n === 0).map(([k]) => k);
  log(`wrote ${groups.size} discipline files from ${authors.size} scholars (${noTopics} had no topics); empty: ${empties.length ? empties.join(', ') : 'none'}`);
}

// ---------------------------------------------------------------- main
async function main(): Promise<void> {
  log(`start: top=${TOP} min-h=${MIN_H} limit=${LIMIT} mode=${ANY_FIELD ? 'any-field' : 'primary'} key=${API_KEY ? 'yes' : 'NO (cursor paging will likely fail)'} out=${OUT}`);

  if (opt['fresh']) {
    log('--fresh: deleting scraped data and cursor');
    for (const f of ['authors.ndjson', 'cursor.json', 'results.json', 'progress.json']) await fs.rm(path.join(OUT, f), { force: true });
  }

  const authors = loadAuthors();
  let state: Cursor = { cursor: '*', fetched: authors.size, minH: MIN_H, sort: sortParam, done: false };
  try {
    const s = JSON.parse(await fs.readFile(path.join(OUT, 'cursor.json'), 'utf8')) as Cursor;
    if (s.minH === MIN_H) { state = s; state.fetched = authors.size; log(`resuming: ${authors.size} scholars on disk, done=${s.done}`); }
    else log(`cursor.json used min-h=${s.minH}; ignoring it (use --fresh to clear old data)`);
  } catch { /* first run */ }

  let stage = 'starting', lastBuilt = -1, building = false, pages = 0;
  const rebuild = async (final = false) => {
    if (building || (!final && authors.size === lastBuilt)) return;
    building = true;
    try { lastBuilt = authors.size; await buildOutputs(authors, state.done); }
    catch (e) { logErr('buildOutputs failed', e); }
    finally { building = false; }
  };
  const progress = () => writeJson(path.join(OUT, 'progress.json'), { updatedAt: ts(), stage, scholars: authors.size, target: TOP, pages, cursor: state.cursor, done: state.done });

  const hb = setInterval(() => {
    log(`... ${stage} | ${authors.size}/${TOP} scholars | page ${pages}`);
    progress().catch((e) => logErr('progress write failed', e));
    void rebuild();
  }, HEARTBEAT_MS);

  const stop = async (sig: string) => {
    log(`${sig}: saving (re-run the same command to resume)`);
    clearInterval(hb);
    stage = `paused (${sig})`;
    try { await progress(); await rebuild(true); } catch (e) { logErr('save on signal failed', e); }
    process.exit(130);
  };
  process.on('SIGINT', () => void stop('SIGINT'));
  process.on('SIGTERM', () => void stop('SIGTERM'));

  try {
    if (!CLASSIFY_ONLY && !state.done && authors.size < TOP) {
      stage = 'scraping';
      let cursor: string | null = state.cursor ?? '*';
      while (cursor && authors.size < TOP) {
        const j = await fetchPage(cursor);
        const results: any[] = j.results ?? [];
        pages++;
        if (!sampleLogged && results[0]) {
          sampleLogged = true;
          log(`API ok. total matching=${j.meta?.count}. sample: ${results[0].display_name} h=${results[0].summary_stats?.h_index} topics=${JSON.stringify((results[0].topics ?? []).slice(0, 2))}`);
        }
        if (!results.length) { log('empty page, stopping'); state.done = true; break; }

        const fresh: Slim[] = [];
        for (const r of results) {
          if (authors.size + fresh.length >= TOP) break;
          const s = slim(r);
          if (!authors.has(s.id)) fresh.push(s);
        }
        if (fresh.length) {
          append('authors.ndjson', fresh.map((s) => JSON.stringify(s)).join('\n'));
          for (const s of fresh) authors.set(s.id, s);
        }
        cursor = j.meta?.next_cursor ?? null;
        state = { cursor, fetched: authors.size, minH: MIN_H, sort: sortParam, done: !cursor };
        await writeJson(path.join(OUT, 'cursor.json'), state);
        const last = results[results.length - 1];
        log(`page ${pages}: +${fresh.length} (total ${authors.size}) h-index now ${last?.summary_stats?.h_index}`);
        await sleep(120);
      }
      if (authors.size >= TOP) state.done = true;
      await writeJson(path.join(OUT, 'cursor.json'), state);
    }

    stage = 'classifying';
    await rebuild(true);
    stage = 'complete';
    await progress();
    log(`finished: ${authors.size} scholars -> ${OUT}`);
  } finally {
    clearInterval(hb);
  }
}

main().catch((e) => { logErr('fatal', e); process.exit(1); });