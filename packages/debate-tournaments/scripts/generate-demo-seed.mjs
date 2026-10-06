#!/usr/bin/env node
/**
 * Writes `seed/demo.sql`: the single demo tournament anyone can browse, and
 * open as the mock admin `demo.admin`.
 *
 *   node scripts/generate-demo-seed.mjs
 *
 * The Debate AI Demo Invitational (tourn 90001) runs four debate divisions (Policy,
 * Lincoln-Douglas, Public Forum, Parliamentary) and four speech events
 * (Original Oratory, Extemp, Dramatic Interp, Informative), with 40 entries
 * in each. It is simulated the way a real tournament runs: six power-matched
 * prelims, a 16-team break to octafinals with three-judge panels, speech
 * prelims in sections of six with semis and a final, and the result sets a
 * tab room posts afterwards — prelim seeds, final places, speaker awards and
 * the elimination bracket.
 *
 * Everything comes from a seeded PRNG, so the file only changes when this
 * script does. Bump `DEMO_SEED_VERSION` here and in `src/host/demo.ts`
 * whenever the output changes, so deployed sites reload it.
 *
 * Ids: the tournament keeps 90001 (the UI links to it) and the demo people
 * keep 90001-90004 and 90010. Every other row lives at 9_000_001 and up, far
 * above anything a hosted tournament is given, so reloading the seed can
 * never replace a hosted row. The file first deletes every row belonging to
 * demo tournaments 90001-90004, which also clears the older three-tournament
 * demo out of databases that still hold it.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DEMO_SEED_VERSION = "3";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "seed", "demo.sql");
const TOURN = 90001;
const SITE = 90001;
const CIRCUIT = 90001;
const ADMIN = 90010;
const ENTRIES_PER_EVENT = 40;

// --- Deterministic randomness -------------------------------------------------

let state = 0x5eed2026;
function random() {
  state = (state + 0x6d2b79f5) | 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];
const gaussian = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const round1 = (n) => Math.round(n * 10) / 10;

// --- Ids ------------------------------------------------------------------------

const counters = {};
const nextId = (table) => (counters[table] = (counters[table] ?? 9_000_000) + 1);

// --- SQL --------------------------------------------------------------------------

const rows = {};
const columnsOf = {};
function insert(table, row) {
  columnsOf[table] ??= Object.keys(row);
  (rows[table] ??= []).push(row);
  return row;
}
const quote = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && value.sql) return value.sql;
  return `'${String(value).replace(/'/g, "''")}'`;
};
/** A datetime relative to load time: `day` days from today, `hour` UTC hours into it. */
const at = (day, hour, minutes = 0) => ({
  sql: `datetime('now', '${day >= 0 ? "+" : ""}${day} days', 'start of day', '+${hour} hours'${minutes ? `, '+${minutes} minutes'` : ""})`,
});

// --- Names -------------------------------------------------------------------------

const FIRST = `Maya Jordan Sam Riley Avery Theo Priya Eli Nora Leo Zoe Ian Aria Mateo Isla Kai Lena Omar Hana Felix Ruby Diego Iris Noah Tara Ezra Lucia Rohan Mila Jonah Sana Caleb Ada Malik Elena Hugo Naomi Arjun Clara Tobias Freya Yusuf Ivy Gabriel Sofia Kenji Amara Julian Esme Dev Lila Marcus Nina Ravi Celia Owen Yara Silas June Amir Rosa Elliot Keira Tomas Asha Wesley Mira Dante Leila Quinn Anika Reid Talia Bruno Ines Cyrus Dahlia Emeka Fiona Hamid Juno Lars Mei Nico Odette Paulo Rhea Soren Uma Vikram Wren Xavier Yuki Zara`.split(
  " ",
);
const LAST = `Chen Patel Okafor Nguyen Brooks Ramirez Shah Goldberg Kim Martins Adeyemi Walsh Rossi Haddad Novak Tanaka Fischer Mendez Osei Larsen Dubois Iyer Kowalski Moreau Sato Bianchi Ahmed Lindqvist Costa Petrov Ferreira Nakamura Achebe Byrne Castillo Duarte Eriksen Gallagher Hosseini Ibarra Jansen Kaur Lopez Mbeki Nolan Ortega Park Quintero Reyes Silva Takahashi Umar Vance Weber Xu Yilmaz Zhou Abbott Banerjee Carver Delgado Ellison Farouk Grant Huang Ito Jovanovic Khan Lee Murphy Nwosu Olsen Pham Quinn Rahman Stein Torres Underwood Varga Whitaker Young Zamora`.split(
  " ",
);

