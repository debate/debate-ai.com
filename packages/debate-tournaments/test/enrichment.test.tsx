// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoundSchematic } from "../src/ui/client";
import { createTournamentsClient } from "../src/ui/client";
import { tabroomParadigmUrl, type JudgeParadigmLookup, type TeamRatingLookup } from "../src/ui/enrichment";
import { Schematic } from "../src/ui/pages/RoundPage";
import { ResultSetView } from "../src/ui/pages/ResultSetPage";
import { TournamentsContext, defaultLink, type TournamentsContextValue } from "../src/ui/shared";
import { tournamentHrefs } from "../src/routes";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const round: RoundSchematic = {
  id: 1,
  name: 1,
  label: "Round 1",
  type: "prelim",
  tz: "UTC",
  startTime: null,
  Event: { id: 9, name: "Varsity Public Forum", abbr: "VPF", type: "debate" },
  Sections: {
    1: {
      id: 11,
      letter: "1",
      flight: "1",
      Room: { id: 1, name: "101" },
      Entries: { 1: { id: 21, code: "Harker LL", side: 1 }, 2: { id: 22, code: "Nowhere AB", side: 2 } },
      Judges: { 5: { id: 5, first: "Sam", last: "Lee", paradigm: 777 }, 6: { id: 6, first: "Ann", last: "Yu" }, 7: { id: 7, first: "Pat", last: "Common" } },
    },
  },
};

const lookupTeamRating: TeamRatingLookup = vi.fn(async (query) =>
  query.code === "Harker LL" ? { names: "Le & Luo", rating: 91.25, rank: 2, school: "Harker", rankingLabel: "HS Public Forum", logoSrc: "/harker.png" } : null,
);
const lookupJudgeParadigm: JudgeParadigmLookup = vi.fn(async (first) => (first === "Ann" ? 888 : null));

function context(extra: Partial<TournamentsContextValue> = {}): TournamentsContextValue {
  const client = createTournamentsClient("/api/tabroom");
  return { client, hrefs: tournamentHrefs("/tournaments", client.slugOf), Link: defaultLink, lookupTeamRating, lookupJudgeParadigm, ...extra };
}

let container: HTMLDivElement | null = null;
afterEach(() => {
  container?.remove();
  container = null;
});

async function render(node: React.ReactNode, value = context()) {
  container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<TournamentsContext.Provider value={value}>{node}</TournamentsContext.Provider>);
  });
  // Let the lookups settle.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return container;
}

describe("pairings enrichment", () => {
  it("shows a ranked entry's logo, last names and rating, and leaves the rest alone", async () => {
    const el = await render(<Schematic round={round} />);
    const ratings = el.querySelectorAll("[data-team-rating]");
    expect(ratings).toHaveLength(1);
    expect(ratings[0].textContent).toBe("Le & Luo91.3");
    expect(ratings[0].querySelector("img")?.getAttribute("src")).toBe("/harker.png");
    expect(ratings[0].getAttribute("title")).toContain("#2 in the HS Public Forum rankings");
    expect(el.textContent).toContain("Nowhere AB");
    expect(lookupTeamRating).toHaveBeenCalledWith(expect.objectContaining({ code: "Harker LL", event: round.Event }));
  });

  it("links judges to their paradigm: from the pairing, or found by name", async () => {
    const el = await render(<Schematic round={round} />);
    const links = [...el.querySelectorAll("a")].filter((a) => a.href.includes("paradigm"));
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Sam Lee", tabroomParadigmUrl(777)],
      ["Ann Yu", tabroomParadigmUrl(888)],
    ]);
    // Sam Lee's pairing already names their paradigm, so only the others are searched.
    expect(lookupJudgeParadigm).not.toHaveBeenCalledWith("Sam", "Lee");
    expect(lookupJudgeParadigm).toHaveBeenCalledWith("Pat", "Common");
    expect(el.textContent).toContain("Pat Common");
  });

  it("opens a judge's paradigm in an overlay on click", async () => {
    const el = await render(<Schematic round={round} />);
    const link = [...el.querySelectorAll("a")].find((a) => a.textContent === "Ann Yu")!;
    await act(async () => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });
    const frame = el.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe(tabroomParadigmUrl(888));
    expect(el.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe("Ann Yu — paradigm");
  });

  it("renders plain names and codes without host lookups", async () => {
    const el = await render(<Schematic round={round} />, context({ lookupTeamRating: undefined, lookupJudgeParadigm: undefined }));
    expect(el.querySelectorAll("[data-team-rating]")).toHaveLength(0);
    expect([...el.querySelectorAll("a")].map((a) => a.textContent)).toEqual(["Sam Lee"]);
  });
});

describe("results enrichment", () => {
  it("adds the rating to a ranked entry without repeating printed names", async () => {
    const el = await render(
      <ResultSetView
        set={{
          id: 1,
          tag: "final",
          label: "Final Places",
          Event: { id: 9, name: "Varsity Public Forum", abbr: "VPF" },
          results: [{ place: "1st", Entry: { id: 21, code: "Harker LL", name: "Le & Luo" }, School: { id: 2, code: null, name: "Harker" } }],
        }}
      />,
    );
    const rating = el.querySelector("[data-team-rating]");
    expect(rating?.textContent).toBe("91.3");
    expect(lookupTeamRating).toHaveBeenCalledWith(expect.objectContaining({ code: "Harker LL", name: "Le & Luo", school: "Harker" }));
  });

  it("still server-renders outside the app", () => {
    expect(renderToString(<ResultSetView set={{ id: 1, tag: "rank", label: "Rank", results: [{ place: "1st", Entry: { id: 7, code: "AAA", name: null } }] }} />)).toContain("AAA");
  });
});
