// @vitest-environment jsdom
/**
 * @fileoverview The end-of-round scorecard: both rubric shapes (the
 * backend's user-vs-bot and upstream's for/against), the side naming and
 * rating panel the for/against shape gets, the rewards panel the user-vs-bot
 * shape gets, and which "skills to improve" cards the weakest phases pick.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { JudgmentData } from "../src/backend/types";
import {
  DEFAULT_COACH_SKILLS,
  JudgmentPopup,
  type JudgmentDataForAgainst,
  type JudgmentPopupProps,
} from "../src/ui/JudgmentPopup";
import { click, mount, type Mounted } from "./helpers/mount";

const strong = (reason = "Clear and well supported.") => ({ score: 9, reason });

function userBot(overrides: Partial<JudgmentData> = {}): JudgmentData {
  return {
    opening_statement: { user: strong(), bot: { score: 7, reason: "Solid." } },
    cross_examination: { user: strong(), bot: strong() },
    answers: { user: strong(), bot: strong() },
    closing: { user: strong(), bot: strong() },
    total: { user: 36, bot: 34 },
    verdict: { winner: "User", reason: "Better weighing.", congratulations: "Well done!", opponent_analysis: "Bot overreached." },
    ...overrides,
  };
}

function forAgainst(overrides: Partial<JudgmentDataForAgainst> = {}): JudgmentDataForAgainst {
  return {
    opening_statement: { for: strong(), against: strong() },
    cross_examination_questions: { for: strong(), against: strong() },
    cross_examination_answers: { for: strong(), against: strong() },
    closing: { for: strong(), against: strong() },
    total: { for: 30, against: 28 },
    verdict: { winner: "For", reason: "r", congratulations: "Congrats", opponent_analysis: "Close round." },
    ...overrides,
  };
}

let mounted: Mounted | null = null;
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

async function render(props: Partial<JudgmentPopupProps> & Pick<JudgmentPopupProps, "judgment">) {
  mounted = await mount(<JudgmentPopup onClose={() => {}} {...props} />);
  return mounted.container;
}

const headings = (container: HTMLElement, selector: string) =>
  [...container.querySelectorAll(selector)].map((node) => node.textContent?.trim());

/** The titles of the recommended "skills to improve" cards, one per "Start Now" link. */
const skillTitles = (container: HTMLElement) =>
  [...container.querySelectorAll("a[href]")].map((link) => link.parentElement?.querySelector("h4")?.textContent);

