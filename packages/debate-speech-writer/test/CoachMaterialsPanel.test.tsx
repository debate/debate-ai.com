// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `CoachMaterialsPanel` — the add/edit form,
 * document upload, dictation, the review queue, search, version history and
 * restore, and "Ask the coach" (preview + answer + conversation history).
 * Runs against the real localStorage stores; `fetch` is stubbed so the
 * account sync is signed out unless a test says otherwise and the coach AI
 * endpoint returns a canned answer. The panel module is re-imported per
 * test so the sync hook's module-level merge state starts fresh.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";

import { buttonByText, buttonsByText, click, flush, mount, query, type } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";
import type { CoachMaterial } from "../src/coach/team-coach-materials";

type FetchMock = ReturnType<typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>>;

let view: Mounted;
let fetchMock: FetchMock;
let coachReply: () => Response;

const text = () => view.container.textContent ?? "";
const input = (id: string) => query<HTMLInputElement>(view.container, `#${id}`);

function material(id: string, overrides: Partial<CoachMaterial> = {}): CoachMaterial {
  return {
    id,
    kind: "lecture_transcript",
    title: `Title ${id}`,
    tags: [],
    text: `Topicality lecture text for ${id}`,
    ...overrides,
  };
}

async function load({ signedIn = false }: { signedIn?: boolean } = {}) {
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/reason-ai") return coachReply();
    if (init?.method) return new Response("{}");
    return signedIn ? new Response("[]") : new Response(null, { status: 401 });
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.resetModules();
  const { CoachMaterialsPanel } = await import("../src/panels/CoachMaterialsPanel");
  const materials = await import("../src/state/coachMaterials");
  const versions = await import("../src/state/coachMaterialVersions");
  const conversation = await import("../src/state/coachConversation");
  return { CoachMaterialsPanel, materials, versions, conversation };
}

beforeEach(() => {
  localStorage.clear();
  coachReply = () => new Response(JSON.stringify({ text: "Answer from your lecture." }));
});

afterEach(async () => {
  await view?.unmount();
  vi.unstubAllGlobals();
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  localStorage.clear();
});

