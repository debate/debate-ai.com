/**
 * @fileoverview The 2026–27 circuit majors the Debate Majors calendar lays out week
 * by week: the dated tournaments a judge picks availability from, the
 * season-ending championships that group together as week Z, and the few
 * undated events that land in the "estimated planning windows" strip below.
 *
 * This is the single source behind the `DebateMajorsCalendar` React component
 * (it replaced the standalone `debate-majors-a-to-z.html` page). The dated
 * rows are kept in sync with `SEASON_MAJORS` in
 * `debate-practice-drills/src/judge-pool/season-calendar.ts`; a test fails if the two
 * drift.
 */

/** One row of the Debate Majors season calendar. */
export interface DebateMajor {
  id: number;
  name: string;
  /** Circuit codes, e.g. `["LD", "PF", "CX"]`; `["NDT"]` for college policy. */
  formats: string[];
  /** First day, ISO "YYYY-MM-DD"; empty when the dates are undated. */
  start: string;
  /** Last day, ISO "YYYY-MM-DD" (empty when undated). */
  end: string;
  /** `published` = organizer-confirmed; `provisional` = secondary source; `estimated` = undated window. */
  status: "published" | "provisional" | "estimated";
  /** Free-form caveat (may include "CONFLICT:" warnings). */
  note: string;
  /** The published date source to open. */
  source: string;
}

/**
 * Season-ending championships group into week Z, regardless of their date
 * range, so a single championship bracket covers March–June rather than one
 * calendar week. Undated championships keep their estimated windows there;
 * undated non-championships drop to the planning-windows strip instead.
 */
export const CHAMPIONSHIP_IDS: ReadonlySet<number> = new Set([0, 1, 13, 18, 20, 21, 22]);

