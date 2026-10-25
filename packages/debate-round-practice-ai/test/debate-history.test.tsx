// @vitest-environment jsdom
/**
 * @fileoverview The debate history list: the `initialExpandedId` deep link
 * (from Settings → Saved data) opens one saved round's transcript on arrival.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { click, mount, type Mounted } from "./helpers/mount";

const debate = (id: string, topic: string, text: string) => ({
  id,
  email: "a@example.com",
  botName: "Yoda",
  botLevel: "Legends",
  topic,
  stance: "for",
  history: [{ sender: "You", text }],
  phaseTimings: [],
  createdAt: 1,
});

const client = vi.hoisted(() => ({ listDebateHistory: vi.fn() }));
vi.mock("../src/client", () => client);

const { DebateHistory } = await import("../src/ui/DebateHistory");

let mounted: Mounted | null = null;
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

describe("DebateHistory", () => {
  it("starts collapsed without a deep link", async () => {
    client.listDebateHistory.mockResolvedValue([debate("1", "UBI", "first"), debate("2", "NATO", "second")]);
    mounted = await mount(<DebateHistory onBack={() => {}} />);
    expect(mounted.container.textContent).not.toContain("first");
    expect(mounted.container.textContent).not.toContain("second");
  });

  it("expands only the deep-linked round, and it can be collapsed again", async () => {
    client.listDebateHistory.mockResolvedValue([debate("1", "UBI", "first"), debate("2", "NATO", "second")]);
    mounted = await mount(<DebateHistory onBack={() => {}} initialExpandedId="2" />);
    expect(mounted.container.textContent).toContain("second");
    expect(mounted.container.textContent).not.toContain("first");
    await click(mounted.container.querySelector('button[aria-expanded="true"]')!);
    expect(mounted.container.textContent).not.toContain("second");
  });

  it("ignores a deep link to a round that isn't in the list", async () => {
    client.listDebateHistory.mockResolvedValue([debate("1", "UBI", "first")]);
    mounted = await mount(<DebateHistory onBack={() => {}} initialExpandedId="999" />);
    expect(mounted.container.textContent).toContain("UBI");
    expect(mounted.container.textContent).not.toContain("first");
  });
});