const SCHOOLS = [
  ["Bayview High School", "BV", "San Francisco"],
  ["Redwood Preparatory", "RP", "Palo Alto"],
  ["Mission Hills Academy", "MH", "San Jose"],
  ["Coastal Ridge High", "CR", "Half Moon Bay"],
  ["Golden Gate Prep", "GG", "San Francisco"],
  ["Sierra Vista High School", "SV", "Sacramento"],
  ["Oak Knoll Academy", "OK", "Oakland"],
  ["Peninsula Day School", "PD", "San Mateo"],
  ["Harbor Point High", "HP", "Richmond"],
  ["Valley Oak High School", "VO", "Fresno"],
  ["Summit Ridge Prep", "SR", "Walnut Creek"],
  ["Lakeside Collegiate", "LC", "Lake Tahoe"],
  ["Cypress Grove High", "CG", "Monterey"],
  ["Northgate Academy", "NG", "Santa Rosa"],
  ["Pinecrest High School", "PC", "Cupertino"],
  ["Riverside Charter", "RC", "Stockton"],
  ["Westlake Prep", "WL", "Daly City"],
  ["Eastbay Science Academy", "EB", "Berkeley"],
  ["Hillcrest High School", "HC", "Fremont"],
  ["Marina Heights High", "MR", "Alameda"],
  ["Canyon View Academy", "CV", "San Ramon"],
  ["Foothill Classical", "FC", "Los Altos"],
  ["Seabright High School", "SB", "Santa Cruz"],
  ["Granite Bay Prep", "GB", "Roseville"],
  ["Bridgeway Academy", "BW", "Vallejo"],
  ["Laurel Heights High", "LH", "San Carlos"],
  ["Meadowbrook High School", "MB", "Pleasanton"],
  ["Stonebridge Prep", "ST", "Livermore"],
  ["Willow Glen Academy", "WG", "San Jose"],
  ["Crescent Bay High", "CB", "Benicia"],
  ["Ridgeline Collegiate", "RL", "Napa"],
  ["Sunset Park High School", "SP", "San Francisco"],
];

const usedNames = new Set();
function person() {
  for (;;) {
    const first = pick(FIRST);
    const last = pick(LAST);
    if (!usedNames.has(`${first} ${last}`)) {
      usedNames.add(`${first} ${last}`);
      return { first, last };
    }
  }
}

// --- Tournament ----------------------------------------------------------------------

insert("circuit", {
  id: CIRCUIT,
  name: "Demo Speech & Debate Circuit",
  abbr: "DEMO",
  tz: "America/Los_Angeles",
  active: 1,
  state: "CA",
  country: "US",
  webname: "demo",
});
insert("tourn", {
  id: TOURN,
  name: "Debate AI Demo Invitational",
  city: "San Francisco",
  state: "CA",
  country: "US",
  tz: "America/Los_Angeles",
  webname: "demobayarea",
  hidden: 0,
  start: at(-2, 15),
  end: at(1, 23),
  reg_start: at(-45, 0),
  reg_end: at(-9, 0),
});
insert("tourn_circuit", { id: 90001, approved: 1, tourn: TOURN, circuit: CIRCUIT });
insert("tourn_setting", { id: nextId("tourn_setting"), tag: "demo_seed", value: DEMO_SEED_VERSION, tourn: TOURN });
insert("tourn_setting", { id: nextId("tourn_setting"), tag: "currency", value: "usd", tourn: TOURN });

const debateJudges = insert("category", { id: nextId("category"), name: "Debate Judges", abbr: "DJ", tourn: TOURN });
const speechJudges = insert("category", { id: nextId("category"), name: "Speech Judges", abbr: "SJ", tourn: TOURN });

const DEBATE_EVENTS = [
  {
    abbr: "VCX",
    name: "Varsity Policy",
    size: 2,
    fee: 90,
    description: "Resolved: The United States federal government should significantly strengthen its protection of domestic intellectual property rights.",
  },
  {
    abbr: "VLD",
    name: "Varsity Lincoln-Douglas",
    size: 1,
    fee: 45,
    description: "Resolved: A just government ought to recognize an unconditional right of workers to strike.",
  },
  {
    abbr: "VPF",
    name: "Varsity Public Forum",
    size: 2,
    fee: 70,
    description: "Resolved: The United States federal government should substantially expand its surveillance of domestic AI development.",
  },
  {
    abbr: "VPRL",
    name: "Varsity Parliamentary",
    size: 2,
    fee: 70,
    description: "A new motion is released twenty minutes before each round. Points of information, no evidence.",
  },
];
const SPEECH_EVENTS = [
  { abbr: "OO", name: "Original Oratory", fee: 30, description: "A memorized persuasive speech written by the competitor, up to ten minutes." },
  { abbr: "IX", name: "International Extemp", fee: 30, description: "Thirty minutes of prep on a current-events question drawn before each round." },
  { abbr: "DI", name: "Dramatic Interpretation", fee: 30, description: "A cutting from published dramatic literature, up to ten minutes." },
  { abbr: "INF", name: "Informative Speaking", fee: 30, description: "An original informative speech with visual aids, up to ten minutes." },
];