export const DEBATE_MAJORS: readonly DebateMajor[] = [
  { id: 0, name: "TOC", formats: ["LD", "PF", "CX"], start: "2027-04-17", end: "2027-04-19", status: "published", note: "Overall championship window.", source: "https://ci.uky.edu/debate/toc/dates/tournament-dates" },
  { id: 1, name: "NSDA Nationals", formats: ["LD", "PF", "CX"], start: "2027-06-13", end: "2027-06-18", status: "published", note: "Phoenix, AZ. Competition June 14–18; overall window begins June 13.", source: "https://www.speechanddebate.org/national-tournament-2026/" },
  { id: 2, name: "Greenhill Fall Classic", formats: ["LD", "CX"], start: "2026-09-16", end: "2026-09-21", status: "published", note: "Overall event window; main tournament/round robin and CX schedule need verification.", source: "https://ci.uky.edu/debate/toc/bids/bid-tournaments" },
  { id: 3, name: "Mid-America Cup", formats: ["LD"], start: "2026-09-26", end: "2026-09-29", status: "published", note: "Current-season source range; verify circuit-specific schedule.", source: "https://ci.uky.edu/debate/toc/bids/bid-tournaments" },
  { id: 4, name: "Yale Invitational", formats: ["PF"], start: "2026-10-02", end: "2026-10-05", status: "published", note: "PF range; Congress ends October 4.", source: "https://ci.uky.edu/debate/toc/bids/bid-tournaments" },
  { id: 5, name: "Heart of Texas", formats: ["LD", "CX"], start: "2026-10-16", end: "2026-10-18", status: "published", note: "LD published; CX needs verification.", source: "https://ci.uky.edu/debate/toc/bids/bid-tournaments" },
  { id: 6, name: "Big Bronx", formats: ["PF"], start: "2026-10-16", end: "2026-10-18", status: "published", note: "Current-season source range; verify circuit-specific schedule.", source: "https://ci.uky.edu/debate/toc/bids/bid-tournaments" },
  { id: 7, name: "Michigan HS Tournament", formats: ["CX"], start: "2026-10-28", end: "2026-11-01", status: "published", note: "Listing may exceed actual competition dates.", source: "https://www.tabroom.com/index/tourn/events.mhtml?tourn_id=40511" },
  { id: 8, name: "Florida Blue Key", formats: ["PF"], start: "2026-10-29", end: "2026-11-01", status: "published", note: "Current-season source range; verify circuit-specific schedule.", source: "https://ci.uky.edu/debate/toc/bids/bid-tournaments" },
  { id: 9, name: "MinneApple", formats: ["LD"], start: "2026-11-07", end: "2026-11-09", status: "published", note: "Current-season source range; verify circuit-specific schedule.", source: "https://ci.uky.edu/debate/toc/bids/bid-tournaments" },
  { id: 10, name: "Glenbrooks", formats: ["LD", "PF", "CX"], start: "2026-11-21", end: "2026-11-23", status: "published", note: "LD/PF published; CX needs verification.", source: "https://ci.uky.edu/debate/toc/bids/bid-tournaments" },
  { id: 11, name: "Barkley Forum", formats: ["LD", "PF", "CX"], start: "2027-01-22", end: "2027-01-24", status: "published", note: "LD/PF published; CX needs verification.", source: "https://ci.uky.edu/debate/toc/bids/bid-tournaments" },
  { id: 12, name: "Cal Invitational", formats: ["PF"], start: "2027-02-13", end: "2027-02-15", status: "published", note: "Current-season source range; verify circuit-specific schedule.", source: "https://ci.uky.edu/debate/toc/bids/bid-tournaments" },
  { id: 13, name: "NDCA Nationals", formats: ["CX"], start: "2027-03-19", end: "2027-03-21", status: "published", note: "Valley HS, West Des Moines, IA; organizer-confirmed.", source: "https://www.debatecoaches.org/tournament" },
  { id: 14, name: "Harvard Invitational", formats: ["LD", "PF"], start: "2027-02-13", end: "2027-02-15", status: "published", note: "CONFLICT: main Feb 13–15; metadata Feb 11–15; TOC LD Feb 13–17.", source: "https://www.tabroom.com/index/tourn/main.mhtml?tourn_id=40853" },
  { id: 15, name: "Harvard College Tournament", formats: ["NDT"], start: "2026-10-31", end: "2026-11-02", status: "provisional", note: "CONFLICT: MSU range used; anomalous Tabroom November 23 end excluded.", source: "https://debate.msu.edu/events/harvard-college-tournament-2/" },
  { id: 16, name: "John Edie Holiday Debates", formats: ["CX"], start: "2026-12-18", end: "2026-12-21", status: "provisional", note: "Secondary calendar; TOC still lists December 2025.", source: "https://wsdcacademy.com/world-schools-debate-tournaments" },
  { id: 17, name: "Harvard-Westlake", formats: ["LD"], start: "2027-01-15", end: "2027-01-19", status: "provisional", note: "Secondary calendar; TOC still lists January 2026. Verify round robin.", source: "https://wsdcacademy.com/world-schools-debate-tournaments" },
  { id: 18, name: "NCFL Grand Nationals", formats: ["PF"], start: "2027-05-29", end: "2027-05-30", status: "provisional", note: "Minneapolis, MN. League calendar, not organizer confirmation.", source: "https://www.msdlonline.org/tournament-schedule-26-27" },
  { id: 19, name: "MBA Southern Bell", formats: ["CX"], start: "", end: "", status: "estimated", note: "Early January 2027; exact dates unresolved.", source: "https://www.tabroom.com/index/tourn/index.mhtml?tourn_id=39621" },
  { id: 20, name: "National Debate Tournament", formats: ["NDT"], start: "", end: "", status: "estimated", note: "Late March–early April 2027; exact dates unresolved.", source: "https://nationaldebatetournament.org/" },
  { id: 21, name: "CEDA Nationals", formats: ["NDT"], start: "", end: "", status: "estimated", note: "Spring 2027; exact dates unresolved.", source: "https://cedadebate.org/ceda-nationals/" },
  { id: 22, name: "ADA Nationals", formats: ["NDT"], start: "", end: "", status: "estimated", note: "Early March estimated; separate from November Wake Forest listing.", source: "https://americandebateassociation.org/ada-nationals/" },
  { id: 23, name: "Owen L. Coon Memorial", formats: ["NDT"], start: "2026-09-12", end: "2026-09-14", status: "published", note: "Current-season source range; verify circuit-specific schedule.", source: "https://www.tabroom.com/index/circuit/index.mhtml?circuit_id=43" },
  { id: 24, name: "Run for the Roses", formats: ["NDT"], start: "2026-09-23", end: "2026-09-24", status: "published", note: "Current-season source range; verify circuit-specific schedule.", source: "https://www.tabroom.com/index/circuit/index.mhtml?circuit_id=43" },
  { id: 25, name: "J. W. Patterson Debates", formats: ["NDT"], start: "2026-09-26", end: "2026-09-28", status: "published", note: "Current-season source range; verify circuit-specific schedule.", source: "https://www.tabroom.com/index/circuit/index.mhtml?circuit_id=43" },
  { id: 26, name: "Houston College Tournament", formats: ["NDT"], start: "2026-10-10", end: "2026-10-12", status: "published", note: "Current-season source range; verify circuit-specific schedule.", source: "https://www.tabroom.com/index/circuit/index.mhtml?circuit_id=43" },
  { id: 27, name: "Minnesota College Invitational", formats: ["NDT"], start: "2026-10-16", end: "2026-10-18", status: "published", note: "Current-season source range; verify circuit-specific schedule.", source: "https://www.tabroom.com/index/circuit/index.mhtml?circuit_id=43" },
  { id: 28, name: "Franklin R. Shirley Classic", formats: ["NDT"], start: "2026-11-14", end: "2026-11-16", status: "published", note: "FR Shirley and ADA Champs listing; not assumed identical to spring ADA Nationals.", source: "https://www.tabroom.com/index/circuit/index.mhtml?circuit_id=43" },
];

/** Week letters the calendar lays out before the championship week: A is Sep 1–6, 2026. */
export const FIRST_WEEK_LETTER = "A";
