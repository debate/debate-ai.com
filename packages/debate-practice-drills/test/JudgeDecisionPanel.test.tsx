// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `JudgeDecisionPanel` and the pasted-speech
 * `SpeechJudgeSection` inside it: judging pasted speeches, a saved round's
 * decision from its paradigm and flow summary, the multi-judge panel, and
 * clearing the history.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getJudgeParadigm } from "@debate/speech-writer/src/judge/judge-paradigms";
import { JudgeDecisionPanel } from "../src/panels/JudgeDecisionPanel";
import { saveFlowSummary } from "../src/state/flowSummaries";
import { saveJudgeParadigmSelection } from "../src/state/judgeParadigmSelections";
import { button, buttons } from "./helpers/dom";
import { click, mount, type, type Mounted } from "./helpers/mount";

const ai = vi.hoisted(() => ({ requestJudgeDecision: vi.fn(), requestSpeechJudgeDecision: vi.fn() }));
vi.mock("../src/round/judge-decision-client", () => ({ requestJudgeDecision: ai.requestJudgeDecision }));
vi.mock("../src/round/speech-judge-ai", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requestSpeechJudgeDecision: ai.requestSpeechJudgeDecision,
}));
vi.mock("../src/round/judge-decisions-client", () => ({
  listSavedJudgeDecisions: async () => null,
  saveJudgeDecisionToAccount: async () => {},
  deleteSavedJudgeDecisionFromAccount: async () => {},
}));

let view: Mounted;
const text = () => view.container.textContent ?? "";
const input = (selector: string) => view.container.querySelector(selector) as HTMLInputElement;

function seedRound(roundId = "round-1") {
  saveFlowSummary({
    roundId,
    summaries: [
      {
        rowIndex: 0,
        isHeading: false,
        argument: "Solvency deficit",
        originSpeech: "1NC",
        entries: [{ speech: "1NC", content: "Solvency deficit" }],
        lastSpeech: "1NC",
        isUnanswered: true,
      },
    ],
  });
  saveJudgeParadigmSelection({ roundId, paradigm: getJudgeParadigm("flow")! });
}

const decision = (winner: "primary" | "secondary", issue: string) => ({
  winner,
  keyVotingIssues: [issue],
  rationale: `Voted on ${issue}.`,
});

beforeEach(async () => {
  localStorage.clear();
  ai.requestJudgeDecision.mockReset();
  ai.requestSpeechJudgeDecision.mockReset();
  view = await mount(createElement(JudgeDecisionPanel));
});

afterEach(async () => {
  await view.unmount();
});

describe("pasted speeches", () => {
  it("needs a speech before judging, then shows the decision", async () => {
    await click(button(view.container, "Judge these speeches"));
    expect(text()).toContain("Paste at least one speech to judge.");

    await type(input('[aria-label="Speech 1 text"]'), "We affirm the resolution.");
    expect(text()).toContain("4 words");
    ai.requestSpeechJudgeDecision.mockResolvedValueOnce("Aff wins on the uncontested case.");
    await click(button(view.container, "Judge these speeches"));
    expect(text()).toContain("Aff wins on the uncontested case.");

    await click(buttons(view.container, "Clear")[0]);
    expect(text()).not.toContain("Aff wins on the uncontested case.");
  });

  it("reports a failed request", async () => {
    await type(input('[aria-label="Speech 1 text"]'), "Text");
    ai.requestSpeechJudgeDecision.mockRejectedValueOnce(new Error("Judge offline"));
    await click(button(view.container, "Judge these speeches"));
    expect(text()).toContain("Judge offline");
  });

  it("adds, renames, re-sides and removes speeches, and keeps a draft", async () => {
    await click(button(view.container, "Add speech"));
    expect(view.container.querySelectorAll("textarea")).toHaveLength(9);
    await type(input('[aria-label="Speech 9 name"]'), "Rebuttal");
    await click(view.container.querySelector('[aria-label^="Speech 9 side"]') as HTMLElement);
    await click(buttons(view.container, "Remove")[0]);
    expect(view.container.querySelectorAll("textarea")).toHaveLength(8);
    expect(localStorage.getItem("debate-ai:speech-judge-draft")).toContain("Rebuttal");
  });

  it("asks before resetting pasted speeches", async () => {
    await type(input('[aria-label="Speech 1 text"]'), "Keep me");
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    await click(button(view.container, "Reset to 8-speech preset"));
    expect(input('[aria-label="Speech 1 text"]').value).toBe("Keep me");
    confirm.mockReturnValueOnce(true);
    await click(button(view.container, "Reset to 8-speech preset"));
    expect(input('[aria-label="Speech 1 text"]').value).toBe("");
    confirm.mockRestore();
  });
});

