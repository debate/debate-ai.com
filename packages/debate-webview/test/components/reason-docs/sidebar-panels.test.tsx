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
vi.mock("../../../src/components/reason-docs/ReasonDocsProvider", () => ({
  useReasonDocs: () => docsState.value,
}));

const session = vi.hoisted(() => ({ value: { isAuthenticated: true, user: { name: "Ada" } } as Record<string, unknown> }));
vi.mock("../../../src/lib/hooks/useSession", () => ({ useSession: () => session.value }));

const team = vi.hoisted(() => ({
  contacts: [] as unknown[],
  share: vi.fn(),
  onOpen: undefined as undefined | ((share: unknown) => void),
  fetchCardShares: vi.fn(),
  markCardShareOpened: vi.fn(),
}));
vi.mock("@debate/team-collaboration", () => ({
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
vi.mock("@debate/editor/collab-bridge", () => bridge);

const toast = vi.hoisted(() => ({
  loading: vi.fn(() => "toast-id"),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

import { ReasonDocsSidebarPanels } from "../../../src/components/reason-docs/ReasonDocsSidebarPanels";
import { FileTree } from "../../../src/components/reason-docs/FileTree";
import { OpenTabsPanel } from "../../../src/components/reason-docs/OpenTabsPanel";
import { TopicStarterTree, type TopicStarterItem } from "../../../src/components/reason-docs/TopicStarterTree";
import { SharedCardOpener, ShareWithContacts } from "../../../src/components/reason-editor/ShareWithContacts";
import type { ReasonDocument } from "../../../src/components/reason-docs/types";
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
} from "../../helpers/dom";

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

function dropEvent(type: string, data: { files?: File[]; id?: number }) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: {
      files: data.files ?? [],
      getData: (key: string) => (key === "text/reason-document-id" && data.id ? String(data.id) : ""),
      setData: vi.fn(),
    },
  });
  return event;
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

  it("selects files, toggles folders and badges imported files", () => {
    const h = handlers();
    mount(<FileTree documents={DOCS} activeId={1} {...h} />);
    expect(bodyText()).toContain("Child");
    expect(bodyText()).toContain("DOCX");

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

  function byTitle(title: string): HTMLElement {
    const span = [...document.querySelectorAll("span.flex-1")].find((s) => s.textContent === title);
    if (!span) throw new Error(`No row ${title}`);
    return span.parentElement as HTMLElement;
  }
});

describe("OpenTabsPanel", () => {
  it("lists tabs and selects or closes them", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    mount(<OpenTabsPanel documents={DOCS} openTabs={[1, 99]} activeId={1} onSelect={onSelect} onClose={onClose} />);
    expect(bodyText()).toContain("Case.docx");
    expect(bodyText()).toContain("Untitled");
    click(allByText("Untitled", "div.group")[0]);
    expect(onSelect).toHaveBeenCalledWith(99);
    click(allByText("Case.docx", "div.group")[0].querySelector("button")!);
    expect(onClose).toHaveBeenCalledWith(1);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state", () => {
    mount(<OpenTabsPanel documents={[]} openTabs={[]} activeId={null} onSelect={() => {}} onClose={() => {}} />);
    expect(bodyText()).toContain("No open tabs. Select a file to open it.");
  });
});

describe("TopicStarterTree", () => {
  it("expands folders, selects files, filters by title and tag, and downloads", () => {
    const onSelect = vi.fn();
    const onDownload = vi.fn();
    mount(<TopicStarterTree items={TOPICS} onSelect={onSelect} onDownload={onDownload} />);
    expect(bodyText()).toContain("Solar Aff");
    expect(bodyText()).toContain("aff");

    click(button("Solar Aff"));
    expect(onSelect).toHaveBeenCalledWith(TOPICS[1]);

    click(button("Energy"));
    expect(bodyText()).not.toContain("Solar Aff");
    click(button("Energy"));

    change(document.querySelector("input")!, "nuclear");
    expect(bodyText()).toContain("Nuclear Neg");
    expect(bodyText()).not.toContain("Solar Aff");
    change(document.querySelector("input")!, "zzz");
    expect(bodyText()).not.toContain("Energy");
    change(document.querySelector("input")!, "");

    const solarRow = button("Solar Aff").parentElement!;
    openMenu(solarRow.querySelectorAll("button")[1]);
    click(menuItem("Download as .docx"));
    expect(onDownload).toHaveBeenCalledWith(TOPICS[1]);
  });

  it("shows the empty catalogue", () => {
    mount(<TopicStarterTree items={[]} onSelect={() => {}} />);
    expect(bodyText()).toContain("No public topic starters yet.");
  });
});

describe("ReasonDocsSidebarPanels", () => {
  it("loads on mount and shows the files and open-tabs panels", () => {
    const docs = makeDocs();
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels fill />);
    expect(docs.ensureLoaded).toHaveBeenCalled();
    const text = bodyText();
    expect(text).toContain("Files");
    expect(text).toContain("Open Tabs (2)");
    expect(text).not.toContain("Topic Starters");
  });

  it("routes a picked file and tab to the editor", () => {
    const docs = makeDocs();
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels />);
    const childRow = [...document.querySelectorAll("span.flex-1")].find((s) => s.textContent === "Child")!.parentElement!;
    click(childRow);
    expect(docs.openDocument).toHaveBeenCalledWith(3);
    expect(nav.push).toHaveBeenCalledWith("/reason-editor?doc=folder/child");

    const tab = allByText("Case.docx", "div.group").find((el) => el.className.includes("mx-1"))!;
    click(tab);
    expect(docs.selectTab).toHaveBeenCalledWith(1);
    expect(nav.push).toHaveBeenLastCalledWith("/reason-editor?doc=case");
  });

  it("replaces the URL in place on the editor route and offers sharing", () => {
    nav.pathname = "/reason-editor";
    const docs = makeDocs();
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels />);
    const tab = allByText("Child", "div.group").find((el) => el.className.includes("mx-1"))!;
    click(tab);
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
    click(document.querySelector("button[title='New File']")!);
    expect(docs.createDocument).toHaveBeenCalledTimes(3);
  });

  it("toggles panels, keeping at least one, and remembers the choice", () => {
    docsState.value = makeDocs();
    mount(<ReasonDocsSidebarPanels />);
    click(button("Topics"));
    expect(bodyText()).toContain("Topic Starters");
    expect(JSON.parse(localStorage.getItem("reason-editor-sidebar-panels")!)).toEqual(["files", "openTabs", "topicStarters"]);

    click(button("Files"));
    click(button(/Tabs/));
    click(button("Topics"));
    // The last panel cannot be switched off.
    expect(button("Topics").getAttribute("aria-pressed")).toBe("true");
    expect(JSON.parse(localStorage.getItem("reason-editor-sidebar-panels")!)).toEqual(["topicStarters"]);
  });

  it("restores stored panels and collapse state, and collapses on demand", () => {
    localStorage.setItem("reason-editor-sidebar-panels", JSON.stringify(["topicStarters", "bogus"]));
    localStorage.setItem("reason-editor-sidebar-layout", JSON.stringify({ topicStarters: 50 }));
    const docs = makeDocs();
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels />);
    expect(bodyText()).toContain("Topic Starters");
    expect(bodyText()).not.toContain("Open Tabs");

    click(button("Documents"));
    expect(localStorage.getItem("reason-editor-sidebar-open")).toBe("false");
    expect(bodyText()).not.toContain("Topic Starters");
    cleanup();

    mount(<ReasonDocsSidebarPanels />);
    expect(button("Documents").getAttribute("aria-expanded")).toBe("false");
  });

  it("selects topic starters and shows download failures", async () => {
    localStorage.setItem("reason-editor-sidebar-panels", JSON.stringify(["files", "topicStarters"]));
    const docs = makeDocs({
      downloadDocument: vi.fn(async () => ({ ok: false, error: "Case could not be downloaded (x)." })),
      downloadTopicDocument: vi.fn(async () => ({ ok: false, error: "Solar Aff could not be downloaded (y)." })),
    });
    docsState.value = docs;
    mount(<ReasonDocsSidebarPanels />);
    click(button("Solar Aff"));
    expect(docs.selectTopicDocument).toHaveBeenCalledWith(TOPICS[1]);
    expect(nav.push).toHaveBeenCalledWith("/reason-editor?topic=energy/solar-aff");

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
