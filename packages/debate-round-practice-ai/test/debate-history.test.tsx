// @vitest-environment jsdom
/**
 * @fileoverview Debate History: the list, and opening one saved round
 * expanded when the host passes `initialExpandedId` (a `?debate=<id>` link).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type Mounted } from "./helpers/mount";

const client = vi.hoisted(() => ({ listDebateHistory: vi.fn() }));
vi.mock("../src/client", () => client);

const { DebateHistory } = await import("../src/ui/DebateHistory");

const record = (id: string, topic: string) => ({
  id,
  topic,
  botName: "Bot",
  outcome: "",
  createdAt: 1_700_000_000,
  history: [{ sender: "User", text: `opening on ${topic}` }],
});

let mounted: Mounted | null = null;
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

describe("DebateHistory", () => {
  it("lists rounds collapsed by default", async () => {
    client.listDebateHistory.mockResolvedValue([record("1", "UBI"), record("2", "Nukes")]);
    mounted = await mount(<DebateHistory onBack={() => {}} />);
    expect(mounted.container.textContent).toContain("UBI");
    expect(mounted.container.textContent).not.toContain("opening on UBI");
  });

  it("opens the linked round expanded and leaves the others collapsed", async () => {
    client.listDebateHistory.mockResolvedValue([record("1", "UBI"), record("2", "Nukes")]);
    mounted = await mount(<DebateHistory onBack={() => {}} initialExpandedId="2" />);
    expect(mounted.container.textContent).toContain("opening on Nukes");
    expect(mounted.container.textContent).not.toContain("opening on UBI");
  });

  it("ignores a link to a round that isn't in the list", async () => {
    client.listDebateHistory.mockResolvedValue([record("1", "UBI")]);
    mounted = await mount(<DebateHistory onBack={() => {}} initialExpandedId="99" />);
    expect(mounted.container.textContent).toContain("UBI");
    expect(mounted.container.textContent).not.toContain("opening on UBI");
  });
});
