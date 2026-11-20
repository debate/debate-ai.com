/**
 * @fileoverview The official list of debate file publishers: the summer camps
 * (and one brief writer) whose evidence is posted to OpenCaselist's openev
 * pages, each named by the short code openev files carry at the end of their
 * names — `Elections DA - MNDI 2026 BFHPR.docx` is a Michigan (MNDI) file.
 *
 * {@link detectCampPublisher} reads that code from a file name, so every file
 * belongs to one of these publishers or to "Unsorted". Each publisher has an
 * info card (location, events, dates, cost, deadline, contact, website and
 * openev page) shown in a modal from the docs sidebar and as the page
 * `/research/publishers/camp-<code>`, and can be followed through
 * `/api/follows` with kind `"publisher"`.
 *
 * The details come from the camps' own sites and the Debate Summer Institutes
 * table, as of November 2026. They change every summer; the card says so.
 *
 * Pure data and string functions only.
 *
 * @module debate-file-market/camp-publishers
 */

/** Who to contact about a camp. Every field is optional. */
export interface CampContact {
  name?: string;
  email?: string;
  phone?: string;
}

/** One official publisher of debate files. */
export interface CampPublisher {
  /** The openev code at the end of its file names, e.g. `"DDI"`. */
  code: string;
  /** Page and follow slug: `camp-` and the lowercased code. */
  slug: string;
  /** Display name. */
  name: string;
  /** The university or organization behind it. */
  host: string;
  /** One sentence about it. */
  about: string;
  location: string;
  events: string;
  dates: string;
  cost: string;
  deadline: string;
  contact: CampContact;
  /** The camp's own site. */
  website: string;
  /** Its OpenCaselist openev page. */
  openevUrl: string;
}

/** The season whose openev pages the links point to. */
export const OPENEV_YEAR = 2026;

/** The publisher name a file with no recognized code gets. */
export const UNSORTED_PUBLISHER = "Unsorted";

type CampEntry = Omit<CampPublisher, "slug" | "openevUrl">;

