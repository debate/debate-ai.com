// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `PracticeRoundSimulatorPanel`: saving a
 * round setup (built-in and custom judge paradigms and opponent personas,
 * and the persona library), generating the AI opponent's next speech,
 * replaying delivered speeches, post-round feedback from the selected flow,
 * the AI judge decision, the attempts comparison download, and clearing.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PracticeRoundSimulatorPanel } from "../src/panels/PracticeRoundSimulatorPanel";
import { getAiVersusRound, saveAiVersusRound } from "@debate/round/src/state/aiVersusRounds";
import { getPracticeRound, listPracticeRounds } from "@debate/round/src/state/practiceRounds";
import { debateStyleMap } from "@debate/timer/src/formats/debate-format-times";
import { saveFlowSummary } from "../src/state/flowSummaries";
import { listCustomOpponentPersonaLibrary } from "../src/state/customOpponentPersonaLibrary";
import { button, buttons, captureDownloads } from "./helpers/dom";
import { sampleFlow, selectFlow } from "./helpers/flow";
import { click, mount, type, type Mounted } from "./helpers/mount";

const ai = vi.hoisted(() => ({
  requestAiVersusSpeech: vi.fn(),
  requestAiVersusSpeechWithPersona: vi.fn(),
  requestJudgeDecision: vi.fn(),
}));
vi.mock("../src/round/ai-versus-speech-client", () => ({ requestAiVersusSpeech: ai.requestAiVersusSpeech }));
vi.mock("../src/round/opponent-persona-speech-client", () => ({
  requestAiVersusSpeechWithPersona: ai.requestAiVersusSpeechWithPersona,
}));
vi.mock("../src/round/judge-decision-client", () => ({ requestJudgeDecision: ai.requestJudgeDecision }));
vi.mock("../src/round/custom-opponent-persona-library-client", () => ({
  listMyCustomOpponentPersonas: async () => null,
  listSharedCustomOpponentPersonas: async () => null,
  saveCustomOpponentPersonaToAccount: async () => {},
  deleteCustomOpponentPersonaFromAccount: async () => {},
}));

let view: Mounted;
const text = () => view.container.textContent ?? "";
const field = <T extends Element = HTMLInputElement>(selector: string) =>
  view.container.querySelector(selector) as unknown as T;

async function saveRound(roundId: string) {
  await type(field("#practice-round-id"), roundId);
  await click(button(view.container, "Save round setup"));
}

/** Seeds the round's delivered speeches up to (not including) the AI's first turn. */
function seedUntilAiTurn(roundId: string) {
  const { setup } = getPracticeRound(roundId)!;
  const firstAi = setup.speechOrder.findIndex((slot) => slot.speaker === "ai");
  saveAiVersusRound({
    roundId,
    // The form's defaults: its first format, on the primary side.
    styleKey: debateStyleMap[0],
    userSide: "primary",
    submittedSpeeches: setup.speechOrder
      .slice(0, firstAi)
      .map((slot) => ({ name: slot.name, speaker: slot.speaker, text: `My ${slot.name}.` })),
  });
  return firstAi;
}

/** Remounts so the panel re-reads rounds seeded straight into storage. */
async function remount() {
  await view.unmount();
  view = await mount(createElement(PracticeRoundSimulatorPanel));
}

beforeEach(async () => {
  localStorage.clear();
  selectFlow(null);
  ai.requestAiVersusSpeech.mockReset().mockResolvedValue("AI rebuttal.");
  ai.requestAiVersusSpeechWithPersona.mockReset().mockResolvedValue("Persona rebuttal.");
  ai.requestJudgeDecision.mockReset().mockResolvedValue({
    winner: "secondary",
    keyVotingIssues: ["The turn on growth"],
    rationale: "The negative won the turn.",
  });
  view = await mount(createElement(PracticeRoundSimulatorPanel));
});

afterEach(async () => {
  await view.unmount();
});

