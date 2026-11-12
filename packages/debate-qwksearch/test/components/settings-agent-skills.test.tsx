/** @vitest-environment jsdom */
/**
 * @fileoverview Agent Skills settings: every skill defaults to on, the
 * server's saved flags override that, and a toggle is saved (or reverted
 * with an error toast when the save fails).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import AgentSkills from "../../src/components/Settings/Sections/AgentSkills";
import { bodyText, cleanup, clickAsync, flush, installDomShims, mockFetch, mount } from "../helpers/dom";

beforeAll(installDomShims);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const toggles = (title: string) => [...document.querySelectorAll<HTMLButtonElement>(`button[title="${title}"]`)];

describe("Agent Skills settings", () => {
  it("shows a spinner until the saved flags load", async () => {
    mockFetch([{ match: "/api/user/agent-skills", respond: [{ id: "a", skillId: "citations", enabled: false }] }]);
    mount(<AgentSkills />);
    expect(document.querySelector(".animate-spin")).not.toBeNull();
    await flush();
    expect(bodyText()).toContain("Web Research");
    expect(bodyText()).toContain("Source Management");
    expect(toggles("Disable skill")).toHaveLength(3);
    expect(toggles("Enable skill")).toHaveLength(1);
  });

  it("saves a toggle", async () => {
    const { calls } = mockFetch([
      { method: "GET", match: "/api/user/agent-skills", respond: [] },
      { method: "POST", match: "/api/user/agent-skills", respond: {} },
    ]);
    mount(<AgentSkills />);
    await flush();
    await clickAsync(toggles("Disable skill")[0]);
    expect(calls.at(-1)).toMatchObject({ method: "POST", body: { skillId: "web-research", enabled: false } });
    expect(toast.success).toHaveBeenCalledWith("Skill disabled");
    expect(toggles("Enable skill")).toHaveLength(1);
  });

  it("keeps the old state when the save fails", async () => {
    mockFetch([
      { method: "GET", match: "/api/user/agent-skills", respond: [] },
      { method: "POST", match: "/api/user/agent-skills", respond: {}, status: 500 },
    ]);
    mount(<AgentSkills />);
    await flush();
    await clickAsync(toggles("Disable skill")[0]);
    expect(toast.error).toHaveBeenCalledWith("Failed to update skill preference");
    expect(toggles("Enable skill")).toHaveLength(0);
  });

  it("still renders when the flags request throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    mount(<AgentSkills />);
    await flush();
    expect(bodyText()).toContain("Knowledge Synthesis");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