const events = [];
for (const spec of DEBATE_EVENTS) {
  const event = insert("event", {
    id: nextId("event"),
    name: spec.name,
    abbr: spec.abbr,
    type: "debate",
    level: "open",
    fee: spec.fee,
    tourn: TOURN,
    category: debateJudges.id,
  });
  events.push({ ...spec, ...event, kind: "debate" });
}
for (const spec of SPEECH_EVENTS) {
  const event = insert("event", {
    id: nextId("event"),
    name: spec.name,
    abbr: spec.abbr,
    type: "speech",
    level: "open",
    fee: spec.fee,
    tourn: TOURN,
    category: speechJudges.id,
  });
  events.push({ ...spec, ...event, size: 1, kind: "speech" });
}
for (const event of events) {
  const setting = (tag, value, valueText = null) =>
    insert("event_setting", { id: nextId("event_setting"), tag, value, value_text: valueText, event: event.id });
  setting("description", "text", event.description);
  setting("min_entry", String(event.size));
  setting("max_entry", String(event.size));
  setting("cap", String(ENTRIES_PER_EVENT));
  if (event.kind === "debate") {
    setting("aff_label", event.abbr === "VPF" ? "Pro" : event.abbr === "VPRL" ? "Government" : "Affirmative");
    setting("neg_label", event.abbr === "VPF" ? "Con" : event.abbr === "VPRL" ? "Opposition" : "Negative");
  }
}

// --- Schools, competitors, entries ---------------------------------------------------

const schools = SCHOOLS.map(([name, code, city]) => {
  const chapter = insert("chapter", { id: nextId("chapter"), name, city, state: "CA", country: "US", level: "highschool" });
  return insert("school", { id: nextId("school"), name, code, tourn: TOURN, chapter: chapter.id, state: "CA" });
});

const entries = [];
for (const event of events) {
  const codes = new Set();
  for (let n = 0; n < ENTRIES_PER_EVENT; n++) {
    const school = schools[n % schools.length === n ? n : Math.floor(random() * schools.length)];
    const chapter = rows.chapter.find((c) => c.name === school.name);
    const students = [];
    for (let s = 0; s < event.size; s++) {
      const { first, last } = person();
      students.push(
        insert("student", {
          id: nextId("student"),
          first,
          last,
          grad_year: 2027 + Math.floor(random() * 3),
          novice: 0,
          chapter: chapter.id,
        }),
      );
    }
    const initials = students.map((s) => (event.size === 1 ? s.first[0] + s.last[0] : s.last[0])).join("");
    let code = `${school.code} ${initials}`;
    for (let k = 2; codes.has(code); k++) code = `${school.code} ${initials}${k}`;
    codes.add(code);
    const name = event.size === 1 ? `${students[0].first} ${students[0].last}` : students.map((s) => s.last).join(" & ");
    const entry = insert("entry", {
      id: nextId("entry"),
      code,
      name,
      active: 1,
      dropped: 0,
      waitlist: 0,
      unconfirmed: 0,
      tourn: TOURN,
      school: school.id,
      event: event.id,
    });
    for (const student of students) insert("entry_student", { id: nextId("entry_student"), entry: entry.id, student: student.id });
    entries.push({
      ...entry,
      event,
      students,
      strength: gaussian(),
      speaker: students.map(() => gaussian() * 0.6),
      wins: 0,
      losses: 0,
      points: 0,
      ranks: 0,
      affs: 0,
      opponents: new Set(),
      studentPoints: students.map(() => 0),
    });
  }
}

// --- Judges ----------------------------------------------------------------------------

const PARADIGMS = [
  "Tech over truth, but warrants matter. Extend your impacts through the final speech. I flow on paper.",
  "Lay judge. Speak clearly, explain your evidence and weigh at the end.",
  "Former LD debater. Frameworks are fine; tell me how the value and criterion filter the round.",
  "Policy background. Comfortable with speed; clash beats blippy extensions.",
  "Coach for ten years. Collapse in the back half and compare worlds for me.",
  "I vote on the flow, but I need a clear ballot story in the last speech.",
  "Theory is fine when there is real abuse. Disclosure arguments need a screenshot.",
  "Parent judge. Please be respectful in cross and signpost every argument.",
  "Kritiks are welcome; explain the alternative and the role of the ballot.",
  "Speech coach: I rank on structure, delivery and how well you know your audience.",
];

// The four people the earlier seed made keep their ids, so signing in as
// demo.judge@debate-ai.com still lands on person 90001.
const KEPT = [
  [90001, "demo.judge@debate-ai.com", "Dana", "Whitfield"],
  [90002, "demo.judge2@debate-ai.com", "Marcus", "Lee"],
  [90003, "demo.judge3@debate-ai.com", "Elena", "Vasquez"],
  [90004, "demo.judge4@debate-ai.com", "Chris", "Thompson"],
];
const judges = [];
function addJudge(category, index, kept) {
  const school = schools[index % schools.length];
  const { first, last } = kept ? { first: kept[2], last: kept[3] } : person();
  const personId = kept ? kept[0] : nextId("person");
  const email = kept ? kept[1] : `demo.judge.${personId - 9_000_000}@debate-ai.com`;
  insert("person", { id: personId, email, first, last, country: "US", tz: "America/Los_Angeles", site_admin: 0, no_email: 1 });
  if (kept || index % 3 === 0) {
    insert("person_setting", {
      id: kept ? personId : nextId("person_setting"),
      tag: "paradigm",
      value: "text",
      value_text: `<p>${kept ? PARADIGMS[KEPT.indexOf(kept)] : PARADIGMS[index % PARADIGMS.length]}</p>`,
      person: personId,
    });
  }
  const judge = insert("judge", {
    id: nextId("judge"),
    code: `${category.abbr[0]}${index + 1}`,
    first,
    last,
    active: 1,
    obligation: 6,
    hired: index % 9 === 8 ? 1 : 0,
    school: index % 9 === 8 ? null : school.id,
    category: category.id,
    person: personId,
  });
  judges.push({ ...judge, kind: category === debateJudges ? "debate" : "speech", seen: new Set() });
}
for (let i = 0; i < 112; i++) addJudge(debateJudges, i, KEPT[i]);
for (let i = 0; i < 36; i++) addJudge(speechJudges, i, null);