const ENTRIES: CampEntry[] = [
  {
    code: "CNDI",
    name: "California National Debate Institute (CNDI)",
    host: "UC Berkeley",
    about: "West Coast institute for policy and public forum debate, with an intro week for middle schoolers.",
    location: "UC Berkeley campus, Berkeley, CA",
    events: "3-week Policy; 2-week Public Forum; 1-week Intro to Debate / middle school day camp",
    dates: "2027: Policy June 20–July 10; PF June 20–July 3; intro June 21–25",
    cost: "Policy $3,600 residential / $2,400 commuter; PF $2,400 / $1,600; intro $600 day camp",
    deadline: "Final deadline not listed; $300 nonrefundable deposit with application",
    contact: {},
    website: "https://berkeleydebate.com/camps/",
  },
  {
    code: "DDI",
    name: "Dartmouth Debate Institutes (DDI)",
    host: "Dartmouth College",
    about: "One of the premier advanced policy workshops in the country, plus the Georgetown–Dartmouth joint program.",
    location: "Dartmouth College, Hanover, NH",
    events: "4-week advanced Policy (DDI); 6-week Georgetown–Dartmouth Debate Institute (GDDI)",
    dates: "2026 ran July 5–Aug 1 (GDDI June 21–Aug 1); 2027 dates not yet posted",
    cost: "2027 tuition not posted; need-based aid available",
    deadline: "2027 application “coming soon”; 2026 used waves due Jan 31, Feb 28 and Apr 14",
    contact: { email: "contact@ddidebate.org" },
    website: "https://www.ddidebate.org/",
  },
  {
    code: "ENDI",
    name: "Emory National Debate Institute (ENDI)",
    host: "Emory University, Barkley Forum",
    about: "The Barkley Forum's high school policy institute, running since 1966.",
    location: "Emory University, Atlanta, GA",
    events: "2-week Policy, beginner through experienced",
    dates: "2027: June 1–12",
    cost: "$2,200 residential / $1,850 commuter; $200 deposit option",
    deadline: "Registration open; final deadline not listed",
    contact: { email: "emorydebateinstitute@gmail.com", phone: "678-205-6281" },
    website: "https://barkleyforum.emory.edu/institutes/high-school/index.html",
  },
  {
    code: "GDI",
    name: "Gonzaga Debate Institute (GDI)",
    host: "Gonzaga University",
    about: "Pacific Northwest institute with five-, three- and two-week policy programs and a two-week LD lab.",
    location: "Gonzaga University, Spokane, WA",
    events: "5-week, 3-week and 2-week Policy (CX); 2-week Lincoln-Douglas",
    dates: "2027: 5-week CX June 20–July 24; 2-week CX and LD July 11–24",
    cost: "Dorm / commuter with meals / commuter: 5-week $5,500 / $2,750 / $1,375; 3-week $3,450 / $1,900 / $950; 2-week $2,300 / $1,300 / $650",
    deadline: "No final deadline listed; 5% discount for applying before Feb 1",
    contact: { phone: "(509) 313-6663" },
    website:
      "https://www.gonzaga.edu/college-of-arts-sciences/departments/communication-studies/gonzaga-debate/gonzaga-debate-institute",
  },
  {
    code: "GDS",
    name: "Georgetown Debate Seminar (GDS)",
    host: "Georgetown University",
    about: "Long-standing policy institute with novice, second-year and advanced tracks.",
    location: "Georgetown University, Washington, DC",
    events: "Policy: 3-week (novice, 2nd year, advanced), 2-week, optional 1-week intro",
    dates: "2027: 3-week June 27–July 16; 2-week June 27–July 10; intro week June 20–26",
    cost: "TBA",
    deadline: "Applications open soon; deadline not listed",
    contact: {},
    website: "https://debate.georgetown.edu/georgetown-debate-seminar/georgetown-policy-debate-seminar/",
  },
  {
    code: "HDC",
    name: "Harvard Debate Council Summer Workshops",
    host: "Harvard Debate Council",
    about: "World-class summer workshops in every event, taught by Ivy League champions and circuit coaches.",
    location: "Harvard University, Cambridge, MA (some sessions online)",
    events: "Policy, PF, LD, Congress, World Schools, public speaking, middle school, coaches' workshops",
    dates: "2027: Session 1 June 27–July 9; Session 2 July 11–23",
    cost: "From $3,249 (PF, LD, World Schools) and $1,649 (Policy, Congress, public speaking)",
    deadline: "Registration opens Dec 1, 2026; final deadline not listed",
    contact: { phone: "(617) 495-4822" },
    website: "https://hdcsw.org/",
  },
  {
    code: "JDI",
    name: "Jayhawk Debate Institute (JDI)",
    host: "University of Kansas",
    about: "Kansas policy institute with novice through advanced labs, a K lab and a coaches workshop.",
    location: "University of Kansas, Lawrence, KS",
    events: "2-week Policy (novice, intermediate, advanced); 3-week advanced Policy; 3-week K lab; coaches workshop",
    dates: "2026 ran June 21–July 3 (2-week) and June 21–July 10 (3-week); 2027 dates on the camp site",
    cost: "Tuition on the camp site; no extra fees beyond tuition",
    deadline: "Not listed",
    contact: { email: "sharris@ku.edu", phone: "785-864-9878" },
    website: "https://debate.ku.edu/jdi-general-information",
  },
  {
    code: "KKB",
    name: "Kankee Briefs",
    host: "Independent brief writer",
    about: "Policy topic briefs and evidence files posted to openev; a publisher, not a camp.",
    location: "Online",
    events: "Policy topic briefs and evidence",
    dates: "Not applicable",
    cost: "Free on openev",
    deadline: "Not applicable",
    contact: {},
    website: `https://opencaselist.com/openev/${OPENEV_YEAR}/KKB`,
  },
  {
    code: "MGC",
    name: "Mean Green Comet Debate Institute",
    host: "UT Dallas and the University of North Texas",
    about: "Policy, LD, PF, Congress and speech programs, with middle school options.",
    location: "UT Dallas, Richardson, TX",
    events: "Policy, LD, PF, Congress, Extemp, competitive speech, public speaking; middle school LD, PF and speaking",
    dates: "2027: Policy, LD and PF June 20–July 3; other sessions through July 10",
    cost: "$1,075–$3,475 by session and housing; Policy/LD/PF $2,475 residential / $1,925 commuter",
    deadline: "Registration opens Jan 1, 2027; deadline June 1, 2027",
    contact: { email: "scott.herndon@utdallas.edu" },
    website: "https://debatecamp.utdallas.edu/",
  },
  {
    code: "MNDI",
    name: "Michigan National Debate Institute (MNDI)",
    host: "University of Michigan",
    about: "Michigan's three-week policy workshop for novice through advanced debaters.",
    location: "University of Michigan, Ann Arbor, MI",
    events: "Policy, novice through advanced",
    dates: "2027: June 20–July 7",
    cost: "$3,600; no application fee; $500 deposit after admission",
    deadline: "Apply by June 1; financial aid by March 1; balance due May 1",
    contact: {},
    website: "https://michigandebate.com/mndi/",
  },
  {
    code: "MSDI",
    name: "Missouri State Debate Institute (MSDI)",
    host: "Missouri State University",
    about: "Affordable two-week policy camp with one-week PF, LD, novice CX and speech camps.",
    location: "Missouri State University, Springfield, MO (online policy option)",
    events: "2-week Policy; 1-week PF, LD, novice CX, individual events; middle school advocacy",
    dates: "2026 ran June 28–July 11 (policy) and July 12–17 (event camps)",
    cost: "2-week $700 commuter or online / $1,500 with dorm; event camps $350 / $700",
    deadline: "2026 registration closed June 5; $50 off by March 31; scholarships by May 1",
    contact: { name: "Eric Morris, Director", email: "ericmorris@missouristate.edu", phone: "417-836-5218" },
    website: "https://debate.missouristate.edu/camp.htm",
  },
  {
    code: "NHSI",
    name: "Northwestern NHSI Debate Institute",
    host: "Northwestern University",
    about: "The National High School Institute, the “cherubs” program, one of the oldest debate institutes in the country.",
    location: "Northwestern University, Evanston, IL",
    events: "Policy only",
    dates: "2027: 4 weeks June 27–July 24; 6 weeks June 27–Aug 7",
    cost: "Tuition TBA; $60 application fee",
    deadline: "Opens winter 2027; rolling; aid applicants by April 26; final deadline May 28",
    contact: { email: "nhsi@northwestern.edu" },
    website: "https://nhsi.northwestern.edu/summer-institutes/debate/",
  },
  {
    code: "RKS",
    name: "Wake Forest Debate Workshops (RKS)",
    host: "Wake Forest University",
    about: "Wake Forest's debate and public advocacy institute for high schoolers.",
    location: "Wake Forest University, Winston-Salem, NC",
    events: "Debate and public advocacy (one week, overnight)",
    dates: "2027: July 11–16 or July 18–23",
    cost: "$3,500 overnight",
    deadline: "Not listed; open to current grades 9–12",
    contact: { name: "Justin Green, academic leader" },
    website: "https://immersion.summer.wfu.edu/on-campus-institutes/debate-and-public-advocacy-institute/",
  },
  {
    code: "SA",
    name: "Sonoma Academy Debate Camp",
    host: "Sonoma Academy",
    about: "Beginner and advanced policy camp with online and in-person tiers.",
    location: "Sonoma Academy, Santa Rosa, CA (advanced tiers partly online)",
    events: "Beginner debate (in person); Advanced tiers 1–2 (online) and tier 3 (hybrid)",
    dates: "2026 ran July 13–17 (beginner) and July 17–Aug 15 (advanced)",
    cost: "Beginner $500; advanced $500 / $1,000 / $1,500 by tier",
    deadline: "Not listed for 2027",
    contact: { name: "Alyssa Lucas-Bolin", email: "alyssa.lucas-bolin@sonomaacademy.org", phone: "(707) 545-1770" },
    website: "https://www.sonomaacademy.org/debate-camp-2026",
  },
  {
    code: "UM7",
    name: "Michigan Seven Week",
    host: "University of Michigan",
    about: "Michigan's seven-week advanced policy intensive, known for its research standards.",
    location: "University of Michigan, Ann Arbor, MI",
    events: "Advanced Policy",
    dates: "2027: June 20–Aug 3",
    cost: "$7,350 + $65 application fee",
    deadline: "Apply by June 1; rolling admission; balance due May 1",
    contact: {},
    website: "https://michigandebate.com/seven-week-program/",
  },
  {
    code: "UMC",
    name: "Michigan Classic",
    host: "University of Michigan",
    about: "Michigan's shorter-format policy program, residential or online, with a Classic Plus option.",
    location: "University of Michigan, Ann Arbor, MI (or online)",
    events: "Policy",
    dates: "2027: July 8–Aug 3 (Classic Plus July 4–Aug 3)",
    cost: "Residential $5,050; online $3,000; Classic Plus $5,750; + $65 application fee",
    deadline: "Apply by June 1; financial aid by March 1; balance due May 1",
    contact: {},
    website: "https://michigandebate.com/classic/",
  },
  {
    code: "UTNIF",
    name: "UT National Institute in Forensics (UTNIF)",
    host: "University of Texas at Austin",
    about: "UT Austin's debate and speech institute, with one- and two-week programs.",
    location: "University of Texas at Austin, Austin, TX",
    events: "Policy, LD, PF, Congress, World Schools, intro to forensics",
    dates: "Latest listed: 1 week June 28–July 4; 2 weeks June 28–July 11",
    cost: "1 week $1,400; 2 weeks $2,800; $250 application fee credited to tuition",
    deadline: "Balance due June 1; dorm space may fill after June 1",
    contact: { email: "commstudies@austin.utexas.edu", phone: "512-471-5251" },
    website: "https://commstudies.utexas.edu/camps/utnif-debate",
  },
  {
    code: "WYO",
    name: "Wyoming Forensics Institute",
    host: "University of Wyoming",
    about: "University of Wyoming Speech and Debate's high school summer workshop.",
    location: "University of Wyoming, Laramie, WY",
    events: "High school debate workshop",
    dates: "Not listed",
    cost: "Not listed",
    deadline: "Not listed",
    contact: { email: "david.rooney@uwyo.edu", phone: "(307) 766-3122" },
    website: "https://www.uwyo.edu/cojo/debate",
  },
];

