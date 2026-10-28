/** @vitest-environment jsdom */
import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  pathname: "/research/cards",
  search: new URLSearchParams(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => nav.pathname,
  useSearchParams: () => nav.search,
}));

const docsState = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("../../src/docs/ReasonDocsProvider", () => ({
  useReasonDocs: () => docsState.value,
}));

const session = vi.hoisted(() => ({ value: { isAuthenticated: true, user: { name: "Ada" } } as Record<string, unknown> }));
vi.mock("../../src/session", () => ({ useReasonSession: () => session.value }));

const team = vi.hoisted(() => ({
  contacts: [] as unknown[],
  share: vi.fn(),
  onOpen: undefined as undefined | ((share: unknown) => void),
  fetchCardShares: vi.fn(),
  markCardShareOpened: vi.fn(),
}));
vi.mock("@debate-ai/team-collaboration", () => ({
  ContactAvatar: ({ user }: { user: { name: string } }) => <span data-avatar>{user.name.charAt(0)}</span>,
  fetchCardShares: team.fetchCardShares,
  markCardShareOpened: team.markCardShareOpened,
  sortContacts: (rows: Array<{ online: boolean; user: { name: string } }>) =>
    [...rows].sort((a, b) => Number(b.online) - Number(a.online) || a.user.name.localeCompare(b.user.name)),
  useContacts: () => ({ contacts: team.contacts }),
  useCardShares: (_enabled: boolean, options: { onOpen?: (share: unknown) => void }) => {
    team.onOpen = options.onOpen;
    return { share: team.share };
  },
}));

const bridge = vi.hoisted(() => ({
  collabSeamsReady: vi.fn(() => true),
  collabAvailable: vi.fn(() => true),
  activeCollabShare: vi.fn(() => null as null | { shareCode: string; guestPass: string }),
  startCollabSession: vi.fn(async () => ({ shareCode: "cmshare1", guestPass: "pass1" }) as null | { shareCode: string; guestPass: string }),
  joinCollabShare: vi.fn(async () => true),
  seedCollabDisplayName: vi.fn(),
}));
vi.mock("@debate-ai/editor/collab-bridge", () => bridge);

const toast = vi.hoisted(() => ({
  loading: vi.fn(() => "toast-id"),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

import { ReasonDocsSidebarPanels } from "../../src/docs/ReasonDocsSidebarPanels";
import { FileTree } from "../../src/docs/file-manager/FileTree";
import { TopicStarterTree, type TopicStarterItem } from "../../src/docs/topic-starters/TopicStarterTree";
import { SharedCardOpener, ShareWithContacts } from "../../src/editor/ShareWithContacts";
import type { ReasonDocument } from "../../src/docs/types";
import {
  allByText,
  bodyText,
  button,
  change,
  cleanup,
  click,
  flush,
  installDomShims,
  keyDown,
  mount,
} from "../helpers/dom";

beforeAll(installDomShims);
beforeEach(() => {
  localStorage.clear();
  nav.pathname = "/research/cards";
  nav.search = new URLSearchParams();
  session.value = { isAuthenticated: true, user: { name: "Ada" } };
  team.contacts = [];
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  bridge.collabSeamsReady.mockImplementation(() => true);
  bridge.collabAvailable.mockImplementation(() => true);
  bridge.activeCollabShare.mockImplementation(() => null);
  bridge.startCollabSession.mockImplementation(async () => ({ shareCode: "cmshare1", guestPass: "pass1" }));
  bridge.joinCollabShare.mockImplementation(async () => true);
});

function doc(overrides: Partial<ReasonDocument>): ReasonDocument {
  return { id: 1, title: "Doc", content: "", format: "html", parentId: null, isFolder: false, updatedAt: 0, ...overrides } as ReasonDocument;
}

const DOCS = [
  doc({ id: 1, title: "Case.docx" }),
  doc({ id: 2, title: "Folder", isFolder: true }),
  doc({ id: 3, title: "Child", parentId: 2 }),
  doc({ id: 4, title: "Sub", parentId: 2, isFolder: true }),
];

const TOPICS: TopicStarterItem[] = [
  { id: 10, title: "Energy", content: "", parentId: null, isFolder: true, tags: "[]" },
  { id: 11, title: "Solar Aff", content: "x", parentId: 10, isFolder: false, tags: '["aff"]' },
  { id: 12, title: "Nuclear Neg", content: "y", parentId: 10, isFolder: false, tags: "not json" },
];

function makeDocs(overrides: Record<string, unknown> = {}) {
  return {
    documents: DOCS,
    topicItems: TOPICS,
    openTabs: [1, 3],
    activeId: 1,
    loading: false,
    importing: false,
    ensureLoaded: vi.fn(),
    openDocument: vi.fn(),
    selectTab: vi.fn(),
    closeTab: vi.fn(),
    createDocument: vi.fn(async () => {}),
    deleteDocument: vi.fn(async () => {}),
    moveDocument: vi.fn(async () => {}),
    updateTitle: vi.fn(),
    selectTopicDocument: vi.fn(),
    importFiles: vi.fn(async () => ({ created: [], failures: [] })),
    downloadDocument: vi.fn(async () => ({ ok: true })),
    downloadTopicDocument: vi.fn(async () => ({ ok: true })),
    copyTopicToDocuments: vi.fn(async () => ({ ok: true, created: [doc({ id: 60, title: "Solar Aff", parentId: null })] })),
    duplicateDocument: vi.fn(async () => ({ ok: true, created: [] })),
    publishToTopics: vi.fn(async () => ({ ok: true, pending: false, title: "Case.docx" })),
    moveTopicStarter: vi.fn(async () => ({ ok: true, pending: true })),
    renameTopicStarter: vi.fn(async () => ({ ok: true, pending: false })),
    deleteTopicStarter: vi.fn(async () => ({ ok: true, pending: true })),
    createTopicFolder: vi.fn(async () => ({ ok: true, pending: true })),
    proposeTopicChange: vi.fn(async () => ({ ok: true, pending: true })),
    organizeTopicStarters: vi.fn(async () => ({ ok: true, change: { kind: "reorganize", assignments: [{ itemId: 11, side: "aff", type: "case" }] }, summary: "Organize 1 file by argument (Aff/Case 1)", moves: 1 })),
    ...overrides,
  };
}

/** Opens a Radix dropdown from its trigger the way a keyboard user would. */
function openMenu(trigger: Element) {
  keyDown(trigger, "Enter");
}

function menuItem(text: string) {
  const item = allByText(text, "[role=menuitem]")[0];
  if (!item) throw new Error(`No menu item ${text}`);
  return item;
}

function rowOf(title: string) {
  return allByText(title, "div.group").at(-1)!.querySelector<HTMLElement>("div") ?? allByText(title, "div.group").at(-1)!;
}

function dropEvent(type: string, data: { files?: File[]; id?: number; topicId?: number }) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: {
      files: data.files ?? [],
      getData: (key: string) =>
        key === "text/reason-document-id" && data.id
          ? String(data.id)
          : key === "text/topic-starter-id" && data.topicId
            ? String(data.topicId)
            : "",
      setData: vi.fn(),
    },
  });
  return event;
}