// --- Site and rooms ------------------------------------------------------------------

insert("site", { id: SITE, name: "Bayview High School", online: 0, circuit: CIRCUIT });
insert("tourn_site", { id: 90001, tourn: TOURN, site: SITE });
const rooms = [];
for (let i = 0; i < 120; i++) {
  const building = ["Main", "Science", "Humanities", "Arts"][Math.floor(i / 30)];
  const floor = Math.floor((i % 30) / 10) + 1;
  rooms.push(
    insert("room", {
      id: nextId("room"),
      building,
      name: `${building === "Main" ? "Room" : building} ${floor}${String((i % 10) + 1).padStart(2, "0")}`,
      quality: 1,
      capacity: 30,
      inactive: 0,
      deleted: 0,
      ada: i % 4 === 0 ? 1 : 0,
      site: SITE,
    }),
  );
}

// --- Schedule ----------------------------------------------------------------------------

// Hours are UTC; 16:00 UTC is 9am in San Francisco. Day -2 and day -1 are the
// two days of competition, so every round is over and posted.
const timeslot = (name, day, hour) =>
  insert("timeslot", { id: nextId("timeslot"), name, start: at(day, hour), end: at(day, hour + 1, 30), tourn: TOURN });

const DEBATE_SCHEDULE = [
  ["Round 1", -2, 16],
  ["Round 2", -2, 18],
  ["Round 3", -2, 20],
  ["Round 4", -2, 22],
  ["Round 5", -1, 16],
  ["Round 6", -1, 18],
].map(([name, day, hour]) => timeslot(name, day, hour));
const ELIM_SCHEDULE = [
  ["Octafinals", -1, 20],
  ["Quarterfinals", -1, 22],
  ["Semifinals", 0 - 1, 24],
  ["Finals", 0 - 1, 26],
].map(([name, day, hour]) => timeslot(name, day, hour));
const SPEECH_SCHEDULE = [
  ["Speech Round 1", -2, 17],
  ["Speech Round 2", -2, 19],
  ["Speech Round 3", -2, 21],
  ["Speech Semifinals", -1, 19],
  ["Speech Finals", -1, 23],
].map(([name, day, hour]) => timeslot(name, day, hour));

// Judges and rooms already busy in each timeslot.
const busyJudges = new Map();
const busyRooms = new Map();
function freeRoom(slot) {
  const busy = busyRooms.get(slot.id) ?? new Set();
  busyRooms.set(slot.id, busy);
  const room = rooms.find((r) => !busy.has(r.id));
  busy.add(room.id);
  return room;
}
function freeJudges(slot, kind, count, conflicts) {
  const busy = busyJudges.get(slot.id) ?? new Set();
  busyJudges.set(slot.id, busy);
  const pool = shuffle(judges.filter((j) => j.kind === kind && !busy.has(j.id) && !conflicts.has(j.school)));
  // Prefer judges who have not seen these entries.
  pool.sort((a, b) => a.seen.size - b.seen.size);
  const chosen = pool.slice(0, count);
  if (chosen.length < count) throw new Error(`Not enough ${kind} judges in ${slot.name}`);
  for (const judge of chosen) busy.add(judge.id);
  return chosen;
}

let roundName = 0;
const roundsByEvent = new Map();
function addRound(event, slot, type, label) {
  const list = roundsByEvent.get(event.id) ?? [];
  roundsByEvent.set(event.id, list);
  const round = insert("round", {
    id: nextId("round"),
    type,
    name: list.length + 1,
    label,
    flighted: 1,
    published: 1,
    post_primary: 3,
    event: event.id,
    timeslot: slot.id,
    site: SITE,
  });
  list.push(round);
  roundName++;
  return round;
}

function addPanel(round, slot, letter, bracket) {
  return insert("panel", {
    id: nextId("panel"),
    letter: String(letter),
    flight: 1,
    bye: 0,
    bracket,
    publish: 1,
    room: freeRoom(slot).id,
    round: round.id,
  });
}

