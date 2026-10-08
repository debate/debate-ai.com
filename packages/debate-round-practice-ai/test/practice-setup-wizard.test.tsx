// @vitest-environment jsdom
/**
 * @fileoverview The merged Practice vs AI page's setup: difficulty, topic,
 * opponent, then the opponent's prep brief and starting the round with it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_BOTS, DEFAULT_PHASE_TIMINGS } from "../src/ui/bots";
import { click, flush, mount, type, type Mounted } from "./helpers/mount";

const client = vi.hoisted(() => ({
  createDebate: vi.fn(),
  findPrepEvidence: vi.fn(),
  prepareCase: vi.fn(),
}));
vi.mock("../src/client", () => client);

const { PracticeSetupWizard } = await import("../src/ui/PracticeSetupWizard");

const MEDIUM_BOT = ALL_BOTS.find((b) => b.level === "Medium")!;
const cards = [{ tag: "Regulation curbs misinformation", cite: "Smith 24" }];
const cases = [{ title: "Michigan AB Aff", owner: "Michigan AB" }];
const brief = {
  summary: "Clash is over speech versus harm.",
  yourArguments: [{ claim: "Misinformation harms democracy", warrant: "", cardIndexes: [0] }],
  opponentArguments: [{ claim: "Speech is chilled", warrant: "", cardIndexes: [] }],
  generated: true,
};

let mounted: Mounted | null = null;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  client.createDebate.mockResolvedValue({ debateId: "debate-7" });
  client.findPrepEvidence.mockResolvedValue({ cards, cases });
  client.prepareCase.mockResolvedValue(brief);
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

const button = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("button")].find((node) => node.textContent?.includes(text))!;

describe("PracticeSetupWizard", () => {
  it("walks difficulty → topic → opponent → prep, then starts the round with the brief", async () => {
    const onStart = vi.fn();
    mounted = await mount(<PracticeSetupWizard onStart={onStart} apiBaseUrl="/api/test" />);
    const { container } = mounted;

    expect(button(container, "Next").disabled).toBe(true);
    await click(button(container, "Medium"));
    await click(button(container, "Next"));

    expect(button(container, "Next").disabled).toBe(true);
    await type(container.querySelector<HTMLInputElement>("#practice-topic")!, "Should social media be regulated?");
    await click(button(container, "Against"));
    await click(button(container, "Next"));

    // Only the chosen difficulty's opponents are offered.
    expect(container.textContent).toContain(MEDIUM_BOT.name);
    expect(container.textContent).not.toContain(ALL_BOTS.find((b) => b.level === "Legends")!.name);
    await click(button(container, MEDIUM_BOT.name));
    await click(button(container, "Prep my case"));
    await flush(async () => {});

    expect(client.findPrepEvidence).toHaveBeenCalledWith("Should social media be regulated?", expect.anything());
    expect(client.prepareCase).toHaveBeenCalledWith(
      expect.objectContaining({ botName: MEDIUM_BOT.name, stance: "against", cards, cases }),
      expect.objectContaining({ baseUrl: "/api/test" }),
    );
    expect(container.textContent).toContain("Clash is over speech versus harm.");
    expect(container.textContent).toContain("Your case (Against)");
    expect(container.textContent).toContain("Regulation curbs misinformation — Smith 24");
    expect(container.textContent).toContain("Michigan AB Aff");

    await click(button(container, "Start round"));
    await flush(async () => {});
    expect(onStart).toHaveBeenCalledWith({
      debateId: "debate-7",
      botName: MEDIUM_BOT.name,
      botLevel: "Medium",
      topic: "Should social media be regulated?",
      stance: "against",
      phaseTimings: DEFAULT_PHASE_TIMINGS,
      brief,
      cards,
      cases,
    });
  });

  it("offers a retry when prep fails", async () => {
    client.prepareCase.mockRejectedValueOnce(new Error("Failed to prepare the case"));
    localStorage.setItem(
      "practiceSetupWizard",
      JSON.stringify({ level: "Medium", topic: "A topic", stance: "for", botName: MEDIUM_BOT.name }),
    );
    mounted = await mount(<PracticeSetupWizard onStart={() => {}} />);
    const { container } = mounted;
    // The draft restored every choice, so Next is live on each step.
    await click(button(container, "Next"));
    await click(button(container, "Next"));
    await click(button(container, "Prep my case"));
    await flush(async () => {});
    expect(container.textContent).toContain("Failed to prepare the case");

    await click(button(container, "Try prep again"));
    await flush(async () => {});
    expect(container.textContent).toContain("Clash is over speech versus harm.");
  });
});