/** The official publishers, in the order of the openev index. */
export const CAMP_PUBLISHERS: readonly CampPublisher[] = ENTRIES.map((entry) => ({
  ...entry,
  slug: campPublisherSlug(entry.code),
  openevUrl: `https://opencaselist.com/openev/${OPENEV_YEAR}/${entry.code}`,
}));

const BY_CODE = new Map(CAMP_PUBLISHERS.map((camp) => [camp.code, camp]));
const BY_SLUG = new Map(CAMP_PUBLISHERS.map((camp) => [camp.slug, camp]));

/** `"DDI"` → `"camp-ddi"`. */
export function campPublisherSlug(code: string): string {
  return `camp-${code.toLowerCase()}`;
}

/** A publisher by its code, any case. */
export function findCampPublisher(code: string | null | undefined): CampPublisher | null {
  return code ? BY_CODE.get(code.toUpperCase()) ?? null : null;
}

/** A publisher by its page slug (`camp-ddi`). */
export function findCampPublisherBySlug(slug: string | null | undefined): CampPublisher | null {
  return slug ? BY_SLUG.get(slug.toLowerCase()) ?? null : null;
}

/** Words that trail a code and are skipped: years, versions, copy markers. */
const TRAILING_NOISE = /^(?:\d+|v\d+|final|updated|copy|draft)$/i;