describe("JudgmentPopup, user-vs-bot rubric", () => {
  it("names the sides You and the bot and shows the user-vs-bot phases", async () => {
    const container = await render({ judgment: userBot(), botName: "Rookie Rick", botStance: "Against", userStance: "For" });
    expect(headings(container, "h3")).toEqual(
      expect.arrayContaining(["You", "Rookie Rick", "Cross Examination", "Answers to Cross Examination", "Total Scores"]),
    );
    expect(container.textContent).toContain("User Wins!");
    expect(container.textContent).toContain("36");
    expect(container.textContent).not.toContain("Rating Impact");
  });

  it("falls back to 'Bot' and the default avatars when nothing is supplied", async () => {
    const container = await render({ judgment: userBot() });
    expect(headings(container, "h3")).toContain("Bot");
    const avatars = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(avatars.every((src) => src?.startsWith("https://api.dicebear.com/"))).toBe(true);
  });

  it("shows points and labelled badges from the round's gamification award", async () => {
    const container = await render({
      judgment: userBot(),
      gamification: { points: 50, action: "win", badgesAwarded: ["FirstWin", "MysteryBadge"], newScore: 150 },
    });
    expect(container.textContent).toContain("+50 points");
    expect(container.textContent).toContain("Total score: 150");
    expect(container.textContent).toContain("New Badge: First Win");
    expect(container.textContent).toContain("New Badge: MysteryBadge");
  });

  it("recommends only the argument drill when the opening was weak", async () => {
    const container = await render({
      judgment: userBot({ opening_statement: { user: { score: 5, reason: "Unclear thesis." }, bot: strong() } }),
    });
    expect(skillTitles(container)).toEqual([DEFAULT_COACH_SKILLS[0]!.title]);
  });

  it("recommends only the cross-ex drill when the answers showed evasion", async () => {
    const container = await render({
      judgment: userBot({ answers: { user: { score: 8, reason: "Some evasion on key questions." }, bot: strong() } }),
    });
    expect(skillTitles(container)).toEqual([DEFAULT_COACH_SKILLS[1]!.title]);
  });

  it("shows every drill when no phase, or every phase, was weak", async () => {
    const strongRound = await render({ judgment: userBot() });
    expect(skillTitles(strongRound)).toHaveLength(DEFAULT_COACH_SKILLS.length);
    await mounted!.unmount();

    const weakRound = await render({
      judgment: userBot({
        opening_statement: { user: { score: 3, reason: "Weak." }, bot: strong() },
        cross_examination: { user: { score: 3, reason: "Poor relevance." }, bot: strong() },
      }),
    });
    expect(skillTitles(weakRound)).toHaveLength(DEFAULT_COACH_SKILLS.length);
  });

  it("returns a single custom skill as-is", async () => {
    const only = { title: "Only Drill", description: "d", url: "/only" };
    const container = await render({ judgment: userBot(), coachSkills: [only] });
    expect(skillTitles(container)).toEqual(["Only Drill"]);
    expect(container.querySelector("a[href]")?.getAttribute("href")).toBe("/only");
  });

  it("calls onClose, and onHome only when supplied", async () => {
    const onClose = vi.fn();
    const onHome = vi.fn();
    const container = await render({ judgment: userBot(), onClose, onHome });
    const buttons = [...container.querySelectorAll("button")];
    await click(buttons.find((button) => button.textContent === "Back to Home")!);
    await click(buttons.find((button) => button.textContent === "Close")!);
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    await mounted!.unmount();

    const withoutHome = await render({ judgment: userBot() });
    expect(withoutHome.textContent).not.toContain("Back to Home");
  });
});

describe("JudgmentPopup, for/against rubric", () => {
  it("puts the local debater on their side and shows the rating impact", async () => {
    const container = await render({
      judgment: forAgainst(),
      localRole: "against",
      localDisplayName: "Ada",
      opponentDisplayName: "Grace",
      localAvatarUrl: "/ada.png",
      opponentAvatarUrl: "/grace.png",
      ratingSummary: { for: { rating: 1512.345, change: 12.3 }, against: { rating: 1487.5, change: -12.3 } },
    });
    expect(headings(container, "h3").slice(0, 2)).toEqual(["Grace", "Ada"]);
    expect([...container.querySelectorAll("img")].map((img) => img.getAttribute("src"))).toEqual([
      "/grace.png",
      "/ada.png",
    ]);
    expect(headings(container, "h3")).toEqual(
      expect.arrayContaining(["Cross Examination Questions", "Cross Examination Answers", "Rating Impact"]),
    );
    expect(container.textContent).toContain("New Rating: 1512.35");
    expect(container.textContent).toContain("Change: +12.30");
    expect(container.textContent).toContain("Change: -12.30");
  });

  it("uses the role labels when the local side is unknown", async () => {
    const container = await render({ judgment: forAgainst(), forRole: "Pro", againstRole: "Con" });
    expect(headings(container, "h3").slice(0, 2)).toEqual(["Pro", "Con"]);
  });

  it("defaults to For/Against Debater and the local name when playing for", async () => {
    const unnamed = await render({ judgment: forAgainst() });
    expect(headings(unnamed, "h3").slice(0, 2)).toEqual(["For Debater", "Against Debater"]);
    await mounted!.unmount();

    const playingFor = await render({ judgment: forAgainst(), localRole: "for" });
    expect(headings(playingFor, "h3").slice(0, 2)).toEqual(["You", "Opponent"]);
  });

  it("never shows the user-vs-bot rewards panel", async () => {
    const container = await render({
      judgment: forAgainst(),
      gamification: { points: 50, action: "win", badgesAwarded: [], newScore: 150 },
    });
    expect(container.textContent).not.toContain("Round Rewards");
  });
});
