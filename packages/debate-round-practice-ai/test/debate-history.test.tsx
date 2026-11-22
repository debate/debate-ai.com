// @vitest-environment jsdom
/** @fileoverview Debate History: the `?debate=` deep link and the fallacy-hints summary. */
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type Mounted } from "./helpers/mount";

const client = vi.hoisted(() => ({ listDebateHistory: vi.fn() }));
vi.mock("../src/client", () => ({ listDebateHistory: (...args: unknown[]) => client.listDebateHistory(...args) }));

const { DebateHistory } = await import("../src/ui/DebateHistory");

const record = (id: string, topic: string) => ({
  id,
  topic,
  botName: "Bot",
  outcome: "",
  createdAt: 1_700_000_000,
  history: [{ sender: "Bot", text: `opening for ${topic}` }],
});

let mounted: Mounted | null = null;
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

describe("DebateHistory deep link", () => {
  it("expands only the linked round", async () => {
    client.listDebateHistory.mockResolvedValue([record("1", "Tariffs"), record("2", "Nukes")]);
    mounted = await mount(<DebateHistory onBack={() => {}} initialExpandedId="2" />);
    const text = mounted.container.textContent ?? "";
    expect(text).toContain("opening for Nukes");
    expect(text).not.toContain("opening for Tariffs");
  });

  it("stays collapsed without a link", async () => {
    client.listDebateHistory.mockResolvedValue([record("1", "Tariffs")]);
    mounted = await mount(<DebateHistory onBack={() => {}} />);
    expect(mounted.container.textContent).not.toContain("opening for Tariffs");
  });
});

describe("DebateHistory fallacy hints summary", () => {
  const summary = (m: Mounted) => m.container.querySelector('[data-testid="fallacy-frequency-summary"]')

  it("counts the user's speeches only, across every loaded round", async () => {
    client.listDebateHistory.mockResolvedValue([
      {
        ...record("1", "Tariffs"),
        history: [
          { sender: "Bot", text: "You are a liar. They are biased." },
          { sender: "User", text: "Either we act or we fail.", phase: "Opening Statements" },
        ],
      },
      { ...record("2", "Nukes"), history: [{ sender: "User", text: "Deterrence holds." }] },
    ]);
    mounted = await mount(<DebateHistory onBack={() => {}} />);
    expect(mounted.container.textContent).toContain("Fallacy hints across your speeches");
    const text = summary(mounted)?.textContent ?? "";
    expect(text).toContain("1 hint");
    expect(text).toContain("2 speeches");
    expect(text).toContain("Most common: False dichotomy");
    expect(text).toContain("Ad hominem: 0");
    expect(text).toContain("Tariffs — Opening Statements (1)");
  });

  it("explains when no round has a user speech yet", async () => {
    client.listDebateHistory.mockResolvedValue([record("1", "Tariffs")]);
    mounted = await mount(<DebateHistory onBack={() => {}} />);
    expect(summary(mounted)?.textContent).toContain("None of these rounds has a speech of yours yet");
  });

  it("is not shown with no debates or on a load error", async () => {
    client.listDebateHistory.mockResolvedValue([]);
    mounted = await mount(<DebateHistory onBack={() => {}} />);
    expect(mounted.container.textContent).not.toContain("Fallacy hints across your speeches");
    await mounted.unmount();

    client.listDebateHistory.mockRejectedValue(new Error("Not signed in"));
    mounted = await mount(<DebateHistory onBack={() => {}} />);
    expect(mounted.container.textContent).toContain("Not signed in");
    expect(mounted.container.textContent).not.toContain("Fallacy hints across your speeches");
  });
});

describe("DebateHistory saved Coach debrief", () => {
  const debriefOf = (m: Mounted) => m.container.querySelector('[data-testid="debate-history-debrief"]');

  it("shows an expanded round's saved debrief with its style", async () => {
    client.listDebateHistory.mockResolvedValue([
      { ...record("1", "Tariffs"), debrief: { personaId: "socratic", text: "Why did your link hold?", savedAt: 1 } },
    ]);
    mounted = await mount(<DebateHistory onBack={() => {}} initialExpandedId="1" />);
    const text = debriefOf(mounted)?.textContent ?? "";
    expect(text).toContain("Coach debrief");
    expect(text).toContain("Socratic coach");
    expect(text).toContain("Why did your link hold?");
  });

  it("shows no style badge for a Standard or unknown style", async () => {
    client.listDebateHistory.mockResolvedValue([
      { ...record("1", "Tariffs"), debrief: { personaId: "future-style", text: "Weigh earlier.", savedAt: 1 } },
    ]);
    mounted = await mount(<DebateHistory onBack={() => {}} initialExpandedId="1" />);
    expect(debriefOf(mounted)?.textContent).toBe("Coach debriefWeigh earlier.");
  });

  it("hides the debrief while the round is collapsed, and shows none for a round without one", async () => {
    client.listDebateHistory.mockResolvedValue([
      { ...record("1", "Tariffs"), debrief: { personaId: "standard", text: "Weigh earlier.", savedAt: 1 } },
      record("2", "Nukes"),
    ]);
    mounted = await mount(<DebateHistory onBack={() => {}} initialExpandedId="2" />);
    expect(debriefOf(mounted)).toBeNull();
    expect(mounted.container.textContent).not.toContain("Weigh earlier.");
  });
});

