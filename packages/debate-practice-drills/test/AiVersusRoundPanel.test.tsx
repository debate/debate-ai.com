// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `AiVersusRoundPanel`: starting a round,
 * alternating your speeches with generated AI speeches in turn order,
 * regenerating an AI speech, dictation, downloading the finished transcript,
 * and clearing.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiVersusRoundPanel } from "../src/panels/AiVersusRoundPanel";
import { listAiVersusRounds } from "@debate/round/src/state/aiVersusRounds";
import { button, buttons, captureDownloads } from "./helpers/dom";
import { click, flush, mount, type, type Mounted } from "./helpers/mount";
import { FakeRecognition, installSpeechRecognition } from "./helpers/speech-recognition";

const ai = vi.hoisted(() => ({ requestAiVersusSpeech: vi.fn(), requestAiVersusSpeechWithPersona: vi.fn() }));
vi.mock("../src/round/ai-versus-speech-client", () => ({ requestAiVersusSpeech: ai.requestAiVersusSpeech }));
vi.mock("../src/round/opponent-persona-speech-client", () => ({
  requestAiVersusSpeechWithPersona: ai.requestAiVersusSpeechWithPersona,
}));

let view: Mounted;
let uninstall: () => void;
const text = () => view.container.textContent ?? "";

async function start(roundId = "round-1") {
  await type(view.container.querySelector("#ai-versus-round-id") as HTMLInputElement, roundId);
  await click(button(view.container, "Start round"));
}

/** Delivers the next speech, whoever's turn it is. */
async function deliverNext() {
  const generate = buttons(view.container, "Generate AI speech")[0];
  if (generate) {
    await click(generate);
    return;
  }
  await type(view.container.querySelector("#ai-versus-speech-text") as HTMLTextAreaElement, "My speech.");
  await click(button(view.container, "Submit speech"));
}

beforeEach(async () => {
  localStorage.clear();
  uninstall = installSpeechRecognition();
  let count = 0;
  ai.requestAiVersusSpeech.mockReset().mockImplementation(async () => `AI speech ${++count}`);
  view = await mount(createElement(AiVersusRoundPanel));
});

afterEach(async () => {
  await view.unmount();
  uninstall();
});

describe("AiVersusRoundPanel", () => {
  it("starts nothing without a round id", async () => {
    // The "Round ID is required." message is only rendered inside an open
    // round's card, so with none open the click just does nothing visible.
    await click(button(view.container, "Start round"));
    expect(listAiVersusRounds()).toEqual([]);
    expect(text()).not.toContain("Submit speech");
  });

  it("plays a round to the end, alternating with the AI", async () => {
    await start();
    expect(text()).toContain("Round round-1");
    expect(text()).toContain("Next");

    await click(button(view.container, "Submit speech"));
    expect(text()).toContain("Speech text is required.");

    for (let turn = 0; turn < 20 && !text().includes("Round complete"); turn++) await deliverNext();
    expect(text()).toContain("Round complete — every speech has been delivered.");
    expect(ai.requestAiVersusSpeech).toHaveBeenCalled();
    expect(listAiVersusRounds()[0].submittedSpeeches.some((speech) => speech.speaker === "ai")).toBe(true);

    const downloads = captureDownloads();
    await click(buttons(view.container, "Download transcript")[0]);
    expect(downloads).toHaveLength(1);
  });

  it("regenerates an AI speech", async () => {
    await start();
    for (let turn = 0; turn < 4 && buttons(view.container, "Regenerate").length === 0; turn++) await deliverNext();
    ai.requestAiVersusSpeech.mockResolvedValueOnce("A sharper rebuttal");
    await click(buttons(view.container, "Regenerate")[0]);
    expect(JSON.stringify(listAiVersusRounds())).toContain("A sharper rebuttal");
  });

  it("shows why AI generation failed", async () => {
    await start();
    for (let turn = 0; turn < 4 && buttons(view.container, "Generate AI speech").length === 0; turn++) await deliverNext();
    ai.requestAiVersusSpeech.mockRejectedValueOnce(new Error("Model overloaded"));
    await click(button(view.container, "Generate AI speech"));
    expect(text()).toContain("Model overloaded");
  });

  it("dictates your speech", async () => {
    await start();
    if (buttons(view.container, "Generate AI speech").length) await deliverNext();
    await click(button(view.container, "🎤 Record"));
    await flush(() => FakeRecognition.emit("Thank you judge"));
    await click(button(view.container, "Stop recording"));
    expect((view.container.querySelector("#ai-versus-speech-text") as HTMLTextAreaElement).value).toContain("Thank you judge");
  });

  it("closes, reopens and clears saved rounds", async () => {
    await start("round-2");
    await click(button(view.container, "Close"));
    expect(text()).not.toContain("Submit speech");
    await click(button(view.container, "Continue"));
    expect(text()).toContain("Round round-2");
    await click(button(view.container, "Clear"));
    expect(listAiVersusRounds()).toEqual([]);
    expect(text()).toContain("No AI-versus rounds yet.");
  });
});
