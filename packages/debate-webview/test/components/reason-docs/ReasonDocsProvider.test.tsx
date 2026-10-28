/** @vitest-environment jsdom */
import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ReasonDocsProvider,
  useReasonDocs,
  type ReasonDocsContextValue,
} from "../../../src/components/reason-docs/ReasonDocsProvider";
import { DebateEditorImportError } from "../../../src/lib/debate-editor/import-files";
import { registerStoredCmir, type StoredCmir } from "../../../src/lib/debate-editor/lazy-stored-cmir";
import type { ReasonDocument } from "../../../src/components/reason-docs/types";
import type { TopicStarterItem } from "../../../src/components/reason-docs/topic-starters/TopicStarterTree";
import { cleanup, flush, mockFetch, mount, type FetchCall, type Route } from "../../helpers/dom";

const engine = {
  storedContentToHtml: vi.fn((doc: { content?: string | null }) => `<p>html:${doc.content ?? ""}</p>`),
  htmlToDocxBytes: vi.fn(async (html: string) => new TextEncoder().encode(html)),
  htmlToStoredCmir: vi.fn(async (html: string) => `cmir(${html})`),
  htmlToStoredCmirSync: vi.fn((html: string) => `cmirSync(${html})`),
  fileToStoredCmir: vi.fn(async (file: File) => ({ title: file.name, content: `cmir-of-${file.name}`, format: "cmir" })),
};

let ctx: ReasonDocsContextValue;
function Probe() {
  ctx = useReasonDocs();
  return (
    <div data-testid="probe">
      {ctx.documents.map((d) => `${d.id}:${d.title}:${d.content}`).join("|")}
    </div>
  );
}

const anchorClicks: Array<{ href: string; download: string }> = [];

beforeAll(() => {
  registerStoredCmir(engine as unknown as StoredCmir);
  URL.createObjectURL = vi.fn(() => "blob:fake");
  URL.revokeObjectURL = vi.fn();
});
beforeEach(() => {
  anchorClicks.length = 0;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    anchorClicks.push({ href: this.href, download: this.download });
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  for (const fn of Object.values(engine)) fn.mockClear();
});

function doc(overrides: Partial<ReasonDocument>): ReasonDocument {
  return { id: 1, title: "Doc", content: "", format: "html", parentId: null, isFolder: false, updatedAt: 0, ...overrides } as ReasonDocument;
}

const DOCS = [
  doc({ id: 1, title: "Case", content: "<p>aff</p>" }),
  doc({ id: 2, title: "Folder", isFolder: true }),
  doc({ id: 3, title: "Child", parentId: 2, content: "<p>child</p>" }),
  doc({ id: 4, title: "Grandchild", parentId: 3 }),
  doc({ id: 5, title: "Brief.cmir", content: "H4sIAAAAAAAA", format: "cmir" }),
];

function routes(extra: Route[] = []) {
  return mockFetch([
    ...extra,
    { method: "GET", match: "/api/doc/documents", respond: DOCS },
    { method: "GET", match: "/api/topic-starters/by-path", respond: { item: { id: 900, title: "Linked.cmir", isFolder: false, content: "x", format: "cmir" } } },
    { method: "GET", match: "/api/topic-starters", respond: { items: [{ id: 800, title: "Topic", isFolder: false }] } },
    { method: "PUT", match: "/api/doc/documents/", respond: { ok: true } },
    { method: "DELETE", match: "/api/doc/documents/", respond: { ok: true } },
  ]);
}

async function mountLoaded(extra: Route[] = []) {
  const fetchMock = routes(extra);
  mount(
    <ReasonDocsProvider>
      <Probe />
    </ReasonDocsProvider>,
  );
  act(() => ctx.ensureLoaded());
  await flush();
  return fetchMock;
}

function pagehide() {
  act(() => {
    window.dispatchEvent(new Event("pagehide"));
  });
}

describe("useReasonDocs", () => {
  it("throws outside the provider", () => {
    const Bare = () => {
      useReasonDocs();
      return null;
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderToStaticMarkup(<Bare />)).toThrow("useReasonDocs must be used inside <ReasonDocsProvider>");
  });
});

