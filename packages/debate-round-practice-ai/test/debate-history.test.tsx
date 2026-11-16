// @vitest-environment jsdom
/** @fileoverview Debate History: the `?debate=` deep link and the fallacy-hints summary. */
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