describe("saved-round decisions", () => {
  it("needs a round id and its saved sources", async () => {
    await click(button(view.container, "Get AI judge decision"));
    expect(text()).toContain("Round ID is required.");
    await type(input("#judge-decision-round-id"), "round-9");
    await click(button(view.container, "Get AI judge decision"));
    expect(text()).toContain('for round "round-9"');
  });

  it("decides a saved round and keeps it as history", async () => {
    seedRound();
    ai.requestJudgeDecision.mockResolvedValueOnce(decision("secondary", "The solvency deficit"));
    await type(input("#judge-decision-round-id"), "round-1");
    await type(input("#judge-decision-secondary"), "Westwood");
    await click(button(view.container, "Get AI judge decision"));
    expect(text()).toContain("Westwood");
    expect(text()).toContain("The solvency deficit");
    expect(input("#judge-decision-round-id").value).toBe("");

    await click(button(view.container, "Clear all history for this round"));
    expect(text()).toContain("No AI judge decisions yet.");
  });

  it("reports a failed decision", async () => {
    seedRound();
    ai.requestJudgeDecision.mockRejectedValueOnce(new Error("Quota exceeded"));
    await type(input("#judge-decision-round-id"), "round-1");
    await click(button(view.container, "Get AI judge decision"));
    expect(text()).toContain("Quota exceeded");
  });

  it("runs a multi-judge panel and combines the votes", async () => {
    seedRound();
    await click(button(view.container, "Run multi-judge panel"));
    expect(text()).toContain("Round ID is required.");
    await type(input("#judge-decision-round-id"), "round-1");
    const paradigms = Array.from(view.container.querySelectorAll('label input[type="checkbox"]')) as HTMLInputElement[];
    await click(paradigms[0]);
    await click(button(view.container, "Run multi-judge panel"));
    expect(text()).toContain("Select at least 2 paradigms");

    await click(paradigms[1]);
    ai.requestJudgeDecision
      .mockResolvedValueOnce(decision("primary", "Case outweighs"))
      .mockResolvedValueOnce(decision("primary", "Turn is dropped"));
    await click(button(view.container, "Run multi-judge panel"));
    expect(text()).toContain("Multi-judge panel (2 paradigms)");
    expect(text()).toContain("Unanimous");
    expect(text()).toContain("Combined key voting issues");

    await click(button(view.container, "Clear this panel run"));
    expect(text()).toContain("No AI judge decisions yet.");
  });

  it("reports a panel run that fails or is missing its flow summary", async () => {
    await type(input("#judge-decision-round-id"), "round-2");
    const paradigms = Array.from(view.container.querySelectorAll('label input[type="checkbox"]')) as HTMLInputElement[];
    await click(paradigms[0]);
    await click(paradigms[1]);
    await click(button(view.container, "Run multi-judge panel"));
    expect(text()).toContain('for round "round-2"');

    seedRound("round-2");
    ai.requestJudgeDecision.mockRejectedValueOnce(new Error("Panel crashed"));
    await click(button(view.container, "Run multi-judge panel"));
    expect(text()).toContain("Panel crashed");
  });
});
