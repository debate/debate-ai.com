/**
 * @fileoverview The academics rank high school pages show: a school's
 * position in Niche's 2027 Best High Schools in America list (public and
 * private combined, first eight pages, 200 schools), as Alexa supplied it on
 * 2026-11-21. It is the only academics ranking the site gives high schools.
 *
 * "Position" is the place in the combined results, not Niche's separate
 * public or private rank badge. Niche's own pages skip private rank 125 on
 * page 7 and repeat 148 on page 8; the displayed order is kept as is.
 * Online schools are included and marked.
 *
 * @module schools/niche-academics
 */

/** Where the list comes from. */
export const NICHE_ACADEMICS_SOURCE = {
  label: "Niche 2027 Best High Schools in America",
  url: "https://www.niche.com/k12/search/best-high-schools/",
} as const

/** One school on the list. */
export interface NicheAcademicsSchool {
  /** Position in the combined list, 1 = best. */
  position: number
  name: string
  /** Two-letter state. */
  state: string
  type: "Public" | "Private" | "Private, online"
  /** Position among the list's schools in the same state, 1 = best in the state. */
  stateRank: number
}

type Row = [name: string, state: string, type?: "pub" | "online"]

// In list order; private unless marked "pub" (public) or "online" (private, online).
const ROWS: Row[] = [
  ["North Carolina School of Science and Mathematics", "NC", "pub"],
  ["The Davidson Academy", "NV", "pub"],
  ["Phillips Academy Andover", "MA"],
  ["South Carolina Governor’s School for Science and Mathematics", "SC", "pub"],
  ["Groton School", "MA"],
  ["Phillips Exeter Academy", "NH"],
  ["The Lawrenceville School", "NJ"],
  ["Choate Rosemary Hall", "CT"],
  ["The Chapin School", "NY"],
  ["Harvard-Westlake School", "CA"],
  ["Horace Mann School", "NY"],
  ["The Hotchkiss School", "CT"],
  ["Stanford Online High School", "CA", "online"],
  ["BASIS Independent Manhattan", "NY"],
  ["St. Paul’s School", "NH"],
  ["Princeton International School of Math and Science", "NJ"],
  ["Deerfield Academy", "MA"],
  ["Riverdale Country School", "NY"],
  ["Noble and Greenough School", "MA"],
  ["Cate School", "CA"],
  ["Dwight Global Online School", "FL", "online"],
  ["The Loomis Chaffee School", "CT"],
  ["The College Preparatory School", "CA"],
  ["Rye Country Day School", "NY"],
  ["St. Andrew’s School", "DE"],
  ["Crimson Global Academy, USA", "FL", "online"],
  ["BASIS Independent Brooklyn", "NY"],
  ["MA Academy for Math & Science School", "MA", "pub"],
  ["Boston University Academy", "MA"],
  ["The Spence School", "NY"],
  ["St. John’s School", "TX"],
  ["Stuyvesant High School", "NY", "pub"],
  ["Pine View School", "FL", "pub"],
  ["Head-Royce School", "CA"],
  ["Ideaventions Academy for Math and Science", "VA"],
  ["Payton College Preparatory High School", "IL", "pub"],
  ["Northside College Preparatory High School", "IL", "pub"],
  ["British International School of Washington", "DC"],
  ["Commonwealth School", "MA"],
  ["Castilleja School", "CA"],
  ["Oklahoma School of Science and Mathematics", "OK", "pub"],
  ["Regis High School", "NY"],
  ["International Academy", "MI", "pub"],
  ["School for the Talented & Gifted", "TX", "pub"],
  ["Lick-Wilmerding High School", "CA"],
  ["Avenues The World School", "NY"],
  ["Veritas Collegiate Academy — Arlington", "VA"],
  ["Milton Academy", "MA"],
  ["Hopkins School", "CT"],
  ["The Taft School", "CT"],
  ["The Bishop’s School", "CA"],
  ["The Nightingale-Bamford School", "NY"],
  ["Ransom Everglades School", "FL"],
  ["The Peddie School", "NJ"],
  ["American Heritage Schools, Broward Campus", "FL"],
  ["Concord Academy", "MA"],
  ["Bronx High School of Science", "NY", "pub"],
  ["The Quarry Lane School", "CA"],
  ["Middlesex School", "MA"],
  ["The Nueva School", "CA"],
  ["Illinois Mathematics and Science Academy", "IL", "pub"],
  ["Marlborough School", "CA"],
  ["Gravitas: A Global Extension of The Stony Brook School", "NY", "online"],
  ["Whitney M. Young Magnet High School", "IL", "pub"],
  ["Lake Forest Academy", "IL"],
  ["The Village School", "TX"],
  ["Newark Academy", "NJ"],
  ["A.D. Henderson University School & FAU High School", "FL", "pub"],
  ["Posnack Jewish Day School", "FL"],
  ["Sidwell Friends School", "DC"],
  ["Pierrepont School", "CT"],
  ["Indiana Academy for Science, Mathematics, and Humanities", "IN", "pub"],
  ["Cranbrook Schools", "MI"],
  ["High School Math Science & Engineering at CCNY", "NY", "pub"],
  ["The Hockaday School", "TX"],
  ["Berkeley Preparatory School", "FL"],
  ["Gwinnett School of Mathematics, Science & Technology", "GA", "pub"],
  ["The Dalton School", "NY"],
  ["Convent of the Sacred Heart", "NY"],
  ["Brentwood School", "CA"],
  ["Windward School", "CA"],
  ["Elite Preparatory Academy", "NJ"],
  ["Menlo School", "CA"],
  ["British International School of Chicago, South Loop", "IL"],
  ["Miss Porter’s School", "CT"],
  ["Washington Preparatory School", "WA"],
  ["The Westminster Schools", "GA"],
  ["Princeton Day School", "NJ"],
  ["Davidson Academy Online", "NV", "online"],
  ["BASIS Independent McLean", "VA"],
  ["Ethical Culture Fieldston School", "NY"],
  ["Collegiate School", "NY"],
  ["School of Science & Engineering", "TX", "pub"],
  ["Aeon School", "NY", "online"],
  ["The Academy for Mathematics, Science & Engineering", "NJ", "pub"],
  ["St. Stephen’s Episcopal School", "TX"],
  ["Alabama School of Mathematics and Science", "AL", "pub"],
  ["The Awty International School", "TX"],
  ["Crystal Springs Uplands School", "CA"],
  ["United World College-USA", "NM"],
  ["Signature School", "IN", "pub"],
  ["Delbarton School", "NJ"],
  ["Thomas Jefferson High School for Science & Technology", "VA", "pub"],
  ["The Branson School", "CA"],
  ["The Pingry School", "NJ"],
  ["Crossroads School for Arts & Sciences", "CA"],
  ["California Academy of Mathematics & Science", "CA", "pub"],
  ["Blair Academy", "NJ"],
  ["TCS", "TX", "online"],
  ["Durham Academy", "NC"],
  ["The Bryn Mawr School", "MD"],
  ["John Burroughs School", "MO"],
  ["The Overlake School", "WA"],
  ["St. Mark’s School", "MA"],
  ["Hackley School", "NY"],
  ["The Hill School", "PA"],
  ["Saint Ann’s School", "NY"],
  ["The John Cooper School", "TX"],
  ["Eastside Preparatory School", "WA"],
  ["Woodberry Forest School", "VA"],
  ["The Roxbury Latin School", "MA"],
  ["French-American School of New York", "NY"],
  ["St. Mark’s School of Texas", "TX"],
  ["Cistercian Preparatory School", "TX"],
  ["Georgetown Day School", "DC"],
  ["Friends Academy", "NY"],
  ["North Shore Country Day", "IL"],
  ["Polytechnic School", "CA"],
  ["Mercersburg Academy", "PA"],
  ["Westridge School", "CA"],
  ["Pine Crest School — Fort Lauderdale Campus", "FL"],
  ["Greenhill School", "TX"],
  ["NSU University School", "FL"],
  ["Veritas Collegiate Academy, Chesapeake", "VA"],
  ["Lakeside School", "WA"],
  ["British International School of New York", "NY"],
  ["The Thacher School", "CA"],
  ["The Madeira School", "VA"],
  ["St. Albans School", "DC"],
  ["BASIS Scottsdale", "AZ", "pub"],
  ["Washington International School", "DC"],
  ["Chadwick School", "CA"],
  ["Lane Tech College Prep High School", "IL", "pub"],
  ["National Cathedral School", "DC"],
  ["The Browning School", "NY"],
  ["Georgetown Preparatory School", "MD"],
  ["Fulton Science Academy Private School", "GA"],
  ["Gilman School", "MD"],
  ["Episcopal High School", "VA"],
  ["Montclair Kimberley Academy", "NJ"],
  ["BASIS Ahwatukee", "AZ", "pub"],
  ["NeoCity Academy", "FL", "pub"],
  ["The Early College at Guilford", "NC", "pub"],
  ["Sierra Canyon School", "CA"],
  ["Waterford School", "UT"],
  ["Sage Hill School", "CA"],
  ["Trinity School", "NY"],
  ["Townsend Harris High School", "NY", "pub"],
  ["Staten Island Technical High School", "NY", "pub"],
  ["TMI Episcopal", "TX"],
  ["Half Hollow Hills High School West", "NY", "pub"],
  ["Strake Jesuit College Preparatory", "TX"],
  ["Indian Springs School", "AL"],
  ["Woodside Priory School", "CA"],
  ["Greenhills School", "MI"],
  ["Syosset Senior High School", "NY", "pub"],
  ["Girls Academic Leadership Academy: Dr. Michelle King School for STEM", "CA", "pub"],
  ["San Francisco High School of the Arts", "CA"],
  ["Moravian Academy", "PA"],
  ["Pace Academy", "GA"],
  ["Spring Branch Academic Institute", "TX", "pub"],
  ["Bentley School", "CA"],
  ["San Francisco University High School", "CA"],
  ["Lycée Français de New York", "NY"],
  ["Marymount School of New York", "NY"],
  ["Maharishi School", "IA"],
  ["The Frederick Gunn School", "CT"],
  ["The Hewitt School", "NY"],
  ["Oakwood School", "CA"],
  ["Carnegie Vanguard High School", "TX", "pub"],
  ["High School of American Studies at Lehman College", "NY", "pub"],
  ["Springfield Commonwealth Academy", "MA"],
  ["The Webb Schools", "CA"],
  ["Adlai E. Stevenson High School", "IL", "pub"],
  ["The Meadows School", "NV"],
  ["Suffield Academy", "CT"],
  ["Alexander W. Dreyfoos Jr. School of the Arts", "FL", "pub"],
  ["Pilgrim School", "CA"],
  ["Marine Academy of Technology & Environmental Science", "NJ", "pub"],
  ["Léman Manhattan Preparatory School", "NY"],
  ["The Stony Brook School", "NY"],
  ["Asia Pacific International School", "HI"],
  ["Maret School", "DC"],
  ["Francis Parker School", "CA"],
  ["British International School of Boston", "MA"],
  ["Pomfret School", "CT"],
  ["Gulliver Preparatory School", "FL"],
  ["Prestige STEM Academy", "CA", "online"],
  ["Khan Lab School", "CA"],
  ["Cary Academy", "NC"],
]

