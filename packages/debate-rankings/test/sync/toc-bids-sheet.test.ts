import { describe, expect, it, vi } from "vitest";
import {
  debatersKey,
  fetchTocBidsSheet,
  matchTocBids,
  parseDelimited,
  parseTocBidsSheet,
  rankedTeamKey,
  schoolSimilarity,
  splitTeamName,
  toSheetCsvUrl,
  TOC_BIDS_SHEET_URL,
} from "../../src/sync/sync-toc-bids-sheet";
import { tocBidsSnapshot } from "../../src/sync/toc-bids-snapshot";

const CSV = [
  "Bids,Team,Debaters,State,Bid 1,Bid 2,Bid 3,,,",
  "3,Baltimore City HW,Hoard & Walter,MD,NSDSO,Georgetown Day,NYCIDST,,,",
  "2,College Prep NT,Nahm & Tarnas,CA,Greenhill,St Mark's,,,,",
  '1,"\nBarack Obama Male Leadership Academy JV\nJeffries & Valle",TX,Greenhill,,,,,,',
  ",,,,,,,,,",
].join("\r\n");

describe("toSheetCsvUrl", () => {
  it("turns a pubhtml link into its CSV export", () => {
    expect(toSheetCsvUrl(TOC_BIDS_SHEET_URL)).toBe(
      TOC_BIDS_SHEET_URL.replace(/pubhtml$/, "pub?output=csv"),
    );
  });

  it("keeps the tab's gid", () => {
    expect(toSheetCsvUrl("https://docs.google.com/spreadsheets/d/e/X/pubhtml?gid=7&single=true")).toBe(
      "https://docs.google.com/spreadsheets/d/e/X/pub?output=csv&gid=7",
    );
  });

  it("leaves a CSV link alone", () => {
    const url = "https://docs.google.com/spreadsheets/d/e/X/pub?output=csv";
    expect(toSheetCsvUrl(url)).toBe(url);
  });
});

describe("parseDelimited", () => {
  it("keeps quoted delimiters, newlines and escaped quotes in one cell", () => {
    expect(parseDelimited('a,"b,c\nd","e ""f"""\n1,2,3', ",")).toEqual([
      ["a", "b,c\nd", 'e "f"'],
      ["1", "2", "3"],
    ]);
  });
});

describe("splitTeamName", () => {
  it("splits the team code off the end", () => {
    expect(splitTeamName("Little Rock Central BaWa")).toEqual({ school: "Little Rock Central", code: "BaWa" });
    expect(splitTeamName("Brophy")).toEqual({ school: "Brophy", code: "" });
  });
});

describe("parseTocBidsSheet", () => {
  it("reads one record per team from Google's CSV", () => {
    const teams = parseTocBidsSheet(CSV);
    expect(teams).toHaveLength(3);
    expect(teams[0]).toEqual({
      bids: 3,
      team: "Baltimore City HW",
      school: "Baltimore City",
      code: "HW",
      debaters: "Hoard & Walter",
      state: "MD",
      tournaments: ["NSDSO", "Georgetown Day", "NYCIDST"],
    });
  });

  it("splits a cell holding both Team and Debaters into the two columns", () => {
    const barack = parseTocBidsSheet(CSV)[2];
    expect(barack).toMatchObject({
      team: "Barack Obama Male Leadership Academy JV",
      debaters: "Jeffries & Valle",
      state: "TX",
      tournaments: ["Greenhill"],
    });
  });

  it("counts the listed tournaments over a stale Bids number", () => {
    const [team] = parseTocBidsSheet("Bids,Team,Debaters,State,Bid 1\n5,Pace RW,Royal & Washington,GA,Marist");
    expect(team.bids).toBe(1);
  });

  it("falls back to the Bids number when no tournaments are listed", () => {
    const [team] = parseTocBidsSheet("Bids,Team,Debaters,State\n2,Pace RW,Royal & Washington,GA");
    expect(team).toMatchObject({ bids: 2, tournaments: [] });
  });

  it("skips a title row above the header", () => {
    expect(parseTocBidsSheet(`2026-27 Policy Bids,,,\n${CSV}`)).toHaveLength(3);
  });

  it("returns nothing without a Bids/Team header", () => {
    expect(parseTocBidsSheet("a,b\n1,2")).toEqual([]);
  });

  it("parses the bundled snapshot, messy row included", () => {
    const teams = tocBidsSnapshot();
    expect(teams.length).toBeGreaterThan(60);
    expect(teams.every((t) => /^[A-Z]{2}$/.test(t.state))).toBe(true);
    expect(teams.every((t) => t.debaters.includes("&"))).toBe(true);
    expect(teams.every((t) => t.bids === t.tournaments.length)).toBe(true);
  });
});

