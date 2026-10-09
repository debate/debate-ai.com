import { describe, expect, it } from "vitest";
import type { RankingDataset, RankingEntry } from "@debate/rankings-adapter";
import type { VideoType } from "../src/types/videos";
import {
  buildFollowNews,
  estimateRatingChanges,
  followedSide,
  monthlyRecap,
  runOutcome,
  tournamentRuns,
  type FollowNewsInput,
} from "../src/lib/follows/follow-feed";
import { followHref, isProfileSlug, parseFollowBody } from "../src/lib/follows/profile-follows";

/** A PF round tuple: id, title, date, …, style 2, tournament, round, aff, neg, affWin, …, season. */
function round(
  id: string,
  date: string,
  tournament: string,
  level: string,
  aff: string,
  neg: string,
  affWin: boolean | null,
): VideoType {
  return [id, `${aff} vs ${neg}`, date, "ch", 0, "", 2, tournament, level, aff, neg, affWin, null, null, null, false, null, 2027];
}

function entry(school: string, name: string, rating: number): RankingEntry {
  return {
    rank: 1,
    school,
    name,
    adjustedRating: rating,
    deviation: 1,
    matches: 10,
    rating,
    hash: `${school}-${name}`,
    affWinRate: 50,
    negWinRate: 50,
    affElimWinRate: null,
    negElimWinRate: null,
  };
}

const datasets: RankingDataset[] = [
  {
    id: "hspf",
    label: "HS Public Forum",
    tournaments: [],
    majors: [],
    field: null,
    entries: [entry("Harker", "Lee & Lin", 90), entry("Strake Jesuit", "Fox & Smith", 90)],
  },
];

const follow = { kind: "team" as const, slug: "harker-lee-lin", name: "Harker Lee & Lin", followedAt: 0 };
const competitors = ["Harker LL"];

const rounds = [
  round("a1", "2026-09-05T12:00:00Z", "Grapevine", "Round 1", "Harker LL", "Strake Jesuit FS", true),
  round("a2", "2026-09-06T12:00:00Z", "Grapevine", "Round 2", "Strake Jesuit FS", "Harker LL", true),
  round("a3", "2026-09-07T12:00:00Z", "Grapevine", "Semifinals", "Harker LL", "Strake Jesuit FS", true),
  round("a4", "2026-09-07T18:00:00Z", "Grapevine", "Finals", "Strake Jesuit FS", "Harker LL", true),
  round("b1", "2026-08-20T12:00:00Z", "Yale", "Round 3", "Harker LL", "Strake Jesuit FS", false),
];

const input = (extra: Partial<FollowNewsInput> = {}): FollowNewsInput => ({
  follow,
  competitors,
  rounds,
  docs: [],
  datasets,
  now: Date.parse("2026-10-07T00:00:00Z"),
  ...extra,
});

describe("follow request parsing", () => {
  it("accepts a follow and an unfollow without a name", () => {
    expect(parseFollowBody({ kind: "school", slug: "harker", name: " Harker ", follow: true })).toEqual({
      ok: true,
      kind: "school",
      slug: "harker",
      name: "Harker",
      follow: true,
    });
    expect(parseFollowBody({ kind: "team", slug: "harker-lee-lin", follow: false })).toMatchObject({ ok: true });
  });

  it("rejects bad kinds, slugs, and a nameless follow", () => {
    expect(parseFollowBody({ kind: "coach", slug: "x", follow: true }).ok).toBe(false);
    expect(parseFollowBody({ kind: "team", slug: "Not A Slug", name: "x", follow: true }).ok).toBe(false);
    expect(parseFollowBody({ kind: "team", slug: "ok", follow: true }).ok).toBe(false);
    expect(parseFollowBody(null).ok).toBe(false);
    expect(isProfileSlug("st-mark-s-school")).toBe(true);
    expect(isProfileSlug("-bad")).toBe(false);
  });

  it("links a follow to its profile page", () => {
    expect(followHref({ kind: "team", slug: "harker-lee-lin" })).toBe("/@harker-lee-lin");
    expect(followHref({ kind: "team", slug: "harker-ll" })).toBe("/@harker-ll");
    expect(followHref({ kind: "school", slug: "harker" })).toBe("/schools/harker");
  });
});