/** Every school on the list, in position order. */
const seenInState = new Map<string, number>()
export const NICHE_ACADEMICS: NicheAcademicsSchool[] = ROWS.map(([name, state, kind], index) => {
  const stateRank = (seenInState.get(state) ?? 0) + 1
  seenInState.set(state, stateRank)
  return {
    position: index + 1,
    name,
    state,
    type: kind === "pub" ? "Public" : kind === "online" ? "Private, online" : "Private",
    stateRank,
  }
})

/** Words that don't tell two schools apart. */
const FILLER = new Set(["the", "school", "high", "hs", "senior", "of", "and", "at", "for", "a", "an"])

/**
 * A school name reduced to the words that identify it: lowercase, accents
 * and punctuation gone, `&` → `and`, a trailing state tag dropped, filler
 * words ("The", "School", "High") removed. `Whitney M. Young Magnet High
 * School` and `Whitney Young` both keep `whitney … young`.
 */
export function nicheNameKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\(([a-z]{2})\)\s*$/i, "")
    .replace(/[’'.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word && !FILLER.has(word))
    .join(" ")
}

/** Debate names that differ from Niche's for the same school. */
const ALIASES: Record<string, string> = {
  "whitney young": "Whitney M. Young Magnet High School",
  "walter payton": "Payton College Preparatory High School",
  "payton": "Payton College Preparatory High School",
  "northside": "Northside College Preparatory High School",
  "northside prep": "Northside College Preparatory High School",
  "thomas jefferson": "Thomas Jefferson High School for Science & Technology",
  "tjhsst": "Thomas Jefferson High School for Science & Technology",
  "bronx science": "Bronx High School of Science",
  "stuyvesant": "Stuyvesant High School",
  "harvard westlake": "Harvard-Westlake School",
  "college prep": "The College Preparatory School",
  "andover": "Phillips Academy Andover",
  "exeter": "Phillips Exeter Academy",
  "lawrenceville": "The Lawrenceville School",
  "choate": "Choate Rosemary Hall",
  "hotchkiss": "The Hotchkiss School",
  "nueva": "The Nueva School",
  "imsa": "Illinois Mathematics and Science Academy",
  "ncssm": "North Carolina School of Science and Mathematics",
  "st marks": "St. Mark’s School of Texas",
  "st marks texas": "St. Mark’s School of Texas",
  "strake jesuit": "Strake Jesuit College Preparatory",
  "stevenson": "Adlai E. Stevenson High School",
  "adlai stevenson": "Adlai E. Stevenson High School",
  "lane tech": "Lane Tech College Prep High School",
  "pine crest": "Pine Crest School — Fort Lauderdale Campus",
  "american heritage": "American Heritage Schools, Broward Campus",
  "american heritage broward": "American Heritage Schools, Broward Campus",
  "ransom everglades": "Ransom Everglades School",
  "university school": "NSU University School",
  "nsu university": "NSU University School",
  "gulliver": "Gulliver Preparatory School",
  "gulliver prep": "Gulliver Preparatory School",
  "greenhill": "Greenhill School",
  "hockaday": "The Hockaday School",
  "st johns": "St. John’s School",
  "carnegie vanguard": "Carnegie Vanguard High School",
  "sidwell": "Sidwell Friends School",
  "georgetown day": "Georgetown Day School",
  "gds": "Georgetown Day School",
  "lakeside": "Lakeside School",
  "polytechnic": "Polytechnic School",
  "poly": "Polytechnic School",
  "head royce": "Head-Royce School",
  "menlo": "Menlo School",
  "marlborough": "Marlborough School",
  "brentwood": "Brentwood School",
  "sage hill": "Sage Hill School",
  "dalton": "The Dalton School",
  "horace mann": "Horace Mann School",
  "regis": "Regis High School",
  "hackley": "Hackley School",
  "pingry": "The Pingry School",
  "delbarton": "Delbarton School",
  "newark academy": "Newark Academy",
  "montclair kimberley": "Montclair Kimberley Academy",
  "westminster": "The Westminster Schools",
  "pace": "Pace Academy",
  "durham": "Durham Academy",
  "cary": "Cary Academy",
  "john burroughs": "John Burroughs School",
  "cranbrook": "Cranbrook Schools",
  "lick wilmerding": "Lick-Wilmerding High School",
  "crystal springs": "Crystal Springs Uplands School",
  "bishops": "The Bishop’s School",
  "francis parker": "Francis Parker School",
  "chadwick": "Chadwick School",
  "sierra canyon": "Sierra Canyon School",
}

const BY_KEY: Map<string, NicheAcademicsSchool> = (() => {
  const map = new Map<string, NicheAcademicsSchool>()
  const byName = new Map(NICHE_ACADEMICS.map((school) => [school.name, school]))
  for (const school of NICHE_ACADEMICS) {
    const key = nicheNameKey(school.name)
    if (!map.has(key)) map.set(key, school)
  }
  for (const [alias, name] of Object.entries(ALIASES)) {
    const school = byName.get(name)
    const key = nicheNameKey(alias)
    if (school && !map.has(key)) map.set(key, school)
  }
  return map
})()

/**
 * A high school's place on the Niche list, or `null` when it isn't in the
 * top 200 (or the name can't be matched). Names match on their identifying
 * words ({@link nicheNameKey}) or a known debate alias, so "Whitney Young",
 * "Bronx Science" and "Harvard-Westlake School (CA)" all resolve.
 *
 * @param school - The school as the rankings or a profile spell it.
 */
export function findNicheAcademicsRank(school: string | null | undefined): NicheAcademicsSchool | null {
  if (!school) return null
  return BY_KEY.get(nicheNameKey(school)) ?? null
}