describe("DebateHistory Judge feedback style", () => {
  const styleOf = (m: Mounted) => m.container.querySelector('[data-testid="debate-history-judge-style"]');

  it("says which style an expanded round was judged in", async () => {
    client.listDebateHistory.mockResolvedValue([{ ...record("1", "Tariffs"), judgeFeedbackStyle: "devils-advocate" }]);
    mounted = await mount(<DebateHistory onBack={() => {}} initialExpandedId="1" />);
    expect(styleOf(mounted)?.textContent).toBe("Judged in the Devil's Advocate feedback style");
  });

  it("names an unknown stored style as Standard, and shows nothing for a round without one or while collapsed", async () => {
    client.listDebateHistory.mockResolvedValue([
      { ...record("1", "Tariffs"), judgeFeedbackStyle: "future-style" },
      record("2", "Nukes"),
    ]);
    mounted = await mount(<DebateHistory onBack={() => {}} initialExpandedId="1" />);
    expect(styleOf(mounted)?.textContent).toBe("Judged in the Standard feedback style");
    await mounted.unmount();

    mounted = await mount(<DebateHistory onBack={() => {}} initialExpandedId="2" />);
    expect(styleOf(mounted)).toBeNull();
  });
});

describe("DebateHistory saved round plan", () => {
  const view = (m: Mounted) => m.container.querySelector('[data-testid="round-plan-view"]')

  it("shows the arguments each side chose on an expanded round", async () => {
    client.listDebateHistory.mockResolvedValue([
      {
        ...record("1", "Tariffs"),
        botName: "Yoda",
        plan: {
          evidence: "without",
          affPlan: "Single payer.",
          userArguments: [{ title: "Uninsured Deaths advantage", kind: "advantage" }],
          botArguments: [],
        },
      },
    ]);
    mounted = await mount(<DebateHistory onBack={() => {}} initialExpandedId="1" />);
    const section = view(mounted);
    expect(section?.getAttribute("aria-label")).toBe("Arguments chosen");
    const text = section?.textContent ?? "";
    expect(text).toContain("Round without evidence · Aff plan: Single payer.");
    expect(text).toContain("Uninsured Deaths advantage");
    expect(text).toContain("Yoda's arguments");
    expect(text).toContain("Free choice.");
  });

  it("shows nothing for a round without a saved plan, or while collapsed", async () => {
    client.listDebateHistory.mockResolvedValue([
      record("1", "Tariffs"),
      { ...record("2", "Nukes"), plan: { evidence: "with", userArguments: [], botArguments: [] } },
    ]);
    mounted = await mount(<DebateHistory onBack={() => {}} initialExpandedId="1" />);
    expect(view(mounted)).toBeNull();
  });
});

describe("DebateHistory search and result filter", () => {
  const verdict = (winner: string) => JSON.stringify({ verdict: { winner, reason: "" } });
  const rows = () => [
    { ...record("1", "Tariffs on steel"), botName: "Kant", outcome: verdict("User") },
    { ...record("2", "Nuclear deterrence"), botName: "Machiavelli", outcome: verdict("Bot") },
    { ...record("3", "Tariffs on cars"), botName: "Socrates", outcome: "User conceded" },
  ];
  const topics = (m: Mounted) =>
    [...m.container.querySelectorAll("button[aria-expanded] p.font-medium")].map((p) => p.textContent);
  const count = (m: Mounted) => m.container.querySelector('[data-testid="debate-history-count"]')?.textContent;

  async function typeQuery(m: Mounted, value: string) {
    const input = m.container.querySelector('input[type="search"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function pickResult(m: Mounted, value: string) {
    const select = m.container.querySelector("select") as HTMLSelectElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(select, value);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  it("shows the round count and the record", async () => {
    client.listDebateHistory.mockResolvedValue(rows());
    mounted = await mount(<DebateHistory onBack={() => {}} />);
    expect(count(mounted)).toBe("3 rounds · Record: 1–1 · 1 conceded");
    expect(topics(mounted)).toEqual(["Tariffs on steel", "Nuclear deterrence", "Tariffs on cars"]);
  });

  it("searches by topic or opponent and says how many match", async () => {
    client.listDebateHistory.mockResolvedValue(rows());
    mounted = await mount(<DebateHistory onBack={() => {}} />);
    await typeQuery(mounted, "tariffs");
    expect(topics(mounted)).toEqual(["Tariffs on steel", "Tariffs on cars"]);
    expect(count(mounted)).toContain("2 of 3 rounds");
    await typeQuery(mounted, "machiavelli");
    expect(topics(mounted)).toEqual(["Nuclear deterrence"]);
  });

  it("filters by result, explains an empty match and clears both", async () => {
    client.listDebateHistory.mockResolvedValue(rows());
    mounted = await mount(<DebateHistory onBack={() => {}} />);
    await pickResult(mounted, "conceded");
    expect(topics(mounted)).toEqual(["Tariffs on cars"]);

    await typeQuery(mounted, "nuclear");
    expect(topics(mounted)).toEqual([]);
    expect(mounted.container.textContent).toContain("No rounds match these filters.");
    expect(mounted.container.textContent).not.toContain("Fallacy hints across your speeches");

    const clear = [...mounted.container.querySelectorAll("button")].find((b) => b.textContent === "Clear")!;
    await act(async () => clear.click());
    expect(topics(mounted)).toHaveLength(3);
    expect((mounted.container.querySelector('input[type="search"]') as HTMLInputElement).value).toBe("");
    expect((mounted.container.querySelector("select") as HTMLSelectElement).value).toBe("all");
  });

  it("hides the filters when there are no rounds", async () => {
    client.listDebateHistory.mockResolvedValue([]);
    mounted = await mount(<DebateHistory onBack={() => {}} />);
    expect(mounted.container.querySelector('[data-testid="debate-history-filters"]')).toBeNull();
  });
});
