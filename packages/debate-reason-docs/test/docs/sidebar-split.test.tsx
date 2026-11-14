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

import { ReasonDocsSidebarPanels, topicSplitFromPointer } from "../../src/docs/ReasonDocsSidebarPanels";
import { TopicStarterTree, type TopicStarterItem } from "../../src/docs/topic-starters/TopicStarterTree";
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

const SPLIT_KEY = "reason-editor-sidebar-topic-split";

/** Lays the two sections out as jsdom can't: Topic Starters from y=100 down
 *  to the files section's bottom at y=500. */
function fakeLayout() {
  const topics = document.querySelector<HTMLElement>('[data-sidebar-section="topics"]')!;
  const files = document.querySelector<HTMLElement>('[data-sidebar-section="files"]')!;
  topics.getBoundingClientRect = () => ({ top: 100, bottom: 300, height: 200 }) as DOMRect;
  files.getBoundingClientRect = () => ({ top: 300, bottom: 500, height: 200 }) as DOMRect;
  return { topics, files };
}

function pointer(target: EventTarget, type: string, clientY: number, pointerType = "mouse") {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY, button: 0 });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  act(() => {
    target.dispatchEvent(event);
  });
}

function handle() {
  return document.querySelector<HTMLElement>("[data-topic-split-handle]")!;
}

describe("topicSplitFromPointer", () => {
  it("measures across both sections, not the 8px handle", () => {
    expect(topicSplitFromPointer(200, 100, 500, 0.5)).toBeCloseTo(0.25);
    expect(topicSplitFromPointer(400, 100, 500, 0.5)).toBeCloseTo(0.75);
  });
  it("clamps so neither section disappears", () => {
    expect(topicSplitFromPointer(0, 100, 500, 0.5)).toBe(0.1);
    expect(topicSplitFromPointer(900, 100, 500, 0.5)).toBe(0.9);
  });
  it("keeps the split while nothing is laid out", () => {
    expect(topicSplitFromPointer(200, 0, 0, 0.4)).toBe(0.4);
  });
});

describe("Topic Starters / My Personal Documents resizer", () => {
  it("starts 50/50 on a first visit", () => {
    docsState.value = makeDocs();
    mount(<ReasonDocsSidebarPanels fill />);
    const { topics, files } = fakeLayout();
    expect(topics.style.flex).toBe("0.5 1 0px");
    expect(files.style.flex).toBe("0.5 1 0px");
    expect(handle().getAttribute("aria-valuenow")).toBe("50");
  });

  it.each(["mouse", "touch"])("resizes the sections on a %s drag and remembers the split", (pointerType) => {
    docsState.value = makeDocs();
    mount(<ReasonDocsSidebarPanels fill />);
    const { topics, files } = fakeLayout();

    pointer(handle(), "pointerdown", 300, pointerType);
    // Moves land on the document, so the drag survives leaving the bar.
    pointer(document, "pointermove", 200, pointerType);
    expect(topics.style.flex).toBe("0.25 1 0px");
    expect(files.style.flex).toBe("0.75 1 0px");
    pointer(document, "pointermove", 420, pointerType);
    expect(topics.style.flex).toBe("0.8 1 0px");
    expect(files.style.flex).toBe("0.2 1 0px");
    pointer(document, "pointerup", 420, pointerType);
    expect(localStorage.getItem(SPLIT_KEY)).toBe("0.8");

    // Once released, moving the pointer no longer resizes anything.
    pointer(document, "pointermove", 150, pointerType);
    expect(topics.style.flex).toBe("0.8 1 0px");

    // A second drag works as well as the first.
    pointer(handle(), "pointerdown", 420, pointerType);
    pointer(document, "pointermove", 300, pointerType);
    pointer(document, "pointerup", 300, pointerType);
    expect(topics.style.flex).toBe("0.5 1 0px");
    expect(localStorage.getItem(SPLIT_KEY)).toBe("0.5");
  });

  it("restores the saved split on reload", () => {
    localStorage.setItem(SPLIT_KEY, "0.3");
    docsState.value = makeDocs();
    mount(<ReasonDocsSidebarPanels fill />);
    const { topics, files } = fakeLayout();
    expect(topics.style.flex).toBe("0.3 1 0px");
    expect(files.style.flex).toBe("0.7 1 0px");
  });

  it("moves with the arrow keys", () => {
    docsState.value = makeDocs();
    mount(<ReasonDocsSidebarPanels fill />);
    const { topics } = fakeLayout();
    act(() => {
      handle().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    expect(topics.style.flex).toBe("0.55 1 0px");
    expect(Number(localStorage.getItem(SPLIT_KEY))).toBeCloseTo(0.55);
  });

  it("has no handle unless the two sections share the column", () => {
    docsState.value = makeDocs();
    mount(<ReasonDocsSidebarPanels />);
    expect(document.querySelector("[data-topic-split-handle]")).toBeNull();
  });
});