function addBallot(panel, judge, entry, side, speakerorder, chair) {
  judge.seen.add(entry.id);
  return insert("ballot", {
    id: nextId("ballot"),
    side,
    speakerorder,
    chair: chair ? 1 : 0,
    bye: 0,
    forfeit: 0,
    audit: 1,
    judge: judge.id,
    panel: panel.id,
    entry: entry.id,
  });
}
const score = (ballot, tag, value, student = null) =>
  insert("score", { id: nextId("score"), tag, value, ballot: ballot.id, student });

const winProbability = (a, b) => 1 / (1 + Math.exp(-1.3 * (a.strength - b.strength)));
const speakerPoint = (entry, s) => {
  const raw = 28.3 + entry.strength * 0.35 + entry.speaker[s] * 0.4 + gaussian() * 0.3;
  return Math.min(29.9, Math.max(26.5, round1(raw)));
};
const bySeed = (a, b) => b.wins - a.wins || b.points - a.points || a.id - b.id;

// --- Debate ------------------------------------------------------------------------------

/** High-low power matching within a record, avoiding rematches and teammates. */
function pairRound(field, roundIndex) {
  const order = roundIndex < 2 ? shuffle(field) : [...field].sort(bySeed);
  const open = [...order];
  const pairs = [];
  while (open.length) {
    const a = open.shift();
    let index = open.findIndex((b) => b.school !== a.school && !a.opponents.has(b.id));
    if (index < 0) index = open.findIndex((b) => !a.opponents.has(b.id));
    if (index < 0) index = 0;
    const [b] = open.splice(index, 1);
    pairs.push(a.affs <= b.affs ? [a, b] : [b, a]);
  }
  return pairs;
}

const debateResults = new Map();
for (const event of events.filter((e) => e.kind === "debate")) {
  const field = entries.filter((e) => e.event === event);

  DEBATE_SCHEDULE.forEach((slot, roundIndex) => {
    const round = addRound(event, slot, "prelim", `Round ${roundIndex + 1}`);
    const pairs = pairRound(field, roundIndex);
    pairs.forEach(([aff, neg], i) => {
      const panel = addPanel(round, slot, i + 1, Math.max(aff.wins, neg.wins));
      const [judge] = freeJudges(slot, "debate", 1, new Set([aff.school, neg.school]));
      const affWins = random() < winProbability(aff, neg);
      for (const [entry, side, won] of [
        [aff, 1, affWins],
        [neg, 2, !affWins],
      ]) {
        const ballot = addBallot(panel, judge, entry, side, side, false);
        score(ballot, "winloss", won ? 1 : 0);
        entry.students.forEach((student, s) => {
          const points = speakerPoint(entry, s);
          score(ballot, "point", points, student.id);
          entry.points += points;
          entry.studentPoints[s] += points;
        });
        if (won) entry.wins++;
        else entry.losses++;
      }
      aff.affs++;
      aff.opponents.add(neg.id);
      neg.opponents.add(aff.id);
    });
  });

  const seeds = [...field].sort(bySeed);
  seeds.forEach((entry, i) => (entry.seed = i + 1));

  // Break the top 16 to octafinals: 1 v 16, 8 v 9, … in bracket order.
  const BRACKET_ORDER = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];
  let alive = BRACKET_ORDER.map((seed) => seeds[seed - 1]);
  const eliminated = [];
  ELIM_SCHEDULE.forEach((slot, elimIndex) => {
    const label = slot.name;
    const round = addRound(event, slot, label === "Finals" ? "final" : "elim", label);
    const winners = [];
    for (let i = 0; i < alive.length; i += 2) {
      const [high, low] = [alive[i], alive[i + 1]].sort((a, b) => a.seed - b.seed);
      const [aff, neg] = random() < 0.5 ? [high, low] : [low, high];
      const panel = addPanel(round, slot, i / 2 + 1, i / 2 + 1);
      const panelJudges = freeJudges(slot, "debate", 3, new Set([aff.school, neg.school]));
      let affBallots = 0;
      panelJudges.forEach((judge, j) => {
        const affWins = random() < winProbability(aff, neg);
        if (affWins) affBallots++;
        for (const [entry, side, won] of [
          [aff, 1, affWins],
          [neg, 2, !affWins],
        ]) {
          const ballot = addBallot(panel, judge, entry, side, side, j === 0);
          score(ballot, "winloss", won ? 1 : 0);
        }
      });
      const winner = affBallots >= 2 ? aff : neg;
      const loser = winner === aff ? neg : aff;
      loser.elimOut = elimIndex;
      loser.decision = `${Math.max(affBallots, 3 - affBallots)}-${Math.min(affBallots, 3 - affBallots)}`;
      eliminated.push(loser);
      // Keep bracket order: the winner takes the pair's place.
      winners.push(winner);
    }
    alive = winners;
  });
  const champion = alive[0];
  champion.elimOut = ELIM_SCHEDULE.length;
  debateResults.set(event.id, { field, seeds, champion });
}

// --- Speech -----------------------------------------------------------------------------