/** Right-clicks `el` — the row's context menu. */
function rightClick(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
  });
}

describe("FileTree", () => {
  const handlers = () => ({
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onMove: vi.fn(),
    onUpload: vi.fn(),
    onDownload: vi.fn(),
  });

  it("selects files and toggles folders, with no format badge on any row", () => {
    const h = handlers();
    mount(<FileTree documents={DOCS} activeId={1} {...h} />);
    expect(bodyText()).toContain("Child");
    // Every file is a Debate Editor file however it arrived — no DOCX/CMIR label.
    expect(bodyText()).not.toContain("DOCX");
    expect(bodyText()).not.toContain("CMIR");

    click(byTitle("Case.docx"));
    expect(h.onSelect).toHaveBeenCalledWith(1);

    click(byTitle("Folder"));
    expect(bodyText()).not.toContain("Child");
    click(byTitle("Folder").querySelector("button")!);
    expect(bodyText()).toContain("Child");
  });

  it("renames on double-click, committing with Enter and cancelling with Escape", () => {
    const h = handlers();
    mount(<FileTree documents={DOCS} activeId={null} {...h} />);
    act(() => {
      byTitle("Child").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    const input = document.querySelector<HTMLInputElement>("input")!;
    expect(input.value).toBe("Child");
    change(input, "Renamed child");
    keyDown(input, "Enter");
    expect(h.onRename).toHaveBeenCalledWith(3, "Renamed child");

    act(() => {
      byTitle("Child").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    keyDown(document.querySelector("input")!, "Escape");
    expect(document.querySelector("input")).toBeNull();
  });

  it("offers per-row menu actions", () => {
    const h = handlers();
    mount(<FileTree documents={DOCS} activeId={null} {...h} />);
    const folderMenu = byTitle("Folder").querySelectorAll("button")[1];
    openMenu(folderMenu);
    click(menuItem("New File"));
    expect(h.onAdd).toHaveBeenCalledWith(2, false);

    openMenu(byTitle("Folder").querySelectorAll("button")[1]);
    click(menuItem("New Folder"));
    expect(h.onAdd).toHaveBeenCalledWith(2, true);

    openMenu(byTitle("Case.docx").querySelector("button")!);
    click(menuItem("Download as .docx"));
    expect(h.onDownload).toHaveBeenCalledWith(1);

    openMenu(byTitle("Case.docx").querySelector("button")!);
    click(menuItem("Delete"));
    expect(h.onDelete).toHaveBeenCalledWith(1);

    openMenu(byTitle("Case.docx").querySelector("button")!);
    click(menuItem("Rename"));
    const input = document.querySelector<HTMLInputElement>("input")!;
    change(input, "   ");
    act(() => {
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(h.onRename).not.toHaveBeenCalled();
  });

  it("re-files dragged rows and imports dropped files", () => {
    const h = handlers();
    mount(<FileTree documents={DOCS} activeId={null} {...h} />);
    const folder = byTitle("Folder");

    act(() => {
      folder.dispatchEvent(dropEvent("dragover", {}));
    });
    act(() => {
      folder.dispatchEvent(dropEvent("drop", { id: 1 }));
    });
    expect(h.onMove).toHaveBeenCalledWith(1, 2);

    // A folder cannot go into its own subtree, and a row already there is left alone.
    act(() => {
      byTitle("Sub").dispatchEvent(dropEvent("drop", { id: 2 }));
    });
    act(() => {
      folder.dispatchEvent(dropEvent("drop", { id: 3 }));
    });
    expect(h.onMove).toHaveBeenCalledTimes(1);

    const file = new File(["x"], "drop.docx");
    act(() => {
      byTitle("Child").dispatchEvent(dropEvent("drop", { files: [file] }));
    });
    expect(h.onUpload).toHaveBeenCalledWith([file], 2);

    const root = document.querySelector<HTMLElement>(".overflow-auto")!;
    act(() => {
      root.dispatchEvent(dropEvent("dragover", {}));
    });
    act(() => {
      root.dispatchEvent(dropEvent("drop", { id: 3 }));
    });
    expect(h.onMove).toHaveBeenLastCalledWith(3, null);
  });

  it("opens the row's menu on right-click, with open, edit, share, duplicate, move and publish", () => {
    const h = { ...handlers(), onDuplicate: vi.fn(), onShare: vi.fn(), onPublish: vi.fn() };
    mount(<FileTree documents={DOCS} activeId={null} {...h} />);

    rightClick(byTitle("Child"));
    click(menuItem("Edit"));
    expect(h.onSelect).toHaveBeenCalledWith(3);

    rightClick(byTitle("Child"));
    click(menuItem("Open"));
    expect(h.onSelect).toHaveBeenCalledTimes(2);

    rightClick(byTitle("Child"));
    click(menuItem("Share…"));
    expect(h.onShare).toHaveBeenCalledWith(3);

    rightClick(byTitle("Child"));
    click(menuItem("Duplicate"));
    expect(h.onDuplicate).toHaveBeenCalledWith(3);

    rightClick(byTitle("Child"));
    click(menuItem("Add to Topic Starters"));
    expect(h.onPublish).toHaveBeenCalledWith(3);

    // Folders get New File / New Folder instead of open, edit and share.
    rightClick(byTitle("Folder"));
    expect(allByText("Share…", "[role=menuitem]")).toHaveLength(0);
    click(menuItem("New File"));
    expect(h.onAdd).toHaveBeenCalledWith(2, false);
  });

  it("moves a row to any folder, or the top level, from the menu", () => {
    const h = handlers();
    mount(<FileTree documents={DOCS} activeId={null} {...h} />);
    rightClick(byTitle("Child"));
    // A Radix sub-menu opens from its trigger with the arrow key.
    keyDown(menuItem("Move to"), "ArrowRight");
    // Where the row already is can't be picked.
    expect(menuItem("Folder").getAttribute("aria-disabled")).toBe("true");
    click(menuItem("Folder / Sub"));
    expect(h.onMove).toHaveBeenCalledWith(3, 4);

    rightClick(byTitle("Folder"));
    keyDown(menuItem("Move to"), "ArrowRight");
    // A folder can't go into its own subtree.
    expect(menuItem("Folder / Sub").getAttribute("aria-disabled")).toBe("true");
    rightClick(byTitle("Child"));
    keyDown(menuItem("Move to"), "ArrowRight");
    click(menuItem("Top level"));
    expect(h.onMove).toHaveBeenLastCalledWith(3, null);
  });

  it("copies a topic starter dropped on the tree into the folder it lands on", () => {
    const h = { ...handlers(), onImportTopic: vi.fn() };
    mount(<FileTree documents={DOCS} activeId={null} {...h} />);
    act(() => {
      byTitle("Folder").dispatchEvent(dropEvent("drop", { topicId: 11 }));
    });
    expect(h.onImportTopic).toHaveBeenCalledWith(11, 2);
    act(() => {
      document.querySelector("[data-testid=file-tree]")!.dispatchEvent(dropEvent("drop", { topicId: 12 }));
    });
    expect(h.onImportTopic).toHaveBeenLastCalledWith(12, null);
    expect(h.onMove).not.toHaveBeenCalled();
  });

  it("sorts by the chosen order and keeps rows whose folder is gone", () => {
    const rows = [
      doc({ id: 1, title: "Alpha", updatedAt: 1 }),
      doc({ id: 2, title: "Beta", updatedAt: 3 }),
      doc({ id: 3, title: "Stray", parentId: 99, updatedAt: 2 }),
    ];
    const h = handlers();
    mount(<FileTree documents={rows} activeId={null} sort="updated" {...h} />);
    const titles = () => [...document.querySelectorAll("span.flex-1")].map((el) => el.textContent);
    expect(titles()).toEqual(["Beta", "Stray", "Alpha"]);
    cleanup();
    mount(<FileTree documents={rows} activeId={null} sort="name-desc" {...h} />);
    expect(titles()).toEqual(["Stray", "Beta", "Alpha"]);
  });

  it("opens folders that arrive after it mounts", () => {
    const h = handlers();
    const { rerender } = mount(<FileTree documents={[]} activeId={null} {...h} />);
    rerender(<FileTree documents={DOCS} activeId={null} {...h} />);
    expect(bodyText()).toContain("Child");
  });

  function byTitle(title: string): HTMLElement {
    const span = [...document.querySelectorAll("span.flex-1")].find((s) => s.textContent === title);
    if (!span) throw new Error(`No row ${title}`);
    return span.parentElement as HTMLElement;
  }
});

describe("TopicStarterTree", () => {
  it("expands folders, selects files, filters by title and tag, and downloads", () => {
    const onSelect = vi.fn();
    const onDownload = vi.fn();
    mount(<TopicStarterTree items={TOPICS} onSelect={onSelect} onDownload={onDownload} />);
    expect(bodyText()).toContain("Solar Aff");

    click(button("Solar Aff"));
    expect(onSelect).toHaveBeenCalledWith(TOPICS[1]);

    click(button("Energy"));
    expect(bodyText()).not.toContain("Solar Aff");
    click(button("Energy"));

    change(document.querySelector("input")!, "nuclear");
    expect(bodyText()).toContain("Nuclear Neg");
    expect(bodyText()).not.toContain("Solar Aff");
    // By tag, too, though tags are no longer drawn on the row.
    change(document.querySelector("input")!, "aff");
    expect(bodyText()).toContain("Solar Aff");
    expect(bodyText()).not.toContain("Nuclear Neg");
    change(document.querySelector("input")!, "zzz");
    expect(bodyText()).not.toContain("Energy");
    // A word that only appears in a row's JSON (its keys) matches nothing.
    change(document.querySelector("input")!, "isfolder");
    expect(bodyText()).not.toContain("Energy");
    change(document.querySelector("input")!, "");

    const solarRow = button("Solar Aff").parentElement!;
    openMenu(solarRow.querySelectorAll("button")[1]);
    click(menuItem("Download as .docx"));
    expect(onDownload).toHaveBeenCalledWith(TOPICS[1]);
  });

  it("draws no format badge, and shows rows whose folder the capped catalogue left out", () => {
    const items: TopicStarterItem[] = [
      ...TOPICS,
      { id: 13, title: "Orphan Neg", content: "z", parentId: 404, isFolder: false, tags: '["cmir","public"]' },
    ];
    mount(<TopicStarterTree items={items} onSelect={() => {}} />);
    expect(bodyText()).toContain("Orphan Neg");
    expect(bodyText()).not.toContain("cmir");
  });

  it("offers save, edit-a-copy and copy-link on right-click, and takes files dropped from Files", () => {
    const h = { onSelect: vi.fn(), onSaveCopy: vi.fn(), onEditCopy: vi.fn(), onCopyLink: vi.fn(), onPublish: vi.fn() };
    mount(<TopicStarterTree items={TOPICS} {...h} />);
    const solar = button("Solar Aff").parentElement!;
    rightClick(solar);
    click(menuItem("Edit a copy"));
    expect(h.onEditCopy).toHaveBeenCalledWith(TOPICS[1]);
    rightClick(solar);
    click(menuItem("Save to my files"));
    expect(h.onSaveCopy).toHaveBeenCalledWith(TOPICS[1]);
    rightClick(solar);
    click(menuItem("Copy link"));
    expect(h.onCopyLink).toHaveBeenCalledWith(TOPICS[1]);
    rightClick(solar);
    click(menuItem("Open"));
    expect(h.onSelect).toHaveBeenCalledWith(TOPICS[1]);

    // A folder can be saved whole, but has nothing to open.
    rightClick(button("Energy").parentElement!);
    expect(allByText("Open", "[role=menuitem]")).toHaveLength(0);
    click(menuItem("Save to my files"));
    expect(h.onSaveCopy).toHaveBeenLastCalledWith(TOPICS[0]);

    // A drag carries the row out, and a file from Files dropped in is published.
    const setData = vi.fn();
    const start = new Event("dragstart", { bubbles: true });
    Object.defineProperty(start, "dataTransfer", { value: { setData } });
    act(() => {
      solar.dispatchEvent(start);
    });
    expect(setData).toHaveBeenCalledWith("text/topic-starter-id", "11");
    act(() => {
      button("Energy").parentElement!.dispatchEvent(dropEvent("drop", { id: 1 }));
    });
    expect(h.onPublish).toHaveBeenCalledWith(1, 10);
  });

  it("renames, deletes, adds folders and moves rows by drag when the host allows edits", () => {
    const items: TopicStarterItem[] = [...TOPICS, { id: 14, title: "Neg", content: "", parentId: null, isFolder: true, tags: "[]" }];
    const h = { onSelect: vi.fn(), onMove: vi.fn(), onRename: vi.fn(), onDelete: vi.fn(), onCreateFolder: vi.fn() };
    mount(<TopicStarterTree items={items} {...h} />);

    rightClick(button("Solar Aff").parentElement!);
    click(menuItem("Rename"));
    const input = document.querySelector<HTMLInputElement>("input[aria-label='Rename Solar Aff']")!;
    expect(input.value).toBe("Solar Aff");
    change(input, "Solar 1AC");
    keyDown(input, "Enter");
    expect(h.onRename).toHaveBeenCalledWith(11, "Solar 1AC");

    rightClick(button("Nuclear Neg").parentElement!);
    click(menuItem("Delete"));
    expect(h.onDelete).toHaveBeenCalledWith(12);

    rightClick(button("Energy").parentElement!);
    click(menuItem("New folder"));
    expect(h.onCreateFolder).toHaveBeenCalledWith(10);

    // A topic row dropped on another folder moves there; onto its own folder
    // (where it already is) or a folder into itself, nothing happens.
    act(() => {
      button("Neg").parentElement!.dispatchEvent(dropEvent("drop", { topicId: 12 }));
    });
    expect(h.onMove).toHaveBeenCalledWith(12, 14);
    act(() => {
      button("Energy").parentElement!.dispatchEvent(dropEvent("drop", { topicId: 11 }));
      button("Energy").parentElement!.dispatchEvent(dropEvent("drop", { topicId: 10 }));
    });
    expect(h.onMove).toHaveBeenCalledTimes(1);
  });

  it("offers no edit actions when the host passes none", () => {
    mount(<TopicStarterTree items={TOPICS} onSelect={() => {}} onSaveCopy={() => {}} />);
    rightClick(button("Solar Aff").parentElement!);
    expect(allByText("Rename", "[role=menuitem]")).toHaveLength(0);
    expect(allByText("Delete", "[role=menuitem]")).toHaveLength(0);
  });

  it("shows the empty catalogue", () => {
    mount(<TopicStarterTree items={[]} onSelect={() => {}} />);
    expect(bodyText()).toContain("No public topic starters yet.");
  });
});

describe("ReasonDocsSidebarPanels", () => {
  it("loads on mount and shows Topic Starters above My Personal Documents, with no Open Tabs", () => {
    const docs = makeDocs();
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels fill />);
    expect(docs.ensureLoaded).toHaveBeenCalled();
    const text = bodyText();
    expect(text).not.toContain("Open Tabs");
    expect(text.indexOf("Topic Starters")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("Topic Starters")).toBeLessThan(text.indexOf("My Personal Documents"));
    expect(text).toContain("Solar Aff");
    expect(text).toContain("Case.docx");
  });

  it("routes a picked file to the editor", () => {
    const docs = makeDocs();
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels />);
    const childRow = [...document.querySelectorAll("span.flex-1")].find((s) => s.textContent === "Child")!.parentElement!;
    click(childRow);
    expect(docs.openDocument).toHaveBeenCalledWith(3);
    expect(nav.push).toHaveBeenCalledWith("/reason-editor?doc=folder/child");
  });

  it("replaces the URL in place on the editor route and offers sharing", () => {
    nav.pathname = "/reason-editor";
    const docs = makeDocs();
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels />);
    const childRow = [...document.querySelectorAll("span.flex-1")].find((s) => s.textContent === "Child")!.parentElement!;
    click(childRow);
    expect(nav.replace).toHaveBeenCalledWith("/reason-editor?doc=folder/child");
    expect(document.querySelector("button[aria-label='Share with contacts']")).not.toBeNull();

    click(document.querySelector("button[title='New document']")!);
    expect(docs.createDocument).toHaveBeenCalledWith(null, false);
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("creates documents and folders from the header row", () => {
    const docs = makeDocs();
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels />);
    click(document.querySelector("button[title='New document']")!);
    expect(docs.createDocument).toHaveBeenCalledWith(null, false);
    expect(nav.push).toHaveBeenCalledWith("/reason-editor");
    click(document.querySelector("button[title='New folder']")!);
    expect(docs.createDocument).toHaveBeenCalledWith(null, true);
    expect(docs.createDocument).toHaveBeenCalledTimes(2);
  });

  it("collapses each section on its own and remembers it", () => {
    const docs = makeDocs();
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels />);
    click(button("Topic Starters"));
    expect(button("Topic Starters").getAttribute("aria-expanded")).toBe("false");
    expect(localStorage.getItem("reason-editor-sidebar-topics-open")).toBe("false");
    expect(bodyText()).not.toContain("Solar Aff");
    expect(bodyText()).toContain("Case.docx");
    cleanup();

    mount(<ReasonDocsSidebarPanels />);
    expect(button("Topic Starters").getAttribute("aria-expanded")).toBe("false");
    click(button("My Personal Documents"));
    expect(localStorage.getItem("reason-editor-sidebar-files-open")).toBe("false");
    expect(bodyText()).not.toContain("Case.docx");
    expect(document.querySelector("button[title='New document']")).toBeNull();
  });

  it("fetches nothing while both sections are collapsed", () => {
    localStorage.setItem("reason-editor-sidebar-topics-open", "false");
    localStorage.setItem("reason-editor-sidebar-files-open", "false");
    const docs = makeDocs();
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels />);
    expect(docs.ensureLoaded).not.toHaveBeenCalled();
  });

  it("selects topic starters and shows download failures", async () => {
    const docs = makeDocs({
      downloadDocument: vi.fn(async () => ({ ok: false, error: "Case could not be downloaded (x)." })),
      downloadTopicDocument: vi.fn(async () => ({ ok: false, error: "Solar Aff could not be downloaded (y)." })),
    });
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels />);
    click(button("Solar Aff"));
    expect(docs.selectTopicDocument).toHaveBeenCalledWith(TOPICS[1]);
    expect(nav.push).toHaveBeenCalledWith("/docs/vcx27/energy/solar-aff");

    openMenu(button("Solar Aff").parentElement!.querySelectorAll("button")[1]);
    click(menuItem("Download as .docx"));
    await flush();
    expect(bodyText()).toContain("Solar Aff could not be downloaded (y).");

    const caseRow = [...document.querySelectorAll("span.flex-1")].find((s) => s.textContent === "Case.docx")!.parentElement!;
    openMenu(caseRow.querySelector("button")!);
    click(menuItem("Download as .docx"));
    await flush();
    expect(bodyText()).toContain("Case could not be downloaded (x).");
  });

  it("uploads files from the hidden input, reports failures and opens the first import", async () => {
    const created = [doc({ id: 50, title: "Imported.docx" })];
    const docs = makeDocs({ importFiles: vi.fn(async () => ({ created, failures: ["bad.pdf is not supported."] })) });
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels />);
    const input = document.querySelector<HTMLInputElement>("input[type=file]")!;
    const file = new File(["x"], "Imported.docx");
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    act(() => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();
    expect(docs.importFiles).toHaveBeenCalledWith([file], null);
    expect(bodyText()).toContain("bad.pdf is not supported.");
    expect(nav.push).toHaveBeenCalledWith("/reason-editor?doc=imported");
  });

  it("copies a topic starter dropped on Files, and publishes a file dropped on Topic Starters", async () => {
    const docs = makeDocs();
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels />);
    const folderRow = [...document.querySelectorAll("span.flex-1")].find((el) => el.textContent === "Folder")!.parentElement!;
    act(() => {
      folderRow.dispatchEvent(dropEvent("drop", { topicId: 11 }));
    });
    await flush();
    expect(docs.copyTopicToDocuments).toHaveBeenCalledWith(TOPICS[1], 2);
    expect(toast.success).toHaveBeenCalledWith("Saved Solar Aff to your files.");

    act(() => {
      button("Energy").parentElement!.dispatchEvent(dropEvent("drop", { id: 1 }));
    });
    await flush();
    expect(docs.publishToTopics).toHaveBeenCalledWith(1, 10);
    expect(toast.success).toHaveBeenLastCalledWith("Added Case.docx to Topic Starters.");
  });

  it("explains a publish the server refuses and a copy that fails", async () => {
    const docs = makeDocs({
      publishToTopics: vi.fn(async () => ({ ok: false, error: "Only admins can add files to Topic Starters." })),
      copyTopicToDocuments: vi.fn(async () => ({ ok: false, error: "Energy could not be copied (x)." })),
    });
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels />);
    const caseRow = [...document.querySelectorAll("span.flex-1")].find((el) => el.textContent === "Case.docx")!.parentElement!;
    rightClick(caseRow);
    click(menuItem("Add to Topic Starters"));
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Only admins can add files to Topic Starters.");

    rightClick(button("Energy").parentElement!);
    click(menuItem("Save to my files"));
    await flush();
    expect(toast.error).toHaveBeenLastCalledWith("Energy could not be copied (x).");
  });

  it("sends Topic Starters edits and says when they went to the moderators", async () => {
    const docs = makeDocs();
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels />);
    rightClick(button("Nuclear Neg").parentElement!);
    click(menuItem("Delete"));
    await flush();
    expect(docs.deleteTopicStarter).toHaveBeenCalledWith(12);
    expect(toast.success).toHaveBeenLastCalledWith("Delete Nuclear Neg? Sent to the moderators for approval.");

    rightClick(button("Solar Aff").parentElement!);
    click(menuItem("Rename"));
    const input = document.querySelector<HTMLInputElement>("input[aria-label='Rename Solar Aff']")!;
    change(input, "Solar 1AC");
    keyDown(input, "Enter");
    await flush();
    expect(docs.renameTopicStarter).toHaveBeenCalledWith(11, "Solar 1AC");
    expect(toast.success).toHaveBeenLastCalledWith("Renamed to Solar 1AC.");
  });

  it("proposes an AI organization by argument and sends it on confirm", async () => {
    const docs = makeDocs();
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels />);
    await act(async () => {
      document.querySelector<HTMLButtonElement>("button[aria-label='Organize by argument']")!.click();
    });
    await flush();
    expect(docs.organizeTopicStarters).toHaveBeenCalled();
    expect(bodyText()).toContain("Organize 1 file by argument (Aff/Case 1)");
    expect(docs.proposeTopicChange).not.toHaveBeenCalled();
    click(button("Send for approval"));
    await flush();
    expect(docs.proposeTopicChange).toHaveBeenCalledWith({ kind: "reorganize", assignments: [{ itemId: 11, side: "aff", type: "case" }] });
    expect(toast.success).toHaveBeenLastCalledWith("Reorganization sent to the moderators for approval.");
  });

  it("hides Topic Starters edits from a signed-out reader", () => {
    session.value = { isAuthenticated: false };
    docsState.value = makeDocs();
    mount(<ReasonDocsSidebarPanels />);
    expect(document.querySelector("button[aria-label='Organize by argument']")).toBeNull();
    rightClick(button("Solar Aff").parentElement!);
    expect(allByText("Rename", "[role=menuitem]")).toHaveLength(0);
  });

  it("edits a copy of a topic starter by opening the copy", async () => {
    const docs = makeDocs();
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels />);
    rightClick(button("Solar Aff").parentElement!);
    click(menuItem("Edit a copy"));
    await flush();
    expect(docs.copyTopicToDocuments).toHaveBeenCalledWith(TOPICS[1], null);
    expect(docs.openDocument).toHaveBeenCalledWith(60);
    expect(nav.push).toHaveBeenCalledWith("/reason-editor?doc=solar-aff");
  });

  it("copies a topic starter's public link", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    docsState.value = makeDocs();
    mount(<ReasonDocsSidebarPanels />);
    rightClick(button("Solar Aff").parentElement!);
    click(menuItem("Copy link"));
    await flush();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/docs/vcx27/energy/solar-aff`);
    expect(toast.success).toHaveBeenCalledWith("Link copied.");
  });

  it("shares a file from its menu by opening it with the share dialog up", () => {
    const docs = makeDocs();
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels />);
    const childRow = [...document.querySelectorAll("span.flex-1")].find((el) => el.textContent === "Child")!.parentElement!;
    rightClick(childRow);
    click(menuItem("Share…"));
    expect(docs.openDocument).toHaveBeenCalledWith(3);
    expect(nav.push).toHaveBeenCalledWith("/reason-editor?doc=folder/child&shareOpen=1");

    rightClick(childRow);
    click(menuItem("Duplicate"));
    expect(docs.duplicateDocument).toHaveBeenCalledWith(3, undefined);
  });

  it("sorts the tree from the Files header and remembers the order", () => {
    localStorage.setItem("reason-editor-sidebar-sort", "name-desc");
    docsState.value = makeDocs();
    mount(<ReasonDocsSidebarPanels />);
    const sortButton = document.querySelector("button[aria-label='Sort files']")!;
    expect(sortButton.getAttribute("title")).toBe("Sort: Name (Z–A)");
    openMenu(sortButton);
    click(menuItem("Last modified"));
    expect(localStorage.getItem("reason-editor-sidebar-sort")).toBe("updated");
    expect(document.querySelector("button[aria-label='Sort files']")!.getAttribute("title")).toBe("Sort: Last modified");
  });

  it("shows a spinner while loading", () => {
    docsState.value = makeDocs({ loading: true });
    mount(<ReasonDocsSidebarPanels />);
    expect(bodyText()).not.toContain("Open Tabs");
    expect(document.querySelector(".animate-spin")).not.toBeNull();
  });
});

const CONTACTS = [
  { user: { id: "u2", name: "Zed", email: "zed@x.dev" }, online: false },
  { user: { id: "u1", name: "Bea", email: "bea@x.dev" }, online: true },
];

describe("ShareWithContacts", () => {
  beforeEach(() => {
    docsState.value = makeDocs();
  });

  it("renders nothing when signed out", () => {
    session.value = { isAuthenticated: false, user: null };
    mount(<ShareWithContacts title="Case" />);
    expect(document.body.innerHTML).toBe("<div></div>");
  });

  it("points to the contacts page when there are no contacts", () => {
    mount(<ShareWithContacts title="" />);
    click(button("Share with contacts"));
    expect(bodyText()).toContain("Starts a live co-editing session on “Untitled”");
    click(button("Add some"));
    expect(nav.push).toHaveBeenCalledWith("/contacts");
    click(button("Manage contacts"));
    expect(nav.push).toHaveBeenCalledTimes(2);
  });

  it("shares a new session with the picked contacts", async () => {
    team.contacts = CONTACTS;
    team.share.mockResolvedValue({ shared: [{}, {}], skipped: [{}] });
    mount(<ShareWithContacts title="Case" variant="icon" />);
    click(document.querySelector("button[aria-label='Share with contacts']")!);
    const names = [...document.querySelectorAll("label .truncate")].map((el) => el.textContent);
    expect(names).toEqual(["Bea", "Zed"]);
    expect(bodyText()).toContain("Online now");
    expect(bodyText()).toContain("Away");
    expect(button("Share").disabled).toBe(true);

    click(document.querySelector("input[aria-label='Share with Bea']")!);
    click(document.querySelector("input[aria-label='Share with Zed']")!);
    click(document.querySelector("input[aria-label='Share with Zed']")!);
    click(document.querySelector("input[aria-label='Share with Zed']")!);
    change(document.querySelector("input[aria-label='Note to send with the share']")!, "Look at this");
    click(button("Share with 2"));
    await flush();

    expect(bridge.startCollabSession).toHaveBeenCalled();
    expect(team.share).toHaveBeenCalledWith({
      shareCode: "cmshare1",
      guestPass: "pass1",
      title: "Case",
      message: "Look at this",
      recipientIds: ["u1", "u2"],
    });
    expect(toast.success).toHaveBeenCalledWith("Shared with 2 contacts.");
    expect(toast.warning).toHaveBeenCalledWith("1 recipient(s) couldn't be shared with (not a contact, or blocked).");
    expect(bodyText()).not.toContain("Online now");
  });

  it("reuses an active session and reports single shares", async () => {
    team.contacts = CONTACTS;
    bridge.activeCollabShare.mockReturnValue({ shareCode: "existing", guestPass: "gp" });
    team.share.mockResolvedValue({ shared: [{}], skipped: [] });
    mount(<ShareWithContacts title="Case" />);
    click(button("Share with contacts"));
    click(document.querySelector("input[aria-label='Share with Bea']")!);
    click(button("Share with 1"));
    await flush();
    expect(bridge.startCollabSession).not.toHaveBeenCalled();
    expect(team.share.mock.calls[0][0].shareCode).toBe("existing");
    expect(toast.success).toHaveBeenCalledWith("Shared — it's now available on their account.");
  });

  it("explains why nothing was shared", async () => {
    team.contacts = CONTACTS;
    mount(<ShareWithContacts title="Case" />);
    click(button("Share with contacts"));
    click(document.querySelector("input[aria-label='Share with Bea']")!);

    bridge.collabAvailable.mockReturnValueOnce(false);
    click(button("Share with 1"));
    await flush();
    expect(toast.error).toHaveBeenLastCalledWith("Live co-editing needs the desktop layout — open this on a computer.");

    bridge.startCollabSession.mockResolvedValueOnce(null);
    click(button("Share with 1"));
    await flush();
    expect(toast.error).toHaveBeenLastCalledWith("No co-editing session was started, so nothing was shared.");

    team.share.mockRejectedValueOnce(new Error("Server said no"));
    click(button("Share with 1"));
    await flush();
    expect(toast.error).toHaveBeenLastCalledWith("Server said no");

    team.share.mockRejectedValueOnce("weird");
    click(button("Share with 1"));
    await flush();
    expect(toast.error).toHaveBeenLastCalledWith("Could not share this card.");
  });

  it("opens from ?shareOpen=1 with nobody picked, and strips the parameter", () => {
    nav.search = new URLSearchParams("doc=case&shareOpen=1");
    window.history.replaceState(null, "", "/reason-editor?doc=case&shareOpen=1");
    mount(<ShareWithContacts title="Case" />);
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
    expect(window.location.search).toBe("?doc=case");
  });

  it("opens preselected from ?shareWith= and strips the parameter", () => {
    team.contacts = CONTACTS;
    window.history.replaceState(null, "", "/reason-editor/Case?shareWith=u2&x=1");
    nav.search = new URLSearchParams("shareWith=u2&x=1");
    mount(<ShareWithContacts title="Case" />);
    expect(document.querySelector<HTMLInputElement>("input[aria-label='Share with Zed']")!.checked).toBe(true);
    expect(window.location.search).toBe("?x=1");
    expect(window.location.pathname).toBe("/reason-editor/Case");
  });

  it("joins a card opened from the share toast into a fresh document", async () => {
    const docs = makeDocs();
    docs.createDocument = vi.fn(async () => {
      docs.activeId = 77;
      docsState.value = { ...docs };
    });
    docsState.value = docs;
    const { rerender } = mount(<ShareWithContacts title="Case" />);
    const share = { id: 5, title: "Shared Case", shareCode: "c", guestPass: "g", user: { name: "", email: "bea@x.dev" } };
    act(() => team.onOpen!(share));
    rerender(<ShareWithContacts title="Case" />);
    await vi.waitFor(() => expect(bridge.joinCollabShare).toHaveBeenCalledWith("c", "g"));
    await flush();
    expect(toast.loading).toHaveBeenCalledWith('Opening "Shared Case" from bea@x.dev…');
    expect(docs.updateTitle).toHaveBeenCalledWith(77, "Shared Case");
    expect(toast.success).toHaveBeenCalledWith('Joined "Shared Case"');
    expect(team.markCardShareOpened).toHaveBeenCalledWith(5);
    expect(toast.dismiss).toHaveBeenCalledWith("toast-id");
  });
});

describe("SharedCardOpener", () => {
  it("seeds the presence name and joins the share named in ?share=", async () => {
    const docs = makeDocs({ activeId: null });
    docs.createDocument = vi.fn(async () => {
      docsState.value = { ...docs, activeId: 9 };
    });
    docsState.value = docs;
    window.history.replaceState(null, "", "/reason-editor?share=5");
    nav.search = new URLSearchParams("share=5");
    team.fetchCardShares.mockResolvedValue({
      received: [{ id: 5, title: "Room", shareCode: "rc", guestPass: "rg", user: { name: "Bea", email: "bea@x.dev" } }],
    });
    bridge.collabAvailable.mockReturnValue(false);
    const { rerender } = mount(<SharedCardOpener />);
    await flush();
    rerender(<SharedCardOpener />);
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("Live co-editing needs the desktop layout — open this on a computer."));
    expect(bridge.seedCollabDisplayName).toHaveBeenCalledWith("Ada");
    expect(window.location.search).toBe("");
    expect(toast.loading).toHaveBeenCalledWith('Opening "Room" from Bea…');
  });

  it("reports a share that is gone", async () => {
    docsState.value = makeDocs();
    nav.search = new URLSearchParams("share=404");
    team.fetchCardShares.mockResolvedValue({ received: [] });
    mount(<SharedCardOpener />);
    await flush();
    expect(toast.error).toHaveBeenCalledWith("That shared card is no longer available.");
  });

  it("does nothing while signed out", async () => {
    session.value = { isAuthenticated: false, user: null };
    docsState.value = makeDocs();
    nav.search = new URLSearchParams("share=5");
    mount(<SharedCardOpener />);
    await flush();
    expect(team.fetchCardShares).not.toHaveBeenCalled();
    expect(bridge.seedCollabDisplayName).not.toHaveBeenCalled();
  });
});