describe("follow feed", () => {
  it("finds the side the followed team debated on", () => {
    expect(followedSide(rounds[0], ["harker ll"])).toBe("aff");
    expect(followedSide(rounds[1], ["harker ll"])).toBe("neg");
    expect(followedSide(round("x", "", "T", "R1", "Harker AB", "Harker LL", true), ["harker"])).toBeNull();
  });

  it("groups rounds into tournament runs with record and elim depth", () => {
    const runs = tournamentRuns(rounds, ["harker ll"]);
    expect(runs.map((r) => r.tournament)).toEqual(["Grapevine", "Yale"]);
    expect(runs[0]).toMatchObject({ wins: 2, losses: 2, deepestElim: "FINALS", champion: false, finalist: true });
    expect(runOutcome(runs[0])).toBe("finished runner-up");
    expect(runOutcome(runs[1])).toBe("");
  });

  it("estimates a rating change from results against ranked opponents", () => {
    const changes = estimateRatingChanges(rounds.slice(0, 4), ["harker ll"], datasets);
    // Even teams: two wins and two losses cancel out.
    expect(changes.get("Harker LL")?.rounds).toBe(4);
    expect(changes.get("Harker LL")?.delta).toBeCloseTo(0, 6);
    const onlyWins = estimateRatingChanges([rounds[0], rounds[2]], ["harker ll"], datasets);
    expect(onlyWins.get("Harker LL")?.delta).toBeGreaterThan(0);
    expect(estimateRatingChanges(rounds, ["harker ll"], []).size).toBe(0);
  });

  it("writes a monthly recap with the big results and rating change", () => {
    const recap = monthlyRecap(input(), Date.UTC(2026, 8, 1));
    expect(recap?.title).toBe("September 2026 recap: Harker Lee & Lin");
    expect(recap?.body).toContain("4 recorded rounds, 2–2 overall across 1 tournament.");
    expect(recap?.body).toContain("Big result: finished runner-up at Grapevine.");
    expect(recap?.body).toContain("Estimated rating change: ±0.0 over 4 rated rounds.");
    expect(recap?.timestamp).toBe(Date.UTC(2026, 9, 1));
    expect(monthlyRecap(input(), Date.UTC(2026, 6, 1))).toBeNull();
  });

  it("builds rounds, research, results and recaps with stable ids", () => {
    const items = buildFollowNews(
      input({
        docs: [
          { id: 7, caselistLabel: "HSPF 26-27", school: "Harker", team: "LL", side: "Aff", fileName: "Aff v2.docx", cardCount: 40, ingestedAt: 1_790_000_000 },
        ],
      }),
    );
    const ids = items.map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "follow-round-a4",
        "follow-round-a3",
        "follow-round-a2",
        "follow-research-7",
        "follow-result-team-harker-lee-lin-grapevine-2026",
        "follow-result-team-harker-lee-lin-yale-2026",
        "follow-recap-team-harker-lee-lin-2026-09",
        "follow-recap-team-harker-lee-lin-2026-08",
      ]),
    );
    expect(ids).not.toContain("follow-round-b1");
    expect(items.every((i) => i.category === "following")).toBe(true);
    const result = items.find((i) => i.id === "follow-result-team-harker-lee-lin-grapevine-2026");
    expect(result?.title).toBe("Harker Lee & Lin at Grapevine: 2–2, finished runner-up");
    const latest = items.find((i) => i.id === "follow-round-a4");
    expect(latest?.body).toContain("Harker LL lost on the neg.");
    expect(latest?.href).toMatch(/^\/videos\//);
  });

  it("drops tournament results older than the window", () => {
    const items = buildFollowNews(input({ now: Date.parse("2027-06-01T00:00:00Z") }));
    expect(items.some((i) => i.id.startsWith("follow-result-"))).toBe(false);
  });
});