const speechResults = new Map();
for (const event of events.filter((e) => e.kind === "speech")) {
  const field = entries.filter((e) => e.event === event);
  const performance = (entry) => entry.strength + gaussian() * 0.7;

  const runSection = (round, slot, letter, members, judgeCount, tally) => {
    const panel = addPanel(round, slot, letter, 0);
    const panelJudges = freeJudges(slot, "speech", judgeCount, new Set(members.map((m) => m.school)));
    const order = shuffle(members);
    panelJudges.forEach((judge, j) => {
      const ranked = [...order].map((m) => ({ m, p: performance(m) })).sort((a, b) => b.p - a.p);
      ranked.forEach(({ m }, rank) => {
        const ballot = addBallot(panel, judge, m, 0, order.indexOf(m) + 1, j === 0);
        const points = Math.min(100, Math.max(80, Math.round(97 - rank * 2 + gaussian())));
        score(ballot, "rank", rank + 1, null);
        score(ballot, "point", points, m.students[0].id);
        tally(m, rank + 1, points);
      });
    });
  };

  const prelimTally = (m, rank, points) => {
    m.ranks += rank;
    m.points += points;
  };
  SPEECH_SCHEDULE.slice(0, 3).forEach((slot, roundIndex) => {
    const round = addRound(event, slot, "prelim", `Round ${roundIndex + 1}`);
    const order = shuffle(field);
    const sections = 7;
    for (let s = 0; s < sections; s++) {
      runSection(round, slot, s + 1, order.filter((_, i) => i % sections === s), 1, prelimTally);
    }
  });
  const byRanks = (a, b) => a.ranks - b.ranks || b.points - a.points || a.id - b.id;
  const prelimOrder = [...field].sort(byRanks);
  prelimOrder.forEach((m, i) => (m.seed = i + 1));

  const semifinalists = prelimOrder.slice(0, 12);
  const semiRound = addRound(event, SPEECH_SCHEDULE[3], "elim", "Semifinals");
  for (const m of semifinalists) m.semiRanks = 0;
  const semiTally = (m, rank) => (m.semiRanks += rank);
  runSection(semiRound, SPEECH_SCHEDULE[3], 1, semifinalists.filter((_, i) => i % 2 === 0), 3, semiTally);
  runSection(semiRound, SPEECH_SCHEDULE[3], 2, semifinalists.filter((_, i) => i % 2 === 1), 3, semiTally);
  const finalists = [...semifinalists].sort((a, b) => a.semiRanks - b.semiRanks || a.seed - b.seed).slice(0, 6);

  const finalRound = addRound(event, SPEECH_SCHEDULE[4], "final", "Finals");
  for (const m of finalists) m.finalRanks = 0;
  runSection(finalRound, SPEECH_SCHEDULE[4], 1, finalists, 3, (m, rank) => (m.finalRanks += rank));
  const finalOrder = [...finalists].sort((a, b) => a.finalRanks - b.finalRanks || a.semiRanks - b.semiRanks);
  speechResults.set(event.id, { prelimOrder, semifinalists, finalOrder });
}

// --- Result sets ----------------------------------------------------------------------------

function resultSet(event, label, tag, entity, keys, generatedHour) {
  const set = insert("result_set", {
    id: nextId("result_set"),
    tag,
    entity,
    label,
    bracket: tag === "bracket" ? 1 : 0,
    published: 1,
    coach: 0,
    generated: at(-1, generatedHour),
    tourn: TOURN,
    event: event.id,
  });
  const keyIds = keys.map(([keyTag, description]) =>
    insert("result_key", {
      id: nextId("result_key"),
      tag: keyTag,
      description,
      no_sort: 0,
      sort_desc: keyTag === "Rk" || keyTag === "Ranks" ? 0 : 1,
      result_set: set.id,
    }).id,
  );
  return {
    set,
    add({ rank, place, entry, student = null, values }) {
      const result = insert("result", {
        id: nextId("result"),
        rank,
        place,
        result_set: set.id,
        entry: entry.id,
        school: entry.school,
        student,
      });
      values.forEach((value, i) =>
        insert("result_value", { id: nextId("result_value"), value: String(value), priority: i + 1, result: result.id, result_key: keyIds[i] }),
      );
    },
  };
}

const ELIM_PLACES = ["Octafinalist", "Quarterfinalist", "Semifinalist", "Finalist", "Champion"];
const ordinal = (n) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