describe("schoolSimilarity", () => {
  it("matches differently spelled names that share their words", () => {
    expect(schoolSimilarity("Barack Obama MLA (HS)", "Barack Obama Male Leadership Academy")).toBeGreaterThan(0);
    expect(schoolSimilarity("Brophy", "Brophy HS")).toBe(1);
    expect(schoolSimilarity("Damien-St Lucy's", "Damien St Lucys")).toBe(1);
  });

  it("does not match schools with a different first word", () => {
    expect(schoolSimilarity("Westwood", "West HS SLC")).toBe(0);
  });

  it("scores sibling schools below 1", () => {
    expect(schoolSimilarity("Blue Valley North", "Blue Valley West")).toBeLessThan(1);
  });
});

describe("debatersKey", () => {
  it("ignores order, case and punctuation", () => {
    expect(debatersKey("Nandigam & Du")).toBe(debatersKey("du & NANDIGAM"));
    expect(debatersKey("Gomez-Peralta & Membiela")).toBe("gomezperalta|membiela");
  });
});

describe("matchTocBids", () => {
  const teams = parseTocBidsSheet(
    [
      "Bids,Team,Debaters,State,Bid 1,Bid 2",
      "2,Greenhill BS,Bose & Sunkara,TX,Grapevine,Greenhill",
      "1,Greenhill HS,He & Sunkara,TX,St Mark's",
      "1,Cuttlefish Independent CG,Chen & Goswami,WA,Jack Howe",
      "1,Interlake CG,Chen & Goswami,WA,Mid America Cup",
      "1,Barack Obama Male Leadership Academy JV,Jeffries & Valle,TX,Greenhill",
      "1,Montgomery Bell BF,Brandes & Fulwider,TN,St Mark's",
      "1,Blue Valley West BJ,Bapat & Jampana,KS,Washburn Rural",
    ].join("\n"),
  );

  it("matches by debaters and school", () => {
    const greenhill = { school: "Greenhill", name: "Sunkara & Bose" };
    const other = { school: "Greenhill", name: "Haq & Khan" };
    const bids = matchTocBids([greenhill, other], teams);
    expect(bids.get(rankedTeamKey(greenhill))?.tournaments).toEqual(["Grapevine", "Greenhill"]);
    expect(bids.has(rankedTeamKey(other))).toBe(false);
  });

  it("matches a school spelled differently in the rankings", () => {
    const entry = { school: "Barack Obama MLA (HS)", name: "Jeffries & Valle" };
    expect(matchTocBids([entry], teams).get(rankedTeamKey(entry))?.bids).toBe(1);
  });

  it("combines a team's rows under two schools onto its one ranked entry", () => {
    const entry = { school: "Interlake", name: "Chen & Goswami" };
    const bid = matchTocBids([entry], teams).get(rankedTeamKey(entry));
    expect(bid?.bids).toBe(2);
    expect(bid?.tournaments).toEqual(expect.arrayContaining(["Jack Howe", "Mid America Cup"]));
  });

  it("falls back to school + team code when the names differ", () => {
    const entry = { school: "Montgomery Bell", name: "Brandes & Fulwyder" };
    const decoy = { school: "Montgomery Bell", name: "Brandes & Vari" };
    const bids = matchTocBids([entry, decoy], teams);
    expect(bids.get(rankedTeamKey(entry))?.tournaments).toEqual(["St Mark's"]);
    expect(bids.has(rankedTeamKey(decoy))).toBe(false);
  });

  it("does not give a sibling school's bids by team code", () => {
    const entry = { school: "Blue Valley North", name: "Brown & Jones" };
    expect(matchTocBids([entry], teams).size).toBe(0);
  });
});

describe("fetchTocBidsSheet", () => {
  const respond = (body: string, status = 200) =>
    vi.fn().mockResolvedValue(new Response(body, { status }));

  it("downloads the CSV export of the published link", async () => {
    const fetchMock = respond(CSV);
    const teams = await fetchTocBidsSheet(TOC_BIDS_SHEET_URL, fetchMock);
    expect(fetchMock.mock.calls[0][0]).toBe(toSheetCsvUrl(TOC_BIDS_SHEET_URL));
    expect(teams).toHaveLength(3);
  });

  it("throws on an HTTP error", async () => {
    await expect(fetchTocBidsSheet(TOC_BIDS_SHEET_URL, respond("", 404))).rejects.toThrow("HTTP 404");
  });

  it("throws when Google answers with an HTML page", async () => {
    await expect(fetchTocBidsSheet(TOC_BIDS_SHEET_URL, respond("<!DOCTYPE html><html>"))).rejects.toThrow(
      "did not return CSV",
    );
  });
});
