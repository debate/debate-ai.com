# @debate-ai/school-rank

The top U.S. colleges and the top public and private high schools, each with
its **U.S. News & World Report** rank (and, for high schools, its **Niche**
rank), a **Fuse.js** fuzzy search that can be limited to colleges or high
schools, and the school's **wordmark logo** from this package's `wordmarks/`
folder (paths listed in `src/data/wordmarks.ts`).

```ts
import { searchSchools, searchSchoolsFromParams, topSchools, wordmarkCoverage } from "@debate-ai/school-rank"
import { wordmarkSrc } from "@debate-ai/school-rank/wordmarks" // png URLs; needs a bundler

searchSchools("harvard", { level: "college" })[0]
// → { school: { name: "Harvard University", usNewsRank: 3, type: "private", … }, score: 0, wordmark: "colleges/harvard.png" }

searchSchools("harvard", { level: "high-school" })[0].school.name // "Harvard-Westlake School"
searchSchoolsFromParams("q=bronx%20science&level=hs")[0].wordmark // "high-schools/bronx.png"
topSchools("private-high-school", 10)                             // Niche private top 10
wordmarkSrc(searchSchools("yale")[0].school)                      // "/assets/yale-….png"
```

## What's in it

| Division | Schools bundled | Ranked by | Source |
| --- | --- | --- | --- |
| Colleges | 108 in the top 100 (ties), plus 14 colleges with a wordmark outside it | U.S. News **2027 Best National Universities** | Released 2026-09-22. Ranks copied from [Poets & Quants' top-100 table](https://poetsandquantsforundergrads.com/news/u-s-news-best-colleges-ranking-2027-mit-ends-princetons-long-run-at-the-top/2/), 1–11 checked against [Master Grad Schools](https://mastergradschools.com/master-rankings/us-news-best-national-universities-rankings-2027) |
| Public high schools | 1,001 | U.S. News **2026-2027 Best High Schools** where sourced (42 schools), Niche **2027** public rank for all | U.S. News [press release](https://aijourn.com/u-s-news-reveals-2026-2027-best-high-schools-rankings/) (1–10), [Black America Web](https://blackamericaweb.com/2026/10/16/top-20-high-schools-in-america-for-2026-27/) (11–20), [AZFamily](https://www.azfamily.com/2026/08/18/report-13-arizona-charter-public-high-schools-rank-among-top-100-nationwide/) (Arizona), [FOX 5 NY](https://www.fox5ny.com/news/best-public-high-schools-ny-nj-2026-us-news) (NY, NJ). Niche lists are the ones `@debate-ai/rankings` already bundles for school pages |
| Private high schools | 800 | Niche **2027** private rank | U.S. News does not rank private high schools, so `usNewsRank` is always `null` here |

**1,923 schools** in all, **51** with a wordmark.

### Gaps, stated plainly

- **Public high schools:** U.S. News ranks 1–20 are complete. Past 20, only
  ranks published in the news articles above are bundled (ranks 28–84 for
  Arizona, New York and New Jersey schools, plus 187 and 201), so 40 of the
  U.S. News top 100 are known. Every other public school's `usNewsRank` is
  `null` because it wasn't sourced, not because the school is unranked.
- **Colleges outside the top 100** (Kansas, Kentucky, Houston, Oklahoma, …)
  are included only because they have a wordmark. Their `usNewsRank` is `null`.
  Macalester (National Liberal Arts Colleges) and Redlands (Regional
  Universities West) are on different U.S. News lists entirely.
- **College states and public/private control** are filled in from each
  school's location and control, because the ranking tables don't include
  them. **High school cities** appear only where a source gives one.
- The Niche lists came from Alexa's 2026-11-21 upload. That source skips
  public rank 251 and repeats private rank 148.

## API

| Export | What it does |
| --- | --- |
| `searchSchools(query, options?)` | Fuse.js search over name, nicknames, city and state. An exact name or alias (`"MIT"`, `"LASA"`, `"Bronx Science"`) always comes first. Options: `level` (`"college"` / `"high-school"`), `type` (`"public"` / `"private"`), `division`, `state`, `hasWordmark`, `limit` (default 10). |
| `parseSchoolSearchParams(params)` / `searchSchoolsFromParams(params)` | Read the same options from a query string: `?q=westwood&level=hs&state=TX&type=public&wordmark=1&limit=5`. `level` accepts `college`, `university`, `high-school`, `high school` and `hs`. |
| `topSchools(division, count?, by?)` | The best ranked schools in a division. By default colleges and public high schools sort by U.S. News, private high schools by Niche. Pass `"niche"` to sort public high schools by Niche. |
| `wordmarkCoverage(division, top?)` / `allWordmarkCoverage(top?)` | How many of a division's top N have a wordmark. |
| `getSchool(id)`, `SCHOOLS`, `schoolsInDivision(division)` | Raw access. An id is the name slug plus the state, e.g. `yale-university-ct`. |
| `wordmarkSrc(schoolOrFile)` (from `/wordmarks`) | The png URL for a school's wordmark, or `null`. The main entry never imports images, so it runs in plain Node. |
| `COLLEGE_RANK_SOURCE`, `HIGH_SCHOOL_RANK_SOURCE`, `NICHE_RANK_SOURCE` | Attribution for each list, to show next to any rank you display. |

Each school is a `RankedSchool`: `id`, `name`, `level`, `type`, `division`,
`city`, `state`, `aliases`, `usNewsRank`, `nicheRank`, `wordmark`.

## Compiled rank lists (`data/*.json`)

Three JSON files hold the lists exactly as they were compiled from the
sources, ties and gaps included. They are the raw record: `SCHOOLS` and the
search still use the rows above, and the helpers below check the two against
each other.

| File | List | Entries | Ranks compiled | Known gaps |
| --- | --- | ---: | --- | --- |
| `data/us-news-2027-national-universities.json` | U.S. News 2027 Best National Universities | 108 | 1-100 (complete, 9-way tie at No. 100) | none; ranks past 100 are out of scope |
| `data/niche-2027-public-high-schools.json` | Niche 2027 public high schools, national | 200 | 1-50, 76-100, 126-150, 176-250, 601-625 | 51-75, 101-125, 151-175, 251-600, 626-1001 |
| `data/niche-2027-private-high-schools.json` | Niche 2027 private high schools, national | 50 | 1-25, 775-799 | 26-774, 800 |

Schema (`RankList`, exported as a type; `schemaVersion` 1):

```jsonc
{
  "schemaVersion": 1,
  "source": { "publisher": "Niche", "list": "…", "url": "https://…", "publishedAt": "optional", "listLabel": "optional" },
  "year": 2027,
  "listType": "national-universities" | "public-high-schools" | "private-high-schools",
  "level": "college" | "high-school",
  "schoolType": "public" | "private",             // high school lists only
  "metadata": {
    "complete": false,                            // true only when knownGaps is empty
    "firstRank": 1, "lastRank": 1001, "entryCount": 200,
    "rankRangesPresent": [{ "from": 1, "to": 50 }],
    "knownGaps": [{ "from": 51, "to": 75, "reason": "…" }],
    "notes": ["…"]
  },
  "entries": [
    { "rank": 5, "tie": true, "name": "Stanford University", "city": "optional", "state": "optional", "locationRaw": "optional" }
  ]
}
```

- `tie` is `true` when another entry shares the rank; the next rank skips
  the tied schools (5, 5, 7).
- `city` and `state` appear only where the source states them. The college
  list has neither. `locationRaw` keeps text that could not be read safely:
  the source's "(LA)" for Girls Academic Leadership Academy means Los
  Angeles, so it is not stored as Louisiana.
- A rank inside a `knownGaps` range is **unknown, not unranked**. Nothing is
  guessed; `rankStatus(id, rank)` returns `"present"`, `"gap"` or `"outside"`.

```ts
import {
  NICHE_2027_PUBLIC_HIGH_SCHOOLS, RANK_LISTS, entriesAtRank, entriesInRankRange,
  findRankEntry, rankStatus, reconcileSchool, wordmarkRankCoverage,
} from "@debate-ai/school-rank"

rankStatus("niche-2027-public-high-schools", 300)            // "gap"
entriesAtRank("us-news-2027-national-universities", 5)       // Caltech and Stanford
findRankEntry("us-news-2027-national-universities", "University of California, Berkeley")
// → { list, entry: { rank: 20, tie: true, … }, matchedBy: "name" }
reconcileSchool(searchSchools("bronx science")[0].school).status // "matched"
wordmarkRankCoverage("college")                              // { total: 29, matched: 15, unmatched: [14 colleges] }
```

| Export | What it does |
| --- | --- |
| `US_NEWS_2027_NATIONAL_UNIVERSITIES`, `NICHE_2027_PUBLIC_HIGH_SCHOOLS`, `NICHE_2027_PRIVATE_HIGH_SCHOOLS`, `RANK_LISTS`, `RANK_LIST_IDS`, `getRankList(id)` | The typed lists. The JSON is also importable as `@debate-ai/school-rank/data/<file>.json`. |
| `rankStatus(id, rank)`, `entriesAtRank(id, rank)`, `entriesInRankRange(id, from, to)` | Look up a rank. A gap or out-of-range rank returns `"gap"` / `"outside"` or `[]`, never a guess. |
| `findRankEntry(id, name, { state?, city?, aliases?, rank? })` | Match a name to one entry. Tiers: `"name"` (same `nameKey`), `"alias"` (school aliases, or the pairs in `src/data/rank-entry-aliases.ts`), `"loose"` (`schoolMatchKey`: ignores "HS" / "High School", "Senior", "Prep" / "Preparatory", "The", "of"). A tier wins only when it names exactly one entry. State and city must agree where both are given. An entry with no state shared by several bundled schools matches only when `rank` equals it. |
| `schoolMatchKey(name)` | The loose key. It builds on `nameKey`, the normalization the package already uses. |
| `matchSchoolToRankList(school)`, `rankListIdForSchool(school)` | The entry for a `RankedSchool` on its own list (colleges: U.S. News; high schools: Niche public or private). |
| `reconcileSchool(school)`, `rankListCoverage(id)`, `wordmarkRankCoverage(level?)` | `matched`, `rank-conflict` (name matched, the school's own rank differs), `in-gap` (its rank is in an uncompiled range), `name-mismatch` (rank is compiled but no name matched), `not-compiled` (no rank in this list's scope). |

### Match coverage

- **Colleges:** all 108 compiled schools match a bundled college with the
  same rank. 15 of the 29 wordmark colleges match; the other **14 are outside
  the top 100 and not compiled yet**: Cal State Long Beach, George Mason,
  Houston, Kansas, Kentucky, Liberty, Loyola Chicago, Macalester, North
  Texas, Oklahoma, Redlands, Towson, UT Dallas and Western Kentucky.
- **Private high schools:** all 50 compiled entries match a bundled school
  with the same Niche rank. Of the bundled private schools, 750 sit in
  ranges that are not compiled.
- **Public high schools:** 199 of 200 entries match. "Lincoln HS" (605) has no
  state and several bundled Lincolns, so it stays unmatched.
- **Wordmark high schools:** 9 of 30 match (Bronx Science, Payton, Whitney
  Young, LASA, Westwood, Caddo Magnet, Palos Verdes Peninsula, Harvard-Westlake,
  The College Preparatory School). The other **21 are in uncompiled rank
  ranges** (for example New Trier 70, Westminster 69, Harker 218), so they are
  gaps, not mismatches. No wordmark school has a name mismatch.
- **Rank disagreement:** 24 bundled public schools sit one place lower in the
  older Niche list than in the compiled one (602-626 vs 601-625, Mission Vista
  to Riverside). The older list has Lassiter High School at 601. The compiled
  lists do not change the bundled ranks; check the two sources before
  trusting either side of that range.

## Top 10 in each division

### Colleges: U.S. News 2027 Best National Universities

| Rank | School | State | Wordmark |
| ---: | --- | --- | :---: |
| 1 | Massachusetts Institute of Technology | MA | |
| 2 | Princeton University | NJ | |
| 3 | Harvard University | MA | ✓ |
| 4 | Yale University | CT | ✓ |
| 5 | California Institute of Technology | CA | |
| 5 | Stanford University | CA | |
| 7 | University of Pennsylvania | PA | |
| 8 | Duke University | NC | |
| 9 | Johns Hopkins University | MD | |
| 9 | Northwestern University | IL | ✓ |
| 9 | University of Chicago | IL | |

There's a three-way tie at 9, so the list has 11 schools. MIT took No. 1
from Princeton, which had held it for 15 years.

### Public high schools: U.S. News 2026-2027 Best High Schools

| U.S. News | School | City, state | Niche public rank |
| ---: | --- | --- | ---: |
| 1 | Central Magnet School | Murfreesboro, TN | 205 |
| 2 | Signature School | Evansville, IN | 22 |
| 3 | Julia R. Masterman Secondary School | Philadelphia, PA | 96 |
| 4 | Davidson Academy | Reno, NV | 2 |
| 5 | School Without Walls High School | Washington, DC | 87 |
| 6 | Thomas Jefferson High School for Science and Technology | Alexandria, VA | 23 |
| 7 | Gwinnett School of Mathematics, Science and Technology | Lawrenceville, GA | 18 |
| 8 | The School for the Talented and Gifted | Dallas, TX | 11 |
| 9 | Nikola Tesla STEM High School | Redmond, WA | 201 |
| 10 | Science Academy STEM Magnet | North Hollywood, CA | 185 |

None of these has a wordmark yet. For comparison, Niche's public top 10:
NCSSM (NC), Davidson Academy (NV), SC Governor's School for Science and
Mathematics, Massachusetts Academy of Math & Science, Stuyvesant (NY), Pine
View (FL), **Payton** (IL, has a wordmark), Northside Prep (IL), Oklahoma
School of Science and Mathematics, and International Academy (MI).

### Private high schools: Niche 2027 (U.S. News doesn't rank private schools)

| Niche | School | State | Wordmark |
| ---: | --- | --- | :---: |
| 1 | Phillips Academy Andover | MA | |
| 2 | Groton School | MA | |
| 3 | Phillips Exeter Academy | NH | |
| 4 | The Lawrenceville School | NJ | |
| 5 | Choate Rosemary Hall | CT | |
| 6 | The Chapin School | NY | |
| 7 | Harvard-Westlake School | CA | ✓ |
| 8 | Horace Mann School | NY | |
| 9 | The Hotchkiss School | CT | |
| 10 | Stanford Online High School | CA | |

## Stats

- **College top 100:** 108 schools, 49 public and 59 private. California has
  the most (15), then New York (12), Massachusetts (9), Pennsylvania (7),
  New Jersey (6) and Texas (6).
- **Public high school top 100 (Niche):** New York has 14, Florida 13,
  Illinois 12, Texas 9, New Jersey 9 and California 8. Of the 40 known U.S.
  News top-100 public schools, 13 are Arizona charters (11 of them BASIS).
- **Private high school top 100 (Niche):** New York has 19, California 17,
  Massachusetts 11, New Jersey 9, Texas 9 and Connecticut 7.
- **The two high school rankings disagree a lot.** U.S. News's No. 1, Central
  Magnet, is 205th on Niche. Niche's No. 1, NCSSM, has no bundled U.S. News
  rank. Only Davidson Academy is top 5 on both. That's the reason the package
  keeps both ranks.

## Wordmark coverage of the top 100

| Division | Top 100 by | Schools | With a wordmark | Share |
| --- | --- | ---: | ---: | ---: |
| Colleges | U.S. News | 108 | 15 | **13.9%** |
| Public high schools | Niche | 100 | 8 | **8.0%** |
| Private high schools | Niche | 100 | 5 | **5.0%** |

High schools use Niche's top 100, because the U.S. News public top 100 is
only 40% sourced and U.S. News has no private list. `wordmarkCoverage()`
recomputes these numbers, and a test pins them to the data.

- **Colleges with one (U.S. News rank):** Harvard 3, Yale 4, Northwestern 9,
  Dartmouth 12, UC Berkeley 20, Emory 23, Georgetown 23, Michigan 25, USC 27,
  Texas 34, Wake Forest 34, Georgia 52, Michigan State 69, Baylor 90, Iowa 100.
  Outside the top 100: CSU Long Beach, George Mason, Houston, Kansas,
  Kentucky, Liberty, Loyola Chicago, Macalester, North Texas, Oklahoma,
  Redlands, Towson, UT Dallas, Western Kentucky.
- **Public high schools (Niche public rank):** Payton 7, Bronx Science 12,
  Whitney Young 14, LASA 42, New Trier 70, Glenbrook South 71, Glenbrook
  North 74, Westwood (TX) 92. Lynbrook (293) and Plano West (753) fall outside
  the top 100.
- **Private high schools (Niche private rank):** Harvard-Westlake 7, College
  Prep 20, Marlborough 49, Westminster (GA) 69, St. Mark's (TX) 99. Greenhill
  (108), Strake Jesuit (131), Harker (218), Loyola (LA) (265), Woodward (431),
  Blake (506) and Montgomery Bell (542) fall outside the top 100.

### Wordmark to-do, highest-ranked first

The quickest wins for coverage are the top schools that don't have one yet:

1. **Colleges:** MIT, Princeton, Caltech, Stanford, Penn, Duke, Johns
   Hopkins, UChicago, Columbia, Cornell, Carnegie Mellon, Brown, Rice,
   Vanderbilt, WashU, UCLA, Notre Dame.
2. **Public high schools:** NCSSM, Stuyvesant, Thomas Jefferson (TJHSST),
   Northside Prep, IMSA, plus the U.S. News top 10 (Central Magnet, Signature,
   Masterman, School Without Walls).
3. **Private high schools:** Andover, Groton, Exeter, Lawrenceville, Choate,
   Horace Mann, Hotchkiss, plus debate-circuit privates with no logo yet
   (Brearley, Georgetown Day, Bellarmine).

To add one, put the png in `wordmarks/colleges/` or `wordmarks/high-schools/`,
export it from `src/wordmarks/icons.ts` (and the re-export in
`@debate-ai/icons/schools`), add it to the logo map in `@debate-ai/rankings`,
and add a row to `src/data/wordmarks.ts`. The tests fail until all four steps
are done.

## Wordmarks, trademarks and the privacy policy

School names, wordmarks, logos, seals and mascots are trademarks, usually
registered, of the schools that own them. Collegiate marks are often licensed
through agents such as CLC/Learfield. Showing a mark **only to identify the
school a debater, team or ranking refers to** is generally treated as
*nominative fair use* in the U.S.: use only as much of the mark as you need,
don't alter it, and don't suggest sponsorship or endorsement. Selling
merchandise with the mark, putting it in your own branding or ads, or
implying a partnership is not covered and needs a license. This is a summary,
not legal advice.

The site's Terms and Privacy Policy already has **section 19, "School Names,
Logos, and Trademarks"**
(`packages/debate-webview/src/routes/legal/privacy/school-trademarks.tsx`).
It says the marks belong to their owners, are used only for identification,
and imply no affiliation or endorsement. Anything that ships this package's
data should also cover rankings and takedowns. Suggested text to append to
section 19 (or to put in your own app's policy):

> **Rankings data.** School rankings shown on {appName} are compiled from
> third-party publications, including U.S. News & World Report's Best Colleges
> and Best High Schools rankings and Niche's Best High Schools rankings, and
> are attributed to their source wherever shown. "U.S. News & World Report"
> and "Niche" are trademarks of their respective owners, who have not
> reviewed, sponsored, or endorsed {appName}. Rankings are provided for
> informational purposes only, may be incomplete or out of date, and are not
> a statement by {appName} about the quality of any school.
>
> **Requests from schools.** If you represent a school and want its name,
> logo, or wordmark corrected or removed, contact us at {contactEmail} and we
> will respond promptly.

Short version for the plain-language summary:

> School names, logos and wordmarks belong to their owners and are shown only
> to identify schools. Rankings come from U.S. News and Niche and are credited
> to them. Neither the schools nor the ranking publishers endorse {appName}.

In the UI: show the rank's source next to the number ("U.S. News #3, 2027"),
show logos at their original proportions and colors, and never put a school's
wordmark in a button, page header or ad as if it were your own brand.

## Use cases

- **College sports.** Fuzzy-match messy team names from schedules or box
  scores ("Cal", "UT Austin", "Wake") to one canonical school with its logo,
  then show the academic rank next to the athletic record, e.g. "academic
  top 25 vs. top 25" matchups. `level: "college"` keeps a "Michigan" search
  from returning high schools.
- **High school debate.** Tabroom and caselist entries use short names
  ("Bronx Science", "LASA", "Strake", "GBN"). The search resolves them to a
  ranked school with a wordmark for pairings, team pills and school pages.
  You can also sort a tournament's field by academic rank, or put a team's
  record next to its school's U.S. News or Niche standing.
- **Chess and robotics clubs.** Club rosters and league standings (scholastic
  chess, FIRST / VEX robotics) list schools by informal names. Use
  `level: "high-school"` plus `state` to disambiguate the many "Westwood"s and
  "Lincoln"s, show a logo on the standings table, and filter leagues to public
  or private schools with `type`.
- **Rankings comparison.** Every high school carries both a U.S. News and a
  Niche rank, and colleges carry U.S. News, so you can build "rank vs. rank"
  views (Central Magnet #1 vs. #205) or compare a school's competition
  results (debate, sports, chess) with its academic rank. Pair it with
  `@debate-ai/rankings` program strength for a "punches above its weight"
  list.
- **Search boxes and URLs.** `searchSchoolsFromParams(location.search)`
  makes a school picker deep-linkable (`/schools?q=yale&level=college`).

## Updating the data

- **Colleges:** edit `src/data/colleges-usnews.ts` when U.S. News publishes
  a new edition (each September). Keep the source URLs current.
- **U.S. News high schools:** add ranks to `src/data/high-schools-usnews.ts`
  as you source them. Set the fifth column when the Niche list spells the
  school differently.
- **Compiled lists:** edit the JSON in `data/` and keep `metadata` honest:
  move ranks from `knownGaps` to `rankRangesPresent` only when you add their
  entries (the tests fail if the two disagree with the entries). Add a pair to
  `src/data/rank-entry-aliases.ts` only after checking both spellings.
- **Niche high schools:** these come from
  `@debate-ai/rankings/src/schools/academic-category-data`, so update them
  there.

Run `bun run test --project school-rank` from the repo root, or
`bun run typecheck` from this folder.
