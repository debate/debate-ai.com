/** @vitest-environment jsdom */
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { TopicStarterLibraryTree } from "../../../src/components/admin/topic-starters/TopicStarterLibraryTree";
import { allByText, bodyText, button, change, cleanup, click, flush, installDomShims, keyDown, mockFetch, mount } from "../../helpers/dom";

beforeAll(installDomShims);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ITEMS = [
  { id: 1, title: "Energy", parentId: null, isFolder: true, tags: "[]", published: true },
  { id: 2, title: "Aff", parentId: 1, isFolder: true, tags: "[]", published: true },
  { id: 3, title: "Solar case", parentId: 1, isFolder: false, tags: "[]", published: true },
  { id: 4, title: "Draft K", parentId: null, isFolder: false, tags: "[]", published: false },
];

function menuItem(text: string) {
  const item = allByText(text, "[role=menuitem]")[0];
  if (!item) throw new Error(`No menu item ${text}`);
  return item;
}

function openActions(title: string) {
  keyDown(document.querySelector(`[aria-label="Actions for ${title}"]`)!, "Enter");
}

function routes() {
  return mockFetch([
    { method: "PATCH", match: /\/api\/admin\/topic-starters\/\d+$/, respond: { id: 3, parentId: 2 } },
    { method: "DELETE", match: /\/api\/admin\/topic-starters\/\d+$/, respond: { success: true } },
    { method: "POST", match: /\/api\/admin\/topic-starters\/\d+\/copy$/, respond: { id: 9 }, status: 201 },
    { method: "POST", match: "/api/admin/topic-starters/items", respond: { item: { id: 10 } }, status: 201 },
    { method: "GET", match: "/api/admin/topic-starters", respond: { items: ITEMS } },
  ]);
}

describe("TopicStarterLibraryTree", () => {
  it("lists every imported row, private ones too", async () => {
    routes();
    mount(<TopicStarterLibraryTree />);
    await flush();
    const text = bodyText();
    expect(text).toContain("Solar case");
    expect(text).toContain("Draft K");
    expect(text).toContain("2 files, 1 not shared publicly");
  });

  it("moves a file from its Move to menu", async () => {
    const { calls } = routes();
    mount(<TopicStarterLibraryTree />);
    await flush();
    openActions("Solar case");
    keyDown(menuItem("Move to"), "ArrowRight");
    click(menuItem("Energy / Aff"));
    await flush();
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.url).toBe("/api/admin/topic-starters/3");
    expect(patch.body).toEqual({ parentId: 2 });
    expect(bodyText()).toContain("Solar case moved to Aff.");
  });

  it("moves a row dropped on a folder", async () => {
    const { calls } = routes();
    mount(<TopicStarterLibraryTree />);
    await flush();
    const row = allByText("Energy", "div.group")[0].firstElementChild!;
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", {
      value: { files: [], getData: (key: string) => (key === "text/topic-starter-id" ? "4" : ""), setData: vi.fn() },
    });
    act(() => {
      row.dispatchEvent(drop);
    });
    await flush();
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.url).toBe("/api/admin/topic-starters/4");
    expect(patch.body).toEqual({ parentId: 1 });
  });

  it("deletes a folder with its contents only after a confirm", async () => {
    const { calls } = routes();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    mount(<TopicStarterLibraryTree />);
    await flush();

    openActions("Energy");
    click(menuItem("Delete"));
    await flush();
    expect(confirm.mock.calls[0][0]).toContain("Delete Energy and everything in it?");
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);

    openActions("Energy");
    click(menuItem("Delete"));
    await flush();
    const del = calls.find((c) => c.method === "DELETE")!;
    expect(del.url).toBe("/api/admin/topic-starters/1");
    expect(bodyText()).toContain("Energy deleted.");
  });

  it("shows the server's reason when an edit is refused", async () => {
    mockFetch([
      { method: "DELETE", match: /\/api\/admin\/topic-starters\/\d+$/, respond: { error: "That Topic Starter item no longer exists." }, status: 404 },
      { method: "GET", match: "/api/admin/topic-starters", respond: { items: ITEMS } },
    ]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mount(<TopicStarterLibraryTree />);
    await flush();
    openActions("Draft K");
    click(menuItem("Delete"));
    await flush();
    expect(bodyText()).toContain("That Topic Starter item no longer exists.");
    expect(button("Refresh").disabled).toBe(false);
  });

  it("renames a row from its menu", async () => {
    const { calls } = routes();
    mount(<TopicStarterLibraryTree />);
    await flush();
    openActions("Solar case");
    click(menuItem("Rename"));
    const input = document.querySelector<HTMLInputElement>('[aria-label="Rename Solar case"]')!;
    change(input, "Solar aff");
    keyDown(input, "Enter");
    await flush();
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.url).toBe("/api/admin/topic-starters/3");
    expect(patch.body).toEqual({ title: "Solar aff" });
    expect(bodyText()).toContain("Renamed to Solar aff.");
  });

  it("offers Paste only after Copy, and pastes into a folder or beside a file", async () => {
    const { calls } = routes();
    mount(<TopicStarterLibraryTree />);
    await flush();
    openActions("Aff");
    expect(allByText(/^Paste/, "[role=menuitem]")).toHaveLength(0);
    click(menuItem("Copy"));
    await flush();

    // Rows re-render with a fresh menu; a copied folder pastes into another folder…
    openActions("Energy");
    click(menuItem("Paste “Aff”"));
    await flush();
    const posts = () => calls.filter((c) => c.method === "POST" && c.url.endsWith("/copy"));
    expect(posts()[0].url).toBe("/api/admin/topic-starters/2/copy");
    expect(posts()[0].body).toEqual({ parentId: 1 });
    expect(bodyText()).toContain("Pasted a copy of Aff into Energy.");

    // …and a file's Paste lands beside it, here at the top level.
    openActions("Draft K");
    click(menuItem("Paste “Aff”"));
    await flush();
    expect(posts()[1].body).toEqual({ parentId: null });
  });

  it("adds a folder from the header button", async () => {
    const { calls } = routes();
    mount(<TopicStarterLibraryTree />);
    await flush();
    click(button("New folder"));
    await flush();
    change(document.querySelector<HTMLInputElement>('[aria-label="Folder name"]')!, "Neg");
    click(button("Create"));
    await flush();
    const post = calls.find((c) => c.url.endsWith("/items"))!;
    expect(post.body).toEqual({ title: "Neg", parentId: null, isFolder: true });
    expect(bodyText()).toContain("Folder Neg created.");
  });
});