for (const event of events) {
  if (event.kind === "debate") {
    const { seeds } = debateResults.get(event.id);
    const prelim = resultSet(event, "Prelim Seeds", "entry", "entry", [
      ["W", "Wins"],
      ["L", "Losses"],
      ["Pts", "Total speaker points"],
    ], 20);
    seeds.forEach((entry, i) =>
      prelim.add({ rank: i + 1, place: ordinal(i + 1), entry, values: [entry.wins, entry.losses, round1(entry.points)] }),
    );

    const finals = resultSet(event, "Final Places", "entry", "entry", [
      ["Elim", "Last elimination round reached"],
      ["Seed", "Prelim seed"],
    ], 27);
    const breaking = seeds.filter((e) => e.elimOut !== undefined).sort((a, b) => b.elimOut - a.elimOut || a.seed - b.seed);
    breaking.forEach((entry, i) =>
      finals.add({
        rank: i + 1,
        place: ELIM_PLACES[entry.elimOut],
        entry,
        values: [entry.elimOut === ELIM_PLACES.length - 1 ? "Won" : `Lost ${entry.decision}`, entry.seed],
      }),
    );

    const speakers = resultSet(event, "Speaker Awards", "entry", "student", [
      ["Pts", "Total speaker points"],
      ["Avg", "Average per round"],
    ], 21);
    const speakerRows = seeds
      .flatMap((entry) => entry.students.map((student, s) => ({ entry, student, points: entry.studentPoints[s] })))
      .sort((a, b) => b.points - a.points)
      .slice(0, 20);
    speakerRows.forEach(({ entry, student, points }, i) =>
      speakers.add({
        rank: i + 1,
        place: `${ordinal(i + 1)} Speaker`,
        entry,
        student: student.id,
        values: [round1(points), round1(points / DEBATE_SCHEDULE.length)],
      }),
    );

    resultSet(event, "Elimination Bracket", "bracket", "entry", [], 27);
  } else {
    const { prelimOrder, finalOrder, semifinalists } = speechResults.get(event.id);
    const finals = resultSet(event, "Final Places", "entry", "entry", [
      ["Ranks", "Final round ranks"],
      ["Prelim", "Prelim ranks"],
    ], 26);
    const rest = semifinalists.filter((m) => !finalOrder.includes(m)).sort((a, b) => a.semiRanks - b.semiRanks);
    [...finalOrder, ...rest].forEach((entry, i) =>
      finals.add({
        rank: i + 1,
        place: i < finalOrder.length ? ordinal(i + 1) : "Semifinalist",
        entry,
        values: [i < finalOrder.length ? entry.finalRanks : "", entry.ranks],
      }),
    );
    const prelim = resultSet(event, "Prelim Ranks", "entry", "entry", [
      ["Ranks", "Total ranks, lower is better"],
      ["Pts", "Total points"],
    ], 22);
    prelimOrder.forEach((entry, i) =>
      prelim.add({ rank: i + 1, place: ordinal(i + 1), entry, values: [entry.ranks, entry.points] }),
    );
  }
}

// --- Invite pages ---------------------------------------------------------------------------

insert("webpage", {
  id: nextId("webpage"),
  title: "Welcome",
  slug: "main",
  content:
    "<p>Welcome to the Debate AI Demo Invitational: two days of Policy, Lincoln-Douglas, Public Forum and Parliamentary debate, plus Original Oratory, Extemp, Dramatic Interp and Informative, at Bayview High School in San Francisco.</p><p>Six prelims in every debate division break the top sixteen to octafinals. Speech runs three prelims in sections of six, then semifinals and a final. Pairings, results, speaker awards and brackets post here as rounds are released.</p><p>This is a demo tournament. Open its admin view to see how it is run.</p>",
  published: 1,
  sitewide: 0,
  special: "main",
  page_order: 1,
  tourn: TOURN,
});
insert("webpage", {
  id: nextId("webpage"),
  title: "Schedule",
  slug: "schedule",
  content:
    "<h3>Day one</h3><p>Registration 8:00am. Debate rounds 1-4 at 9:00, 11:00, 1:00 and 3:00. Speech rounds 1-3 at 10:00, 12:00 and 2:00.</p><h3>Day two</h3><p>Debate rounds 5-6 at 9:00 and 11:00. Octafinals 1:00, quarterfinals 3:00, semifinals 5:00, finals 7:00. Speech semifinals 12:00, finals 4:00. Awards follow the last final.</p>",
  published: 1,
  sitewide: 0,
  special: null,
  page_order: 2,
  tourn: TOURN,
});

// --- The demo admin --------------------------------------------------------------------------

insert("person", {
  id: ADMIN,
  email: "demo.admin@debate-ai.com",
  first: "Demo",
  last: "Admin",
  country: "US",
  tz: "America/Los_Angeles",
  site_admin: 0,
  no_email: 1,
});
insert("permission", { id: 90001, tag: "owner", person: ADMIN, tourn: TOURN, created_by: ADMIN });

// --- Write -------------------------------------------------------------------------------------

