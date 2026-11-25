import { describe, expect, it } from "vitest";

import { handleRankingsRedirect } from "../rankings";

function locationFor(url: string): string | null | undefined {
  const response = handleRankingsRedirect(new Request(url));
  if (response) expect(response.status).toBe(308);
  return response?.headers.get("location") ?? null;
}

describe("handleRankingsRedirect", () => {
  it("moves the format from the query into the /rank path", () => {
    expect(locationFor("https://d.ebate.app/coaching/rankings?format=VCX&season=all-time")).toBe(
      "https://d.ebate.app/rank/VCX?season=all-time",
    );
  });

  it("sends the older rankings copies to /rank too", () => {
    expect(locationFor("https://d.ebate.app/practice/rankings?format=NDT&by=schools")).toBe(
      "https://d.ebate.app/rank/NDT?by=schools",
    );
    expect(locationFor("https://d.ebate.app/videos/rankings")).toBe("https://d.ebate.app/rank");
    expect(locationFor("https://d.ebate.app/coaching/rankings/")).toBe("https://d.ebate.app/rank");
  });

  it("folds /rank?format= and a lower-case segment into the canonical form", () => {
    expect(locationFor("https://d.ebate.app/rank?format=vld")).toBe("https://d.ebate.app/rank/VLD");
    expect(locationFor("https://d.ebate.app/rank/vcx?season=all-time")).toBe(
      "https://d.ebate.app/rank/VCX?season=all-time",
    );
    expect(locationFor("https://d.ebate.app/rank/PARLI?format=VCX")).toBe("https://d.ebate.app/rank/PARLI");
  });

  it("leaves canonical and unrelated addresses alone", () => {
    expect(locationFor("https://d.ebate.app/rank")).toBeNull();
    expect(locationFor("https://d.ebate.app/rank/VCX?season=all-time")).toBeNull();
    expect(locationFor("https://d.ebate.app/rankings?format=VCX")).toBeNull();
    expect(locationFor("https://d.ebate.app/coaching/leaderboard")).toBeNull();
  });
});
