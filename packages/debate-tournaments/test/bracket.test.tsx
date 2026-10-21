import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ballotScore, buildBracket, isElimRound, roundDisplayLabel } from "../src/ui/bracket";
import type { RoundSchematic } from "../src/ui/client";
import { entrySide } from "../src/ui/enrichment";
import { BracketCard } from "../src/ui/pages/ElimBracket";

import { createTournamentsClient } from "../src/ui/client";
import { tournamentHrefs } from "../src/routes";
import { TournamentsContext, defaultLink } from "../src/ui/shared";
import elims from "./fixtures/ucla-2026-opld-elims.json";

// Live Tabroom's `/results` pages for the UCLA Invitational 2026 (tourn 40372)
// Open LD Octafinals through Finals, as the proxy served them.
const rounds = elims as unknown as RoundSchematic[];

describe("roundDisplayLabel", () => {
  it("uses the site's elim names for Tabroom's labels", () => {
    expect(roundDisplayLabel("Octafinals", 7)).toBe("Octas");
    expect(roundDisplayLabel("Quarterfinals", 8)).toBe("Quarters");
    expect(roundDisplayLabel("Semifinals", 9)).toBe("Semis");
    expect(roundDisplayLabel("Finals", 10)).toBe("Final");
    expect(roundDisplayLabel("Double Octafinals", 6)).toBe("Doubles");
    expect(roundDisplayLabel("Triple Octos", 5)).toBe("Triples");
  });

  it("names unlabeled rounds R<n>, or by size when they are elims", () => {
    expect(roundDisplayLabel("", 3)).toBe("R3");
    expect(roundDisplayLabel(null, 9, 2)).toBe("Semis");
    expect(roundDisplayLabel("Bid Round", 7)).toBe("Bid Round");
  });

  it("knows which round types are elims", () => {
    expect(isElimRound("elim")).toBe(true);
    expect(isElimRound("final")).toBe(true);
    expect(isElimRound("highlow")).toBe(false);
  });
});

describe("entrySide", () => {
  it("reads Tabroom's numeric and labelled sides", () => {
    expect(entrySide(1)).toBe("aff");
    expect(entrySide("Neg")).toBe("neg");
    expect(entrySide("Pro")).toBe("aff");
    expect(entrySide("Con")).toBe("neg");
    expect(entrySide(undefined)).toBeNull();
  });
});

describe("buildBracket", () => {
  const columns = buildBracket([...rounds].reverse());

  it("makes one column per elim round, first round first", () => {
    expect(columns.map((column) => column.label)).toEqual(["Octas", "Quarters", "Semis", "Final"]);
    expect(columns.map((column) => column.slots.length)).toEqual([8, 4, 2, 1]);
  });

  it("decides each matchup by its ballots", () => {
    const [final] = columns[3].slots;
    expect(final?.entries.find((entry) => entry.id === final.winnerId)?.code).toBe("Valley Christian YN");
    expect(final && ballotScore(final)).toBe("3–0");
    const split = columns[0].slots.find((slot) => slot?.entries.some((entry) => entry.code === "Westlake SS"));
    expect(split?.decidedBy).toBe("ballots");
    expect(split && ballotScore(split)).toBe("2–1");
  });

  it("falls back to the next round's pairings when no ballots were posted", () => {
    const walkover = columns[0].slots.find((slot) => slot?.entries.some((entry) => entry.code === "Regent Legacy KC"));
    expect(walkover?.decidedBy).toBe("advanced");
    expect(walkover?.entries.find((entry) => entry.id === walkover.winnerId)?.code).toBe("Mission San Jose SL");
  });

  it("puts the two matchups feeding each debate beside it", () => {
    for (let index = 0; index < columns.length - 1; index++) {
      columns[index + 1].slots.forEach((target, position) => {
        const feeders = [columns[index].slots[2 * position], columns[index].slots[2 * position + 1]];
        for (const feeder of feeders) {
          expect(target?.entries.some((entry) => entry.id === feeder?.winnerId)).toBe(true);
        }
      });
    }
  });

  it("leaves an empty slot for an entry that skipped a round", () => {
    const [semis, final] = buildBracket(rounds.slice(2));
    const withoutOneSemi = { ...rounds[2], Sections: Object.fromEntries(Object.entries(rounds[2].Sections).slice(0, 1)) };
    const partial = buildBracket([withoutOneSemi, rounds[3]]);
    expect(semis.slots).toHaveLength(2);
    expect(final.slots).toHaveLength(1);
    expect(partial[0].slots.filter((slot) => slot === null)).toHaveLength(1);
  });
});

describe("BracketCard", () => {
  it("renders every round with its matchups and the advancing entries", () => {
    const client = createTournamentsClient("/api/tabroom");
    const html = renderToString(
      <TournamentsContext.Provider value={{ client, hrefs: tournamentHrefs("/tournaments", client.slugOf), Link: defaultLink }}>
        <BracketCard columns={buildBracket(rounds)} eventName="Lincoln Douglas (Open)" eventType="debate" eventAbbr="OPLD" tournId={40372} currentRound={8} />
      </TournamentsContext.Provider>,
    );
    expect(html).toContain("Elimination bracket");
    for (const label of ["Octas", "Quarters", "Semis", "Final"]) expect(html).toContain(`aria-label="${label}"`);
    expect(html.match(/data-matchup=/g)).toHaveLength(15);
    expect(html.match(/data-winner=/g)).toHaveLength(15);
  });
});