describe("PracticeRoundSimulatorPanel", () => {
  it("starts empty and requires a round id", async () => {
    expect(text()).toContain("No practice rounds yet.");
    await click(button(view.container, "Save round setup"));
    expect(text()).toContain("Round ID is required.");
    expect(listPracticeRounds()).toEqual([]);
  });

  it("saves a round with the default judge and no AI opponent, then clears it", async () => {
    await saveRound("round-1");
    expect(text()).not.toContain("Round ID is required.");
    expect(text()).toContain("Round round-1");
    expect(text()).toContain("No AI opponent");
    expect(text()).toContain("No post-round feedback yet.");
    expect(field("#practice-round-id").value).toBe("");
    expect(getPracticeRound("round-1")?.setup.opponentPersona).toBeFalsy();

    await click(button(view.container, "Clear"));
    expect(text()).toContain("No practice rounds yet.");
    expect(getPracticeRound("round-1")).toBeUndefined();
  });

  it("validates and saves a custom judge paradigm", async () => {
    await click(field("#practice-round-paradigm-custom"));
    await type(field("#practice-round-id"), "round-2");
    await click(button(view.container, "Save round setup"));
    expect(listPracticeRounds()).toEqual([]);

    await type(field("#practice-round-custom-judge-name"), "Judge Smith");
    await type(field<HTMLTextAreaElement>("#practice-round-custom-judge-notes"), "Votes on framework first.");
    await click(button(view.container, "Save round setup"));
    expect(getPracticeRound("round-2")?.setup.judgeParadigm.name).toContain("Judge Smith");
    expect(text()).toContain("Round round-2");
  });

  it("saves a custom opponent persona to the library and reuses it", async () => {
    await click(field("#practice-round-persona-custom"));
    await type(field("#practice-round-id"), "round-3");
    await click(button(view.container, "Save round setup"));
    expect(listPracticeRounds()).toEqual([]);

    await type(field("#practice-round-custom-persona-name"), "Spreader");
    await type(field<HTMLTextAreaElement>("#practice-round-custom-persona-notes"), "Reads six off-case positions.");
    const saveToLibrary = Array.from(view.container.querySelectorAll("label")).find((label) =>
      label.textContent?.includes("Save to my persona library"),
    )!.querySelector("input")!;
    await click(saveToLibrary);
    expect(text()).toContain("Share with my team");
    await click(button(view.container, "Save round setup"));

    expect(getPracticeRound("round-3")?.setup.opponentPersona?.name).toBe("Custom: Spreader");
    expect(listCustomOpponentPersonaLibrary().map((entry) => entry.name)).toEqual(["Spreader"]);
    expect(text()).toContain("My persona library");

    await click(button(view.container, "Use for this round"));
    expect(field("#practice-round-custom-persona-name").value).toBe("Spreader");
  });

  it("generates the AI opponent's next speech with its persona", async () => {
    const persona = Array.from(view.container.querySelectorAll('[id^="practice-round-persona-"]')).find(
      (item) => !/-(none|custom)$/.test(item.id),
    )!;
    await click(persona);
    await saveRound("round-4");
    const record = getPracticeRound("round-4")!;
    expect(record.setup.opponentPersona).toBeTruthy();

    seedUntilAiTurn("round-4");
    await remount();

    expect(text()).toContain("Arguing as");
    await click(button(view.container, "Generate AI opponent speech"));
    expect(ai.requestAiVersusSpeechWithPersona).toHaveBeenCalledTimes(1);
    expect(ai.requestAiVersusSpeech).not.toHaveBeenCalled();
    expect(getAiVersusRound("round-4")!.submittedSpeeches.at(-1)).toMatchObject({
      speaker: "ai",
      text: "Persona rebuttal.",
    });
  });

  it("shows a generation failure without saving a speech", async () => {
    await saveRound("round-5");
    const delivered = seedUntilAiTurn("round-5");
    await remount();

    ai.requestAiVersusSpeech.mockRejectedValueOnce(new Error("Model unavailable"));
    await click(button(view.container, "Generate AI opponent speech"));
    expect(text()).toContain("Model unavailable");
    expect(getAiVersusRound("round-5")!.submittedSpeeches).toHaveLength(delivered);
  });

  it("replays delivered speeches step by step", async () => {
    await saveRound("round-6");
    const record = getPracticeRound("round-6")!;
    const [first, second] = record.setup.speechOrder;
    saveAiVersusRound({
      roundId: "round-6",
      styleKey: debateStyleMap[0],
      userSide: "primary",
      submittedSpeeches: [
        { name: first.name, speaker: "user", text: "Opening speech." },
        { name: second.name, speaker: "ai", text: "AI answer." },
      ],
    });
    await remount();

    expect(text()).toContain("Replay round");
    expect(text()).toContain("Opening speech.");
    expect(button(view.container, "← Prev").hasAttribute("disabled")).toBe(true);
    await click(button(view.container, "Next →"));
    expect(text()).toContain("AI answer.");
    await click(button(view.container, "← Prev"));
    expect(text()).toContain("Opening speech.");
  });

  it("generates post-round feedback only from the round's own selected flow", async () => {
    await saveRound("7");
    const generate = () => button(view.container, "Generate post-round feedback");
    expect(generate().hasAttribute("disabled")).toBe(true);
    expect(text()).toContain("Select this round's flow (round ID 7)");

    await view.unmount();
    selectFlow(sampleFlow(7));
    view = await mount(createElement(PracticeRoundSimulatorPanel));
    expect(generate().hasAttribute("disabled")).toBe(false);

    await click(generate());
    expect(text()).toContain("A side (e.g. aff or neg) is required");

    await type(field("#practice-feedback-side-7"), "aff");
    await click(generate());
    expect(getPracticeRound("7")?.feedback).toBeTruthy();
    expect(text()).toContain("Post-round feedback");
    expect(buttons(view.container, "Regenerate post-round feedback")).toHaveLength(1);
  });

  it("asks for a flow summary before requesting the AI judge, then shows the decision", async () => {
    await saveRound("round-8");
    await click(button(view.container, "Get AI judge decision"));
    expect(text()).toContain("Save a flow summary for this round first");
    expect(ai.requestJudgeDecision).not.toHaveBeenCalled();

    saveFlowSummary({
      roundId: "round-8",
      summaries: [
        {
          rowIndex: 0,
          isHeading: false,
          argument: "Solvency deficit.",
          originSpeech: "1AC",
          entries: [{ speech: "1AC", content: "Solvency deficit." }],
          lastSpeech: "1AC",
          isUnanswered: true,
        },
      ],
    });
    await click(button(view.container, "Get AI judge decision"));
    expect(ai.requestJudgeDecision).toHaveBeenCalledTimes(1);
    expect(text()).toContain("AI judge decision: Secondary wins");
    expect(text()).toContain("The negative won the turn.");
    expect(text()).toContain("Scoring rubric");
    expect(getPracticeRound("round-8")?.judgeDecision?.winner).toBe("secondary");
    expect(buttons(view.container, "Re-request AI judge decision")).toHaveLength(1);

    ai.requestJudgeDecision.mockRejectedValueOnce(new Error("Judge offline"));
    await click(button(view.container, "Re-request AI judge decision"));
    expect(text()).toContain("Judge offline");
  });

  it("compares past attempts and downloads the comparison", async () => {
    await saveRound("round-9");
    expect(text()).toContain("Compare your past attempts");
    expect(text()).toContain("1 attempt logged — 0 won, 0 lost, 1 pending");
    const downloads = captureDownloads();
    await click(button(view.container, "Download comparison"));
    expect(downloads).toHaveLength(1);
  });
});
