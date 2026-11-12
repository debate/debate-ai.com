/** @vitest-environment jsdom */
/**
 * @fileoverview Skills & Memory settings: skills load their enabled state
 * from the server and toggle through it, memories load (or fall back to the
 * demo set), filter by text and type, expand, record usage and delete.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import SkillsAndMemory from "../../src/components/Settings/Sections/SkillsAndMemory";
import { bodyText, button, byText, change, cleanup, click, clickAsync, flush, installDomShims, mockFetch, mount } from "../helpers/dom";

beforeAll(installDomShims);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const memories = [
  {
    id: "m1",
    name: "Prefers PRs",
    type: "feedback",
    description: "Open pull requests",
    content: "Always open a PR.",
    lastUpdated: "2026-01-01T00:00:00Z",
    tags: ["git"],
    importance: 9,
    accessCount: 2,
  },
  {
    id: "m2",
    name: "Team",
    type: "user",
    description: "Debate coach",
    content: "Coaches PF.",
    lastUpdated: "2026-01-02T00:00:00Z",
    importance: 3,
  },
];

function serve(opts: { memories?: boolean; toggleOk?: boolean; deleteOk?: boolean } = {}) {
  return mockFetch([
    { method: "GET", match: "/api/user/enabled-skills", respond: [{ id: "web-search", enabled: false }] },
    { method: "POST", match: "/api/user/enabled-skills", respond: {}, status: opts.toggleOk === false ? 500 : 200 },
    ...(opts.memories === false ? [] : [{ method: "GET", match: "/api/user/memories", respond: memories }]),
    { method: "POST", match: /\/usage$/, respond: {} },
    { method: "DELETE", match: "/api/user/memories/", respond: {}, status: opts.deleteOk === false ? 500 : 200 },
  ]);
}

describe("Skills & Memory settings", () => {
  it("loads skills with the server's enabled flags and toggles one", async () => {
    const { calls } = serve();
    mount(<SkillsAndMemory />);
    await flush();
    // 12 skills, web-search disabled.
    expect(bodyText()).toContain("11/12");
    click(byText("Information Retrieval", "button"));
    expect(bodyText()).toContain("Web Search");
    const toggle = document.querySelector<HTMLButtonElement>('button[title="Enable skill"]')!;
    await clickAsync(toggle);
    expect(calls.at(-1)).toMatchObject({ method: "POST", body: { skillId: "web-search", enabled: true } });
    expect(toast.success).toHaveBeenCalledWith("Skill enabled");
    expect(bodyText()).toContain("12/12");
    // Collapses again.
    click(byText("Information Retrieval", "button"));
    expect(bodyText()).not.toContain("Search across the internet");
  });

  it("reports a failed skill toggle without flipping it", async () => {
    serve({ toggleOk: false });
    mount(<SkillsAndMemory />);
    await flush();
    click(byText("Code & Development", "button"));
    await clickAsync(document.querySelector<HTMLButtonElement>('button[title="Disable skill"]')!);
    expect(toast.error).toHaveBeenCalledWith("Failed to update skill");
    expect(bodyText()).toContain("11/12");
  });

  it("lists, filters, expands, uses and deletes memories", async () => {
    const { calls } = serve();
    mount(<SkillsAndMemory />);
    await flush();
    expect(bodyText()).toContain("2 total memories stored");
    expect(bodyText()).toContain("★");

    change(document.querySelector('input[placeholder="Search memories..."]')!, "git");
    expect(bodyText()).toContain("1 total memories stored");
    change(document.querySelector('input[placeholder="Search memories..."]')!, "zzz");
    expect(bodyText()).toContain("No memories match your search.");
    change(document.querySelector('input[placeholder="Search memories..."]')!, "");

    click(button("User Profile"));
    expect(bodyText()).toContain("Debate coach");
    expect(bodyText()).not.toContain("Open pull requests");
    click(button("All Types"));

    click(byText("Prefers PRs", "button"));
    expect(bodyText()).toContain("Always open a PR.");
    expect(bodyText()).toContain("9/10");
    expect(bodyText()).toContain("2 times");
    await clickAsync(button("Use Now"));
    expect(calls.some((c) => c.url.endsWith("/api/user/memories/m1/usage"))).toBe(true);
    expect(bodyText()).toContain("3 times");
    click(button("Edit"));

    await clickAsync(button("Delete"));
    expect(toast.success).toHaveBeenCalledWith("Memory deleted");
    expect(bodyText()).not.toContain("Prefers PRs");
  });

  it("keeps a memory whose delete fails", async () => {
    serve({ deleteOk: false });
    mount(<SkillsAndMemory />);
    await flush();
    click(byText("Team", "button"));
    expect(bodyText()).toContain("0 times");
    await clickAsync(button("Delete"));
    expect(toast.error).toHaveBeenCalledWith("Failed to delete memory");
    expect(bodyText()).toContain("Debate coach");
  });

  it("falls back to the demo memories when the memory API is missing", async () => {
    serve({ memories: false });
    mount(<SkillsAndMemory />);
    await flush();
    expect(bodyText()).toContain("4 total memories stored");
    expect(bodyText()).toContain("Kokoro TTS Integration");
  });

  it("shows the empty state when there are no memories", async () => {
    mockFetch([{ match: "/api/user/memories", respond: [] }]);
    mount(<SkillsAndMemory />);
    await flush();
    expect(bodyText()).toContain("No memories saved yet.");
  });
});
