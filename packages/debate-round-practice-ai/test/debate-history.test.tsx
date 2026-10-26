// @vitest-environment jsdom
/** @fileoverview Debate History opens the round named by a `?debate=` deep link. */
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
