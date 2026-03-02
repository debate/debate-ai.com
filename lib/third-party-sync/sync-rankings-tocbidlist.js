#!/usr/bin/env node
/**
 * TOC Bid List Scraper
 * Fetches https://tocbidlist.com/policy with axios,
 * parses with linkedom, and extracts initialRows JSON → clean output.
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const axios   = require('axios');
const { parseHTML } = require('linkedom');

const URL     = 'https://tocbidlist.com/policy';
const OUT_DIR = process.argv[2] || '/mnt/user-data/outputs';
const OUT_FILE = path.join(OUT_DIR, 'toc_bid_list.json');

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchHTML(url) {
  console.log(`→ Fetching ${url}`);
  const res = await axios.get(url, {
    timeout: 20_000,
    maxRedirects: 5,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
    decompress: true,
  });
  console.log(`✓ Got ${(res.data.length / 1024).toFixed(1)} KB  [HTTP ${res.status}]`);
  return res.data;
}

// ─── Extract initialRows from Next.js hydration scripts ──────────────────────

/**
 * linkedom gives us DOM access; Next.js buries data in
 * self.__next_f.push([...]) script tags as serialised JSON strings.
 * We collect all script text, find the one containing "initialRows",
 * then do a balanced-bracket extraction.
 */
function extractInitialRows(html) {
  const { document } = parseHTML(html);

  // Gather all inline script text
  const scripts = [...document.querySelectorAll('script:not([src])')];
  const allText = scripts.map(s => s.textContent).join('\n');

  const marker = '"initialRows":';
  const idx    = allText.indexOf(marker);
  if (idx === -1) {
    // Fallback: search the raw HTML (sometimes linkedom strips content)
    return extractFromRawHTML(html);
  }

  return balancedExtract(allText, allText.indexOf('[', idx));
}

function extractFromRawHTML(html) {
  console.log('  (falling back to raw HTML scan)');
  const marker = '"initialRows":';
  const idx    = html.indexOf(marker);
  if (idx === -1) throw new Error('"initialRows" not found in page source');
  return balancedExtract(html, html.indexOf('[', idx));
}

/** Balanced-bracket JSON array extractor — handles nested objects/arrays. */
function balancedExtract(src, start) {
  if (start === -1) throw new Error('Array opening bracket not found');

  let depth = 0, inStr = false, esc = false;

  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (esc)              { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true;  continue; }
    if (ch === '"')        { inStr = !inStr; continue; }
    if (inStr)             continue;
    if      (ch === '[')   depth++;
    else if (ch === ']') {
      if (--depth === 0) {
        try   { return JSON.parse(src.slice(start, i + 1)); }
        catch { throw new Error(`JSON parse failed near position ${start}`); }
      }
    }
  }
  throw new Error('Unbalanced brackets — could not complete array extraction');
}

// ─── Transform ────────────────────────────────────────────────────────────────

const PLACE_RANK = { '1st':1,'2nd':2,'Semis':3,'Quarters':4,'Octos':5,'Ghost':6 };

function processTeam(raw) {
  const tournaments = (raw.details || []).map(d => ({
    tournament   : d.tournament,
    placement    : d.placement,
    normalized   : d.placementNormalized,
    bidTier      : d.bidTier,
    score        : d.score,
  }));

  const bestPlacement = tournaments.reduce((best, t) => {
    const r = PLACE_RANK[t.normalized] ?? 99;
    return r < (PLACE_RANK[best] ?? 99) ? t.normalized : best;
  }, 'N/A');

  return {
    id           : raw.id,
    slug         : raw.slug,
    school       : raw.schoolOrTeam,
    debaters     : raw.students,
    state        : raw.state,
    bids         : raw.bids,
    rank         : raw.rank,
    totalScore   : raw.totalScore,
    qualified    : raw.bids >= 2,
    bestPlacement,
    tournaments,
  };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function buildStats(teams) {
  const byState = {}, byBidCount = {}, tournFreq = {};

  for (const t of teams) {
    byState[t.state]                   = (byState[t.state]    || 0) + 1;
    const bk = `${t.bids}_bids`;
    byBidCount[bk]                     = (byBidCount[bk]      || 0) + 1;
    for (const tr of t.tournaments)
      tournFreq[tr.tournament]         = (tournFreq[tr.tournament] || 0) + 1;
  }

  return {
    totalTeams    : teams.length,
    qualifiedTeams: teams.filter(t => t.qualified).length,
    teamsWith1Bid : teams.filter(t => t.bids === 1).length,
    totalBids     : teams.reduce((s, t) => s + t.bids, 0),
    topRankedTeam : teams[0]?.school ?? null,
    byState       : Object.fromEntries(Object.entries(byState).sort((a,b) => b[1]-a[1])),
    byBidCount,
    mostActiveTournaments: Object.fromEntries(
      Object.entries(tournFreq).sort((a,b) => b[1]-a[1]).slice(0, 15)
    ),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('TOC Bid List Scraper  (axios + linkedom)');
  console.log('=========================================');

  // 1. Fetch
  const html = await fetchHTML(URL);

  // 2. Parse DOM + extract
  console.log('→ Parsing with linkedom…');
  let rawTeams;
  try {
    rawTeams = extractInitialRows(html);
    console.log(`✓ Extracted ${rawTeams.length} raw team entries`);
  } catch (err) {
    throw new Error(`Extraction failed: ${err.message}`);
  }

  // 3. Transform + sort by rank
  const teams = rawTeams
    .map(processTeam)
    .sort((a, b) => a.rank - b.rank || b.bids - a.bids);

  // 4. Build output
  const stats  = buildStats(teams);
  const output = {
    meta: {
      source      : URL,
      event       : 'Policy Debate (CX)',
      description : 'Tournament of Champions bid list — team rankings, bid counts, placements',
      scrapedAt   : new Date().toISOString(),
    },
    stats,
    teams,
  };

  // 5. Write
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');

  // 6. Summary
  console.log('\n═══ Results ═══════════════════════════');
  console.log(`Total teams       : ${stats.totalTeams}`);
  console.log(`Qualified (≥2 bids): ${stats.qualifiedTeams}`);
  console.log(`Teams with 1 bid  : ${stats.teamsWith1Bid}`);
  console.log(`Total bids        : ${stats.totalBids}`);
  console.log(`\nTop 5 teams:`);
  teams.slice(0, 5).forEach(t =>
    console.log(`  #${String(t.rank).padEnd(3)} ${t.school.padEnd(35)} ${t.bids} bids  score:${t.totalScore}`)
  );
  console.log(`\nTop states: ${Object.entries(stats.byState).slice(0,5).map(([s,n])=>`${s}(${n})`).join(', ')}`);
  console.log(`\n✓ Saved → ${OUT_FILE}`);
}

main().catch(err => {
  console.error('\n✗ Fatal:', err.message);
  process.exit(1);
});
