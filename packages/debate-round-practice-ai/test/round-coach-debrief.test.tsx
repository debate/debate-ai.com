// @vitest-environment jsdom
/**
 * @fileoverview The Coach debrief on the Practice vs AI scorecard: mapping a
 * judgment + transcript to the debrief input, the remembered coaching-style
 * picker, the request/answer/error states, and where `JudgmentPopup` shows it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COACH_PERSONA_PREFERENCES_STORAGE_KEY,
  getCoachPersonaPreference,
  saveCoachPersonaPreference,
  type RoundDebriefInput,
} from "@debate-ai/speech-writer";
import type { DebateMessage, JudgmentData } from "../src/backend/types";
import { JudgmentPopup, type JudgmentDataForAgainst } from "../src/ui/JudgmentPopup";
import { RoundCoachDebrief } from "../src/ui/RoundCoachDebrief";
import { buildRoundDebriefInput } from "../src/ui/round-debrief";
import { click, flush, mount, type Mounted } from "./helpers/mount";

const judgment: JudgmentData = {
  opening_statement: { user: { score: 5, reason: "Weak warrants." }, bot: { score: 8, reason: "Clear framing." } },
  cross_examination: { user: { score: 6, reason: "Some relevance." }, bot: { score: 7, reason: "Sharp." } },
  answers: { user: { score: 7, reason: "Coherent." }, bot: { score: 6, reason: "Evasive." } },
  closing: { user: { score: 8, reason: "Good weighing." }, bot: { score: 7, reason: "Solid." } },
  total: { user: 26, bot: 28 },
  verdict: { winner: "Rookie Rick", reason: "Won framing.", congratulations: "Close one!", opponent_analysis: "Strong bot." },
};

const transcript: DebateMessage[] = [
  { sender: "User", text: "My opening.", phase: "Opening Statements" },
  { sender: "Bot", text: "Bot opening.", phase: "Opening Statements" },
  { sender: "User", text: "My closing.", phase: "Closing Statements" },
];

const input: RoundDebriefInput = buildRoundDebriefInput(judgment, {
  topic: "Resolved: test.",
  userStance: "For",
  botName: "Rookie Rick",
  transcript,
});

let mounted: Mounted | null = null;
beforeEach(() => localStorage.clear());
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

const button = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text));

describe("buildRoundDebriefInput", () => {
  it("maps the four phases with both sides' scores and reasons, the decision and only the user's lines", () => {
    expect(input.topic).toBe("Resolved: test.");
    expect(input.userStance).toBe("For");
    expect(input.opponentName).toBe("Rookie Rick");
    expect(input.phases.map((p) => p.title)).toEqual([
      "Opening Statement",
      "Cross Examination",
      "Answers to Cross Examination",
      "Closing Statement",
    ]);
    expect(input.phases[0]).toEqual({
      title: "Opening Statement",
      userScore: 5,
      opponentScore: 8,
      userReason: "Weak warrants.",
      opponentReason: "Clear framing.",
    });
    expect(input.verdict).toEqual({ winner: "Rookie Rick", reason: "Won framing." });
    expect(input.userSpeeches).toEqual([
      { phase: "Opening Statements", text: "My opening." },
      { phase: "Closing Statements", text: "My closing." },
    ]);
  });

  it("quotes no speeches without a transcript", () => {
    expect(buildRoundDebriefInput(judgment).userSpeeches).toEqual([]);
  });
});

describe("RoundCoachDebrief", () => {
  it("starts on the saved practice-vs-ai style and saves a new pick under that surface only", async () => {
    saveCoachPersonaPreference("practice-vs-ai", "socratic");
    saveCoachPersonaPreference("team-coach", "fact-checker");
    mounted = await mount(<RoundCoachDebrief input={input} requestDebrief={vi.fn()} />);
    expect(button(mounted.container, "Socratic")?.getAttribute("aria-pressed")).toBe("true");

    await click(button(mounted.container, "Devil's Advocate")!);
    expect(button(mounted.container, "Devil's Advocate")?.getAttribute("aria-pressed")).toBe("true");
    expect(getCoachPersonaPreference("practice-vs-ai")).toBe("devils-advocate");
    expect(getCoachPersonaPreference("team-coach")).toBe("fact-checker");
  });

  it("starts on Standard when storage is corrupt", async () => {
    localStorage.setItem(COACH_PERSONA_PREFERENCES_STORAGE_KEY, "{not json");
    mounted = await mount(<RoundCoachDebrief input={input} requestDebrief={vi.fn()} />);
    expect(button(mounted.container, "Standard")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("follows a storage event from another tab or an account merge", async () => {
    mounted = await mount(<RoundCoachDebrief input={input} requestDebrief={vi.fn()} />);
    saveCoachPersonaPreference("practice-vs-ai", "fact-checker");
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: COACH_PERSONA_PREFERENCES_STORAGE_KEY }));
    });
    expect(button(mounted.container, "Fact-Checker")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("requests a debrief in the picked style and shows it with a style badge", async () => {
    const requestDebrief = vi.fn(async () => "Priority one: warrants.");
    mounted = await mount(<RoundCoachDebrief input={input} requestDebrief={requestDebrief} />);
    await click(button(mounted.container, "Socratic")!);
    await click(button(mounted.container, "Get coach debrief")!);

    expect(requestDebrief).toHaveBeenCalledWith(input, expect.objectContaining({ personaId: "socratic" }));
    const debrief = mounted.container.querySelector("[data-testid=round-coach-debrief]");
    expect(debrief?.textContent).toContain("Priority one: warrants.");
    expect(debrief?.textContent).toContain("Socratic coach");
    expect(button(mounted.container, "Get a new debrief")).toBeDefined();
  });

  it("shows no badge for a Standard debrief", async () => {
    mounted = await mount(<RoundCoachDebrief input={input} requestDebrief={async () => "Do X."} />);
    await click(button(mounted.container, "Get coach debrief")!);
    const debrief = mounted.container.querySelector("[data-testid=round-coach-debrief]");
    expect(debrief?.textContent).toBe("Do X.");
  });

  it("shows the request's error and keeps the button usable", async () => {
    const requestDebrief = vi.fn(async () => {
      throw new Error("Sign in to use AI features.");
    });
    mounted = await mount(<RoundCoachDebrief input={input} requestDebrief={requestDebrief} />);
    await click(button(mounted.container, "Get coach debrief")!);
    expect(mounted.container.querySelector("[role=alert]")?.textContent).toBe("Sign in to use AI features.");
    expect(button(mounted.container, "Get coach debrief")?.disabled).toBe(false);
  });
});

describe("RoundCoachDebrief saving", () => {
  const status = (container: HTMLElement) =>
    container.querySelector("[data-testid=round-coach-debrief-save-status]")?.textContent ?? null;

  it("says nothing about saving when the host passes no saveDebrief", async () => {
    mounted = await mount(<RoundCoachDebrief input={input} requestDebrief={async () => "Do X."} />);
    await click(button(mounted.container, "Get coach debrief")!);
    expect(status(mounted.container)).toBeNull();
  });

  it("keeps each new debrief with the round and says so", async () => {
    const saveDebrief = vi.fn(async () => true);
    mounted = await mount(
      <RoundCoachDebrief input={input} requestDebrief={async () => "Do X."} saveDebrief={saveDebrief} />,
    );
    await click(button(mounted.container, "Fact-Checker")!);
    await click(button(mounted.container, "Get coach debrief")!);
    await flush(async () => {});

    expect(saveDebrief).toHaveBeenCalledWith({ personaId: "fact-checker", text: "Do X." });
    expect(status(mounted.container)).toBe("Saved with this round in Debate History.");
  });

  it("tells a signed-out player the debrief wasn't kept", async () => {
    mounted = await mount(
      <RoundCoachDebrief input={input} requestDebrief={async () => "Do X."} saveDebrief={async () => false} />,
    );
    await click(button(mounted.container, "Get coach debrief")!);
    await flush(async () => {});
    expect(status(mounted.container)).toBe("Not saved — sign in to keep debriefs with your rounds.");
  });

  it("reports a failed save but keeps the debrief on screen", async () => {
    const saveDebrief = vi.fn(async () => {
      throw new Error("offline");
    });
    mounted = await mount(
      <RoundCoachDebrief input={input} requestDebrief={async () => "Do X."} saveDebrief={saveDebrief} />,
    );
    await click(button(mounted.container, "Get coach debrief")!);
    await flush(async () => {});
    expect(status(mounted.container)).toBe("Couldn't save this debrief to Debate History.");
    expect(mounted.container.querySelector("[data-testid=round-coach-debrief]")?.textContent).toBe("Do X.");
  });

  it("doesn't save when the debrief request fails", async () => {
    const saveDebrief = vi.fn(async () => true);
    mounted = await mount(
      <RoundCoachDebrief
        input={input}
        requestDebrief={async () => {
          throw new Error("nope");
        }}
        saveDebrief={saveDebrief}
      />,
    );
    await click(button(mounted.container, "Get coach debrief")!);
    expect(saveDebrief).not.toHaveBeenCalled();
    expect(status(mounted.container)).toBeNull();
  });

  it("shows the newest debrief's save status, not a slower older save's", async () => {
    let resolveFirst: (saved: boolean) => void = () => {};
    const saveDebrief = vi
      .fn<(debrief: { personaId: string; text: string }) => Promise<boolean>>()
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => (resolveFirst = resolve)))
      .mockImplementationOnce(async () => {
        throw new Error("offline");
      });
    mounted = await mount(
      <RoundCoachDebrief input={input} requestDebrief={async () => "Do X."} saveDebrief={saveDebrief} />,
    );
    await click(button(mounted.container, "Get coach debrief")!);
    await click(button(mounted.container, "Get a new debrief")!);
    await flush(async () => {});
    expect(status(mounted.container)).toBe("Couldn't save this debrief to Debate History.");

    await flush(() => resolveFirst(true));
    expect(status(mounted.container)).toBe("Couldn't save this debrief to Debate History.");
  });
});

describe("JudgmentPopup Coach debrief", () => {
  it("appears only after the decision is revealed, grounded in the transcript", async () => {
    const requestDebrief = vi.fn(async () => "Debrief.");
    mounted = await mount(
      <JudgmentPopup
        judgment={judgment}
        botName="Rookie Rick"
        userStance="For"
        topic="Resolved: test."
        transcript={transcript}
        requestDebrief={requestDebrief}
        onClose={() => {}}
      />,
    );
    expect(mounted.container.textContent).not.toContain("Coach debrief");

    await click(button(mounted.container, "Reveal Decision")!);
    expect(mounted.container.textContent).toContain("Coach debrief");
    await click(button(mounted.container, "Get coach debrief")!);
    expect(requestDebrief).toHaveBeenCalledWith(input, expect.anything());
  });

  it("passes the host's saveDebrief through to the debrief", async () => {
    const saveDebrief = vi.fn(async () => true);
    mounted = await mount(
      <JudgmentPopup
        judgment={judgment}
        requestDebrief={async () => "Debrief."}
        saveDebrief={saveDebrief}
        onClose={() => {}}
      />,
    );
    await click(button(mounted.container, "Reveal Decision")!);
    await click(button(mounted.container, "Get coach debrief")!);
    await flush(async () => {});
    expect(saveDebrief).toHaveBeenCalledWith({ personaId: "standard", text: "Debrief." });
  });

  it("is not offered for the for/against rubric", async () => {
    const strong = { score: 9, reason: "Good." };
    const forAgainst: JudgmentDataForAgainst = {
      opening_statement: { for: strong, against: strong },
      cross_examination_questions: { for: strong, against: strong },
      cross_examination_answers: { for: strong, against: strong },
      closing: { for: strong, against: strong },
      total: { for: 36, against: 36 },
      verdict: { winner: "For", reason: "r", congratulations: "c", opponent_analysis: "o" },
    };
    mounted = await mount(<JudgmentPopup judgment={forAgainst} onClose={() => {}} />);
    await click(button(mounted.container, "Reveal Decision")!);
    expect(mounted.container.textContent).not.toContain("Coach debrief");
  });
});