describe("CoachMaterialsPanel form", () => {
  it("shows the signed-out empty state and validates required fields", async () => {
    const { CoachMaterialsPanel } = await load();
    view = await mount(createElement(CoachMaterialsPanel));
    await flush();

    expect(text()).toContain("Sign in to sync materials");
    expect(text()).toContain("No coach materials uploaded yet.");
    expect(text()).toContain("Microphone dictation isn't supported in this browser.");

    await click(buttonByText(view.container, "Add material"));
    expect(text()).toContain("Title and material text are required.");
  });

  it("adds a pending material with topic and tags, then approves it from the review queue", async () => {
    const { CoachMaterialsPanel, materials } = await load();
    view = await mount(createElement(CoachMaterialsPanel));

    await type(input("coach-material-title"), " Topicality Basics ");
    await type(input("coach-material-topic"), "T");
    await type(input("coach-material-tags"), "theory, , case");
    await type(query<HTMLTextAreaElement>(view.container, "#coach-material-text"), "How to answer T.");
    await click(buttonByText(view.container, "Add material"));

    const [saved] = materials.listCoachMaterials();
    expect(saved).toMatchObject({
      kind: "lecture_transcript",
      title: "Topicality Basics",
      topic: "T",
      tags: ["theory", "case"],
      text: "How to answer T.",
      status: "pending",
    });
    expect(input("coach-material-title").value).toBe("");
    expect(text()).toContain("Pending review (1)");
    expect(text()).toContain("Lecture Transcript");

    await click(buttonByText(view.container, "Approve"));
    expect(text()).toContain("Enter your name to review materials.");

    await type(input("coach-material-reviewer"), "Coach Kim");
    await click(buttonByText(view.container, "Approve"));
    expect(materials.getCoachMaterial(saved.id)).toMatchObject({ status: "approved", reviewedBy: "Coach Kim" });
    expect(text()).not.toContain("Pending review (");
    expect(text()).toContain("Approved");
  });

  it("rejects a pending material with an optional reason and shows it on the material", async () => {
    const { CoachMaterialsPanel, materials } = await load();
    materials.saveCoachMaterial(material("m1", { status: "pending" }));
    view = await mount(createElement(CoachMaterialsPanel));

    await click(buttonByText(view.container, "Reject"));
    expect(text()).toContain("Enter your name to review materials.");

    await type(input("coach-material-reviewer"), "Coach Kim");
    await type(query<HTMLInputElement>(view.container, "input[placeholder='Rejection reason (optional)']"), " Off topic ");
    await click(buttonByText(view.container, "Reject"));
    expect(materials.getCoachMaterial("m1")).toMatchObject({ status: "rejected", reviewNote: "Off topic" });
    expect(text()).toContain("Rejected: Off topic");
  });

  it("edits a material, keeps a version, and restores the earlier version", async () => {
    const { CoachMaterialsPanel, materials, versions } = await load();
    materials.saveCoachMaterial(material("m1", { topic: "T", tags: ["theory"] }));
    view = await mount(createElement(CoachMaterialsPanel));

    await click(buttonByText(view.container, "History"));
    expect(text()).toContain("No prior versions");
    await click(buttonByText(view.container, "Hide history"));
    expect(text()).not.toContain("No prior versions");

    await click(buttonByText(view.container, "Edit"));
    expect(input("coach-material-title").value).toBe("Title m1");
    expect(input("coach-material-tags").value).toBe("theory");
    await click(buttonByText(view.container, "Cancel edit"));
    expect(input("coach-material-title").value).toBe("");

    await click(buttonByText(view.container, "History"));
    await click(buttonByText(view.container, "Edit"));
    await type(input("coach-material-title"), "Renamed");
    await click(buttonByText(view.container, "Save changes"));

    expect(materials.getCoachMaterial("m1")?.title).toBe("Renamed");
    expect(versions.listVersionsForMaterial("m1")).toHaveLength(1);
    // The open history refreshed with the new snapshot.
    expect(text()).toContain("Restore this version");

    await click(buttonByText(view.container, "Edit"));
    await click(buttonByText(view.container, "Restore this version"));
    expect(materials.getCoachMaterial("m1")?.title).toBe("Title m1");
    // Restoring the material being edited cancels the edit.
    expect(buttonsByText(view.container, "Save changes")).toHaveLength(0);
  });

  it("deletes a material that is being edited with its history open", async () => {
    const { CoachMaterialsPanel, materials } = await load();
    materials.saveCoachMaterial(material("m1"));
    view = await mount(createElement(CoachMaterialsPanel));

    await click(buttonByText(view.container, "History"));
    await click(buttonByText(view.container, "Edit"));
    await click(buttonByText(view.container, "Delete"));
    expect(materials.listCoachMaterials()).toEqual([]);
    expect(text()).toContain("No coach materials uploaded yet.");
    expect(buttonsByText(view.container, "Add material")).toHaveLength(1);
  });

  it("filters by search query and clears filters", async () => {
    const { CoachMaterialsPanel, materials } = await load();
    materials.saveCoachMaterial(material("a", { title: "Kritik answers", text: "Framework first" }));
    materials.saveCoachMaterial(material("b", { title: "Plan texts", text: "Solvency advocates" }));
    view = await mount(createElement(CoachMaterialsPanel));

    await type(input("coach-material-search"), "kritik");
    expect(text()).toContain("Kritik answers");
    expect(text()).not.toContain("Plan texts");

    await type(input("coach-material-search"), "zzz-no-match");
    expect(text()).toContain("No materials match this search/tag filter.");

    await click(buttonByText(view.container, "Clear filters"));
    expect(text()).toContain("Plan texts");
    expect(buttonsByText(view.container, "Clear filters")).toHaveLength(0);
  });
});