describe("ReasonDocsProvider", () => {
  it("loads documents and topic starters lazily, once", async () => {
    const { calls } = routes();
    mount(
      <ReasonDocsProvider>
        <Probe />
      </ReasonDocsProvider>,
    );
    expect(calls).toHaveLength(0);
    expect(ctx.loaded).toBe(false);
    act(() => {
      ctx.ensureLoaded();
      ctx.ensureLoaded();
    });
    expect(ctx.loading).toBe(true);
    await flush();
    expect(calls.map((c) => c.url)).toEqual(["/api/doc/documents", "/api/topic-starters"]);
    expect(ctx.loaded).toBe(true);
    expect(ctx.loading).toBe(false);
    expect(ctx.documents).toHaveLength(5);
    expect(ctx.topicItems).toEqual([{ id: 800, title: "Topic", isFolder: false }]);
  });

  it("falls back to empty lists when the loads fail", async () => {
    mockFetch([
      { match: "/api/doc/documents", respond: {}, status: 500 },
      { match: "/api/topic-starters", respond: {}, status: 500 },
    ]);
    mount(
      <ReasonDocsProvider>
        <Probe />
      </ReasonDocsProvider>,
    );
    act(() => ctx.ensureLoaded());
    await flush();
    expect(ctx.documents).toEqual([]);
    expect(ctx.topicItems).toEqual([]);
    expect(ctx.loaded).toBe(true);
  });

  it("opens, selects and closes tabs, falling through to a neighbour", async () => {
    await mountLoaded();
    act(() => ctx.openDocument(1));
    act(() => ctx.openDocument(3));
    act(() => ctx.openDocument(5));
    act(() => ctx.openDocument(3));
    expect(ctx.openTabs).toEqual([1, 3, 5]);
    expect(ctx.activeId).toBe(3);

    act(() => ctx.selectTab(1));
    expect(ctx.activeId).toBe(1);

    act(() => ctx.selectTab(3));
    act(() => ctx.closeTab(3));
    expect(ctx.openTabs).toEqual([1, 5]);
    expect(ctx.activeId).toBe(5);

    act(() => ctx.closeTab(5));
    expect(ctx.activeId).toBe(1);
    act(() => ctx.closeTab(1));
    expect(ctx.activeId).toBeNull();
  });

  it("opens every topic starter in its own tab beside the documents", async () => {
    await mountLoaded();
    const starter = (id: number, title: string) => ({ id, title, parentId: null, isFolder: false }) as TopicStarterItem;
    act(() => ctx.openDocument(1));
    act(() => ctx.selectTopicDocument(starter(1, "Space aff")));
    act(() => ctx.selectTopicDocument(starter(2, "Space neg")));
    // Topic Starter 1 and document 1 share a row id but not a tab.
    expect(ctx.openTabs).toEqual([1, -1, -2]);
    expect(ctx.activeTab).toBe(-2);
    expect(ctx.activeId).toBeNull();
    expect(ctx.topicDocument).toMatchObject({ id: 2 });
    expect(ctx.tabTitle(-1)).toBe("Space aff");
    expect(ctx.tabTitle(1)).toBe("Case");

    // Clicking an open starter again switches to its tab, not a second copy.
    act(() => ctx.selectTopicDocument(starter(1, "Space aff")));
    expect(ctx.openTabs).toEqual([1, -1, -2]);
    expect(ctx.topicDocument).toMatchObject({ id: 1 });

    act(() => ctx.selectTab(1));
    expect(ctx.activeId).toBe(1);
    expect(ctx.topicDocument).toBeNull();

    act(() => ctx.closeTab(-2));
    expect(ctx.canReopenTab).toBe(true);
    act(() => ctx.reopenClosedTab());
    expect(ctx.openTabs).toEqual([1, -1, -2]);
    expect(ctx.topicDocument).toMatchObject({ id: 2 });
  });

  it("creates documents and folders", async () => {
    const { calls } = await mountLoaded([
      {
        method: "POST",
        match: "/api/doc/documents",
        respond: (call: FetchCall) => {
          const body = call.body as { title: string; isFolder: boolean; parentId: number | null };
          return doc({ id: body.isFolder ? 21 : 20, title: body.title, isFolder: body.isFolder, parentId: body.parentId });
        },
      },
    ]);
    await act(async () => ctx.createDocument());
    expect(calls.at(-1)!.body).toEqual({ title: "Untitled", content: "", parentId: null, isFolder: false });
    expect(ctx.documents[0].id).toBe(20);
    expect(ctx.activeId).toBe(20);

    await act(async () => ctx.createDocument(2, true));
    expect(calls.at(-1)!.body).toEqual({ title: "New Folder", content: "", parentId: 2, isFolder: true });
    expect(ctx.documents[0].id).toBe(21);
    expect(ctx.activeId).toBe(20);
  });

  it("deletes a folder with every descendant and drops their tabs", async () => {
    const { calls } = await mountLoaded();
    act(() => ctx.openDocument(3));
    act(() => ctx.openDocument(1));
    act(() => ctx.selectTab(3));
    act(() => ctx.updateTitle(3, "Pending rename"));
    await act(async () => ctx.deleteDocument(2));

    const deletes = calls.filter((c) => c.method === "DELETE").map((c) => c.url).sort();
    expect(deletes).toEqual(["/api/doc/documents/2", "/api/doc/documents/3", "/api/doc/documents/4"]);
    expect(ctx.documents.map((d) => d.id)).toEqual([1, 5]);
    expect(ctx.openTabs).toEqual([1]);
    expect(ctx.activeId).toBeNull();
    // The cancelled rename never reaches the server.
    expect(ctx.unsaved).toBe(false);
    pagehide();
    await flush();
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("queues title, move and HTML content edits and flushes them on pagehide", async () => {
    const { calls } = await mountLoaded();
    act(() => ctx.updateTitle(1, "Renamed"));
    act(() => ctx.updateContent(1, "<p>new aff</p>"));
    await act(async () => ctx.moveDocument(3, null));
    expect(ctx.unsaved).toBe(true);
    expect(ctx.documents.find((d) => d.id === 1)).toMatchObject({ title: "Renamed", content: "<p>new aff</p>" });
    expect(ctx.documents.find((d) => d.id === 3)!.parentId).toBeNull();

    pagehide();
    await flush();
    const puts = calls.filter((c) => c.method === "PUT");
    expect(puts.find((c) => c.url === "/api/doc/documents/1")!.body).toEqual({ title: "Renamed", content: "<p>new aff</p>" });
    expect(puts.find((c) => c.url === "/api/doc/documents/3")!.body).toEqual({ parentId: null });
    expect(puts[0].init!.keepalive).toBe(true);
    expect(ctx.unsaved).toBe(false);
  });

  it("re-encodes a .cmir edit synchronously when the page goes away", async () => {
    const { calls } = await mountLoaded();
    act(() => ctx.updateContent(5, "<p>first</p>"));
    act(() => ctx.updateContent(5, "<p>edited</p>"));
    // The live HTML wins over the stored copy.
    expect(ctx.documentHtml(ctx.documents.find((d) => d.id === 5)!)).toBe("<p>edited</p>");

    act(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await flush();
    expect(engine.htmlToStoredCmirSync).toHaveBeenCalledTimes(1);
    expect(engine.htmlToStoredCmirSync).toHaveBeenCalledWith("<p>edited</p>");
    expect(calls.find((c) => c.method === "PUT")!.body).toEqual({ content: "cmirSync(<p>edited</p>)" });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  it("re-encodes a .cmir edit after its debounce", async () => {
    await mountLoaded();
    act(() => ctx.updateContent(5, "<p>debounced</p>"));
    await vi.waitFor(() => expect(ctx.documents.find((d) => d.id === 5)!.content).toBe("cmir(<p>debounced</p>)"), { timeout: 3000 });
    expect(engine.htmlToStoredCmir).toHaveBeenCalledWith("<p>debounced</p>");
  });

  it("converts stored rows to HTML through the engine", async () => {
    await mountLoaded();
    expect(ctx.documentHtml(DOCS[0])).toBe("<p>html:<p>aff</p></p>");
    expect(engine.storedContentToHtml).toHaveBeenCalledWith(DOCS[0]);
  });

  it("downloads an owned document as .docx", async () => {
    await mountLoaded();
    let outcome: unknown;
    await act(async () => {
      outcome = await ctx.downloadDocument(5);
    });
    expect(outcome).toEqual({ ok: true });
    expect(anchorClicks).toEqual([{ href: "blob:fake", download: "Brief.docx" }]);
    expect(engine.htmlToDocxBytes).toHaveBeenCalledWith("<p>html:H4sIAAAAAAAA</p>");

    await act(async () => {
      outcome = await ctx.downloadDocument(2);
    });
    expect(outcome).toEqual({ ok: false, error: "That file could not be found." });

    engine.htmlToDocxBytes.mockRejectedValueOnce(new Error("bad html"));
    await act(async () => {
      outcome = await ctx.downloadDocument(1);
    });
    expect(outcome).toEqual({ ok: false, error: "Case could not be downloaded (bad html)." });
  });

  it("downloads a topic starter as .docx", async () => {
    await mountLoaded();
    const item = { id: 800, title: "Topic.cmir", isFolder: false, content: "c", format: "cmir" } as unknown as TopicStarterItem;
    let outcome: unknown;
    await act(async () => {
      outcome = await ctx.downloadTopicDocument(item);
    });
    expect(outcome).toEqual({ ok: true });
    expect(anchorClicks.at(-1)!.download).toBe("Topic.docx");

    await act(async () => {
      outcome = await ctx.downloadTopicDocument({ ...item, isFolder: true } as TopicStarterItem);
    });
    expect(outcome).toEqual({ ok: false, error: "That file could not be found." });

    engine.htmlToDocxBytes.mockRejectedValueOnce("boom");
    await act(async () => {
      outcome = await ctx.downloadTopicDocument({ ...item, title: "" } as TopicStarterItem);
    });
    expect(outcome).toEqual({ ok: false, error: "This file could not be downloaded (boom)." });
  });

  it("imports files as .cmir rows and reports the ones that fail", async () => {
    let nextId = 100;
    const { calls } = await mountLoaded([
      { method: "POST", match: "/api/doc/documents", once: true, respond: () => doc({ id: nextId++, title: "a.docx" }) },
      { method: "POST", match: "/api/doc/documents", respond: {}, status: 507 },
    ]);
    engine.fileToStoredCmir.mockImplementationOnce(async (file: File) => ({ title: file.name, content: "cmir-a", format: "cmir" }));
    engine.fileToStoredCmir.mockImplementationOnce(async () => {
      throw new DebateEditorImportError("b.pdf is not a supported file type.");
    });

    let outcome: Awaited<ReturnType<ReasonDocsContextValue["importFiles"]>> | undefined;
    await act(async () => {
      outcome = await ctx.importFiles([new File(["a"], "a.docx"), new File(["b"], "b.pdf"), new File(["c"], "c.docx")], 2);
    });
    expect(outcome!.created.map((d) => [d.id, d.format])).toEqual([[100, "cmir"]]);
    expect(outcome!.failures).toEqual([
      "b.pdf is not a supported file type.",
      "c.docx could not be uploaded (the server refused it (507)).",
    ]);
    expect(calls.filter((c) => c.method === "POST")[0].body).toEqual({ title: "a.docx", content: "cmir-a", format: "cmir", parentId: 2, isFolder: false });
    expect(ctx.activeId).toBe(100);
    expect(ctx.documents[0].id).toBe(100);
    expect(ctx.importing).toBe(false);

    let empty: unknown;
    await act(async () => {
      empty = await ctx.importFiles([]);
    });
    expect(empty).toEqual({ created: [], failures: [] });
  });

  it("opens a public file by path and selects topic documents", async () => {
    await mountLoaded();
    act(() => ctx.openDocument(1));
    let found: boolean | undefined;
    await act(async () => {
      found = await ctx.openPublicByRef("Camp/Linked");
    });
    expect(found).toBe(true);
    expect(ctx.topicDocument).toMatchObject({ id: 900 });
    expect(ctx.activeId).toBeNull();
    expect(ctx.topicItems.map((t) => t.id)).toEqual([800, 900]);

    // Opening the same file again does not duplicate it in the catalogue.
    await act(async () => {
      await ctx.openPublicByRef("Camp/Linked");
    });
    expect(ctx.topicItems.map((t) => t.id)).toEqual([800, 900]);

    act(() => ctx.selectTab(1));
    expect(ctx.topicDocument).toBeNull();
  });

  it("reports when a public path is unknown or the lookup fails", async () => {
    await mountLoaded([
      { match: "path=missing", respond: {}, status: 404 },
      { match: "path=empty", respond: {} },
      { match: "path=throws", respond: () => Promise.reject(new Error("offline")) },
    ]);
    for (const ref of ["missing", "empty", "throws"]) {
      let found: boolean | undefined;
      await act(async () => {
        found = await ctx.openPublicByRef(ref);
      });
      expect(found).toBe(false);
    }
  });
});

describe("moving files between Files and Topic Starters", () => {
  const TOPICS = [
    { id: 70, title: "Energy", content: "", parentId: null, isFolder: true, tags: "[]" },
    { id: 71, title: "Solar Aff", content: "H4sIcmir", format: "cmir", parentId: 70, isFolder: false, tags: "[]" },
    { id: 72, title: "Wind", content: "", parentId: 70, isFolder: true, tags: "[]" },
    { id: 73, title: "Offshore", content: "<p>wind</p>", format: "html", parentId: 72, isFolder: false, tags: "[]" },
  ];

  function creating(startId: number): Route {
    let nextId = startId;
    return {
      method: "POST",
      match: "/api/doc/documents",
      respond: (call: FetchCall) => {
        const body = call.body as Partial<ReasonDocument>;
        return doc({ ...body, id: nextId++ });
      },
    };
  }

  it("copies a topic starter folder and everything in it into the reader's files", async () => {
    const { calls } = await mountLoaded([
      { method: "GET", match: "/api/topic-starters", respond: { items: TOPICS } },
      creating(100),
    ]);
    let result: Awaited<ReturnType<ReasonDocsContextValue["copyTopicToDocuments"]>> | undefined;
    await act(async () => {
      result = await ctx.copyTopicToDocuments(ctx.topicItems.find((t) => t.id === 70)!, 2);
    });
    expect(result?.ok).toBe(true);
    const posts = calls.filter((c) => c.method === "POST").map((c) => c.body);
    // Parents before children, each child re-pointed at its new parent, and
    // the stored format kept so a `.cmir` stays a `.cmir`.
    expect(posts).toEqual([
      { title: "Energy", content: "", parentId: 2, isFolder: true },
      { title: "Solar Aff", content: "H4sIcmir", format: "cmir", parentId: 100, isFolder: false },
      { title: "Wind", content: "", parentId: 100, isFolder: true },
      { title: "Offshore", content: "<p>wind</p>", format: "html", parentId: 102, isFolder: false },
    ]);
    expect(ctx.documents.filter((d) => d.id >= 100).map((d) => d.title).sort()).toEqual(["Energy", "Offshore", "Solar Aff", "Wind"]);
  });

  it("reports a copy the server refuses, keeping what was already written", async () => {
    await mountLoaded([
      { method: "GET", match: "/api/topic-starters", respond: { items: TOPICS } },
      { method: "POST", match: "/api/doc/documents", once: true, respond: () => doc({ id: 200, title: "Energy", isFolder: true }) },
      { method: "POST", match: "/api/doc/documents", respond: {}, status: 507 },
    ]);
    let result: Awaited<ReturnType<ReasonDocsContextValue["copyTopicToDocuments"]>> | undefined;
    await act(async () => {
      result = await ctx.copyTopicToDocuments(ctx.topicItems.find((t) => t.id === 70)!);
    });
    expect(result).toEqual({ ok: false, error: "Energy could not be copied (the server refused it (507))." });
    expect(ctx.documents.some((d) => d.id === 200)).toBe(true);
  });

  it("duplicates a file next to itself, or into another folder", async () => {
    const { calls } = await mountLoaded([creating(300)]);
    await act(async () => {
      await ctx.duplicateDocument(3);
    });
    expect(calls.at(-1)!.body).toEqual({ title: "Child copy", content: "<p>child</p>", format: "html", parentId: 2, isFolder: false });
    await act(async () => {
      await ctx.duplicateDocument(1, null);
    });
    expect(calls.at(-1)!.body).toMatchObject({ title: "Case copy", parentId: null });
    let missing: Awaited<ReturnType<ReasonDocsContextValue["duplicateDocument"]>> | undefined;
    await act(async () => {
      missing = await ctx.duplicateDocument(999);
    });
    expect(missing).toEqual({ ok: false, error: "That file could not be found." });
  });

  it("submits a file to Topic Starters: applied for staff, pending for everyone else", async () => {
    const { calls } = await mountLoaded([
      { method: "POST", match: "/api/topic-starters/changes", once: true, respond: { status: "applied" } },
      {
        method: "GET",
        match: "/api/topic-starters",
        respond: { items: [{ id: 500, title: "Case", content: "<p>aff</p>", format: "html", parentId: 70, isFolder: false, tags: "[]" }] },
      },
      { method: "POST", match: "/api/topic-starters/changes", once: true, respond: { status: "pending", id: 9 }, status: 202 },
      { method: "POST", match: "/api/topic-starters/changes", respond: { error: "Sign in to suggest changes to Topic Starters." }, status: 401 },
    ]);
    let published: Awaited<ReturnType<ReasonDocsContextValue["publishToTopics"]>> | undefined;
    await act(async () => {
      published = await ctx.publishToTopics(1, 70);
    });
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({
      kind: "submit",
      title: "Case",
      content: "<p>aff</p>",
      format: "html",
      parentId: 70,
      year: null,
    });
    expect(published).toEqual({ ok: true, pending: false, title: "Case" });
    // Applied: the catalogue is re-read rather than patched locally.
    expect(ctx.topicItems.some((t) => t.id === 500)).toBe(true);

    await act(async () => {
      published = await ctx.publishToTopics(1);
    });
    expect(published).toEqual({ ok: true, pending: true, title: "Case" });

    await act(async () => {
      published = await ctx.publishToTopics(1);
    });
    expect(published).toMatchObject({ ok: false, error: expect.stringContaining("Sign in") });

    await act(async () => {
      published = await ctx.publishToTopics(2);
    });
    expect(published).toEqual({ ok: false, error: "Only a file can be added to Topic Starters." });
  });

  it("sends moves, renames, deletes and new folders as change requests", async () => {
    const { calls } = await mountLoaded([
      { method: "POST", match: "/api/topic-starters/changes", respond: { status: "pending", id: 1 }, status: 202 },
      { method: "GET", match: "/api/topic-starters", respond: { items: TOPICS } },
    ]);
    let outcome: Awaited<ReturnType<ReasonDocsContextValue["moveTopicStarter"]>> | undefined;
    await act(async () => {
      outcome = await ctx.moveTopicStarter(71, null);
    });
    expect(outcome).toEqual({ ok: true, pending: true });
    await act(async () => {
      await ctx.renameTopicStarter(71, "  Solar 1AC ");
      await ctx.deleteTopicStarter(70);
      await ctx.createTopicFolder("Neg", null);
    });
    const posts = calls.filter((c) => c.method === "POST").map((c) => c.body);
    expect(posts).toEqual([
      { kind: "move", itemId: 71, parentId: null },
      { kind: "rename", itemId: 71, title: "Solar 1AC" },
      { kind: "delete", itemId: 70 },
      { kind: "create-folder", title: "Neg", parentId: null },
    ]);

    // Refused client-side without a request: a folder into its own subtree,
    // a no-op move, and an id the catalogue doesn't have.
    await act(async () => {
      outcome = await ctx.moveTopicStarter(70, 72);
    });
    expect(outcome).toEqual({ ok: false, error: "A folder cannot be moved into its own subtree." });
    await act(async () => {
      outcome = await ctx.moveTopicStarter(71, 70);
    });
    expect(outcome).toEqual({ ok: true, pending: false });
    await act(async () => {
      outcome = await ctx.deleteTopicStarter(999);
    });
    expect(outcome).toEqual({ ok: false, error: "That topic starter could not be found." });
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(4);
  });

  it("asks the organizer for a proposal without applying it", async () => {
    const change = { kind: "reorganize", assignments: [{ itemId: 71, side: "aff", type: "case" }] };
    const { calls } = await mountLoaded([
      { method: "POST", match: "/api/topic-starters/organize", once: true, respond: { change, summary: "Organize 1 file by argument (Aff/Case 1)", moves: 1 } },
      { method: "POST", match: "/api/topic-starters/organize", respond: { error: "AI features are not configured on the server." }, status: 503 },
    ]);
    let outcome: Awaited<ReturnType<ReasonDocsContextValue["organizeTopicStarters"]>> | undefined;
    await act(async () => {
      outcome = await ctx.organizeTopicStarters();
    });
    expect(outcome).toEqual({ ok: true, change, summary: "Organize 1 file by argument (Aff/Case 1)", moves: 1 });
    expect(calls.some((c) => c.url.includes("/changes"))).toBe(false);
    await act(async () => {
      outcome = await ctx.organizeTopicStarters();
    });
    expect(outcome).toEqual({ ok: false, error: "AI features are not configured on the server." });
  });

  it("adds nothing to the tree when the server refuses a new document", async () => {
    await mountLoaded([{ method: "POST", match: "/api/doc/documents", respond: { error: "quota" }, status: 429 }]);
    const before = ctx.documents.length;
    await act(async () => ctx.createDocument());
    expect(ctx.documents.length).toBe(before);
    expect(ctx.activeId).toBeNull();
  });
});