const DEMO_TOURNS = "(90001, 90002, 90003, 90004)";
const events_ = `SELECT id FROM event WHERE tourn IN ${DEMO_TOURNS}`;
const rounds_ = `SELECT id FROM round WHERE event IN (${events_})`;
const panels_ = `SELECT id FROM panel WHERE round IN (${rounds_})`;
const ballots_ = `SELECT id FROM ballot WHERE panel IN (${panels_})`;
const sets_ = `SELECT id FROM result_set WHERE tourn IN ${DEMO_TOURNS}`;
const results_ = `SELECT id FROM result WHERE result_set IN (${sets_})`;
const entries_ = `SELECT id FROM entry WHERE tourn IN ${DEMO_TOURNS}`;
const categories_ = `SELECT id FROM category WHERE tourn IN ${DEMO_TOURNS}`;
const DELETES = [
  `DELETE FROM score WHERE ballot IN (${ballots_})`,
  `DELETE FROM ballot WHERE panel IN (${panels_})`,
  `DELETE FROM panel WHERE round IN (${rounds_})`,
  `DELETE FROM round WHERE event IN (${events_})`,
  `DELETE FROM result_value WHERE result IN (${results_})`,
  `DELETE FROM result WHERE result_set IN (${sets_})`,
  `DELETE FROM result_key WHERE result_set IN (${sets_})`,
  `DELETE FROM result_set WHERE tourn IN ${DEMO_TOURNS}`,
  `DELETE FROM entry_student WHERE entry IN (${entries_})`,
  `DELETE FROM entry WHERE tourn IN ${DEMO_TOURNS}`,
  `DELETE FROM event_setting WHERE event IN (${events_})`,
  `DELETE FROM event WHERE tourn IN ${DEMO_TOURNS}`,
  `DELETE FROM judge WHERE category IN (${categories_})`,
  `DELETE FROM category WHERE tourn IN ${DEMO_TOURNS}`,
  `DELETE FROM school WHERE tourn IN ${DEMO_TOURNS}`,
  `DELETE FROM timeslot WHERE tourn IN ${DEMO_TOURNS}`,
  `DELETE FROM webpage WHERE tourn IN ${DEMO_TOURNS}`,
  `DELETE FROM tourn_setting WHERE tourn IN ${DEMO_TOURNS}`,
  `DELETE FROM tourn_circuit WHERE tourn IN ${DEMO_TOURNS}`,
  `DELETE FROM tourn_site WHERE tourn IN ${DEMO_TOURNS}`,
  `DELETE FROM permission WHERE tourn IN ${DEMO_TOURNS}`,
  `DELETE FROM room WHERE site = ${SITE}`,
  `DELETE FROM tourn WHERE id IN (90002, 90003, 90004)`,
];

const ORDER = [
  "circuit",
  "tourn",
  "tourn_circuit",
  "tourn_setting",
  "category",
  "event",
  "event_setting",
  "chapter",
  "school",
  "student",
  "entry",
  "entry_student",
  "person",
  "person_setting",
  "judge",
  "site",
  "tourn_site",
  "room",
  "timeslot",
  "round",
  "panel",
  "ballot",
  "score",
  "result_set",
  "result_key",
  "result",
  "result_value",
  "webpage",
  "permission",
];

const CHUNK = 400;
const lines = [
  "-- The demo tournament for debate-ai.com: dummy data, not a migration.",
  "--",
  "-- GENERATED by scripts/generate-demo-seed.mjs. Edit the script, not this file.",
  "--",
  "-- Loaded by `bun run db:seed:tournaments` (local D1) or",
  "-- `bun run db:seed:tournaments:d1` (remote) from apps/debate-ai.com, after the",
  "-- Tabroom schema (migrations/0001_tabroom_schema.sql) has been applied. The app",
  "-- also loads it itself (`POST /api/tabroom/host/demo`, see src/host/demo.ts)",
  "-- whenever the demo is missing, over, or from an older seed version, so",
  "-- statements end with `;` at the end of a line and comments take whole lines.",
  "--",
  `-- One tournament, 90001 Debate AI Demo Invitational, seed version ${DEMO_SEED_VERSION}:`,
  `--   ${DEBATE_EVENTS.map((e) => e.abbr).join(", ")} (debate) and ${SPEECH_EVENTS.map((e) => e.abbr).join(", ")} (speech),`,
  `--   ${ENTRIES_PER_EVENT} entries each, ${schools.length} schools, ${judges.length} judges, ${rooms.length} rooms.`,
  "--   Six power-matched prelims and a 16-team break per debate division; three",
  "--   speech prelims, semifinals and a final; seeds, final places, speaker",
  "--   awards and the bracket as result sets. Dates are relative to load time.",
  "--",
  "-- Person 90010 (demo.admin) owns it, and its admin view is open to everyone.",
  "-- Signing in as demo.judge@debate-ai.com maps onto judge person 90001.",
  "",
  "-- Clear every demo tournament first (this also drops the older 90002-90004 demos).",
  ...DELETES.map((statement) => `${statement};`),
];
for (const table of ORDER) {
  const list = rows[table] ?? [];
  if (!list.length) continue;
  const columns = columnsOf[table];
  lines.push("", `-- ${table} (${list.length})`);
  for (let i = 0; i < list.length; i += CHUNK) {
    const values = list
      .slice(i, i + CHUNK)
      .map((row) => `  (${columns.map((c) => quote(row[c])).join(", ")})`)
      .join(",\n");
    lines.push(`INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES\n${values};`);
  }
}
writeFileSync(OUT, `${lines.join("\n")}\n`);
const total = Object.values(rows).reduce((n, list) => n + list.length, 0);
console.log(`Wrote ${OUT}: ${total} rows.`);