describe("CoachMaterialsPanel upload and dictation", () => {
  async function upload(file: File) {
    const fileInput = query<HTMLInputElement>(view.container, "input[type='file']");
    Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
    await flush(async () => {
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();
  }

  it("fills the text and title from an uploaded .txt file", async () => {
    const { CoachMaterialsPanel } = await load();
    view = await mount(createElement(CoachMaterialsPanel));
    await upload(new File(["Uploaded   lecture\n\nnotes"], "Week 1 Notes.txt", { type: "text/plain" }));

    expect(query<HTMLTextAreaElement>(view.container, "#coach-material-text").value).toContain("Uploaded");
    expect(input("coach-material-title").value).toBe("Week 1 Notes");
  });

  it("keeps a typed title and reports an unsupported file type", async () => {
    const { CoachMaterialsPanel } = await load();
    view = await mount(createElement(CoachMaterialsPanel));
    await type(input("coach-material-title"), "My title");
    await upload(new File(["x"], "slides.pdf"));
    expect(text()).toContain('Unsupported file type: "slides.pdf"');

    await upload(new File(["Body"], "other.md"));
    expect(input("coach-material-title").value).toBe("My title");
    expect(text()).not.toContain("Unsupported file type");
  });

  it("ignores a change event with no file selected", async () => {
    const { CoachMaterialsPanel } = await load();
    view = await mount(createElement(CoachMaterialsPanel));
    const fileInput = query<HTMLInputElement>(view.container, "input[type='file']");
    Object.defineProperty(fileInput, "files", { value: [], configurable: true });
    await flush(() => {
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(query<HTMLTextAreaElement>(view.container, "#coach-material-text").value).toBe("");
  });

  it("appends dictated segments to the material text", async () => {
    const instances: { onresult: ((e: unknown) => void) | null; onend: (() => void) | null; stop: () => void }[] = [];
    (window as unknown as Record<string, unknown>).SpeechRecognition = class {
      continuous = false;
      interimResults = false;
      lang = "";
      onresult: ((e: unknown) => void) | null = null;
      onerror = null;
      onend: (() => void) | null = null;
      start() {}
      stop = vi.fn(() => this.onend?.());
      constructor() {
        instances.push(this);
      }
    };
    const { CoachMaterialsPanel } = await load();
    view = await mount(createElement(CoachMaterialsPanel));
    await type(query<HTMLTextAreaElement>(view.container, "#coach-material-text"), "Existing");

    await click(buttonByText(view.container, "🎤 Record"));
    expect(text()).toContain("Listening… speak now.");
    await flush(() =>
      instances[0].onresult?.({ resultIndex: 0, results: [{ 0: { transcript: "spoken words" }, isFinal: true }] }),
    );
    expect(query<HTMLTextAreaElement>(view.container, "#coach-material-text").value).toBe("Existing spoken words");

    await click(buttonByText(view.container, "Stop recording"));
    expect(text()).not.toContain("Listening…");
  });
});

describe("CoachMaterialsPanel ask the coach", () => {
  it("previews the grounded prompt, gets an answer, records the turn and clears history", async () => {
    const { CoachMaterialsPanel, materials, conversation } = await load();
    materials.saveCoachMaterial(material("m1", { title: "Topicality lecture", status: "approved" }));
    view = await mount(createElement(CoachMaterialsPanel));

    const ask = buttonByText(view.container, "Ask the coach");
    expect(ask.disabled).toBe(true);
    await type(input("coach-question"), "How do I answer topicality?");
    expect(ask.disabled).toBe(false);

    await click(buttonByText(view.container, "Preview grounded prompt"));
    expect(text()).toContain("Topicality lecture");

    await click(ask);
    await flush();
    expect(text()).toContain("Answer from your lecture.");
    expect(conversation.listCoachConversationTurns()).toEqual([
      expect.objectContaining({ question: "How do I answer topicality?", answer: "Answer from your lecture." }),
    ]);
    expect(text()).toContain("Conversation");
    const body = JSON.parse(String(fetchMock.mock.calls.find(([url]) => String(url) === "/api/reason-ai")?.[1]?.body));
    expect(body.messages.length).toBeGreaterThan(0);

    await click(buttonByText(view.container, "Clear conversation"));
    expect(conversation.listCoachConversationTurns()).toEqual([]);
    expect(buttonsByText(view.container, "Clear conversation")).toHaveLength(0);
  });

  it("shows the coach endpoint's error", async () => {
    coachReply = () => new Response(JSON.stringify({ error: "Rate limited" }), { status: 429 });
    const { CoachMaterialsPanel } = await load();
    view = await mount(createElement(CoachMaterialsPanel));
    await type(input("coach-question"), "Anything?");
    await click(buttonByText(view.container, "Ask the coach"));
    await flush();
    expect(text()).toContain("Rate limited");
    expect(text()).not.toContain("Coach's answer");
  });
});

describe("CoachMaterialsPanel sync and live updates", () => {
  it("reports sync when signed in", async () => {
    const { CoachMaterialsPanel } = await load({ signedIn: true });
    view = await mount(createElement(CoachMaterialsPanel));
    await flush();
    expect(text()).toContain("Materials and their edit history are synced to your account.");
  });

  it("re-reads materials, versions and conversation on a watched storage event", async () => {
    const { CoachMaterialsPanel, materials, conversation } = await load();
    materials.saveCoachMaterial(material("m1"));
    view = await mount(createElement(CoachMaterialsPanel));
    await click(buttonByText(view.container, "History"));

    materials.saveCoachMaterial(material("m1", { title: "Edited elsewhere" }));
    materials.saveCoachMaterial(material("m2", { title: "Added elsewhere" }));
    conversation.appendCoachConversationTurn({ question: "Q from other tab", answer: "A" });

    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
    });
    expect(text()).not.toContain("Added elsewhere");

    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(text()).toContain("Added elsewhere");
    expect(text()).toContain("Edited elsewhere");
    expect(text()).toContain("Q from other tab");
    expect(text()).toContain("Restore this version");
  });
});