/** How many name tokens from the end are searched for a code. */
const TOKENS_SEARCHED = 6;

function matchToken(token: string): CampPublisher | null {
  // Two-letter codes ("SA") must be written in capitals so a word like
  // "Sa" in a title doesn't count; longer codes match in any case.
  const exact = BY_CODE.get(token);
  if (exact) return exact;
  const upper = token.toUpperCase();
  const loose = BY_CODE.get(upper);
  if (loose && loose.code.length > 2) return loose;
  // "DDI26", "MNDI2026": a code with the year glued on.
  const glued = /^([A-Za-z]+\d?)(?:\d{2}|\d{4})$/.exec(token);
  if (glued) {
    const stem = BY_CODE.get(glued[1].toUpperCase());
    if (stem && (stem.code.length > 2 || glued[1] === stem.code)) return stem;
  }
  return null;
}

/**
 * The publisher named at the end of a file name, or `null` when none is.
 *
 * Openev files end with the camp code, often followed by the year and lab
 * initials: `Spending DA - DDI 2026 RS.docx`, `K - Cap - GDS 2025.docx`,
 * `Hege Good MNDI26`. The extension is dropped, then the last few words are
 * searched from the end, so the right-most code wins.
 */
export function detectCampPublisher(fileName: string | null | undefined): CampPublisher | null {
  if (!fileName) return null;
  const base = fileName.trim().replace(/\.(?:docx?|pdf|html?|txt|rtf|md|json)$/i, "");
  const tokens = base.split(/[^A-Za-z0-9]+/).filter(Boolean);
  let searched = 0;
  for (let i = tokens.length - 1; i >= 0 && searched < TOKENS_SEARCHED; i--) {
    const token = tokens[i];
    const camp = matchToken(token);
    if (camp) return camp;
    if (!TRAILING_NOISE.test(token)) searched++;
  }
  return null;
}

/** The publisher's display name for a file: its camp's name, or "Unsorted". */
export function publisherNameForFile(fileName: string | null | undefined): string {
  return detectCampPublisher(fileName)?.name ?? UNSORTED_PUBLISHER;
}
