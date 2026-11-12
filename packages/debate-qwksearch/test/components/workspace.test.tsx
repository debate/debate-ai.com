/** @vitest-environment jsdom */
/**
 * @fileoverview The research workspace shell: restoring the open tab from
 * the URL (a named document path, the legacy `?docs=`, or `?chat=`),
 * mirroring the active tab back into the address bar, opening, adding and
 * closing chat tabs, sending a clicked topic as a new chat's first message,
 * the AI tips/topics hooks and the dock's "open sidebar" event.
 */
import { act, useSyncExternalStore } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// A tiny external store standing in for research-agent-ui's ChatProvider, so
// starting or switching a chat re-renders the workspace like the real one.
const chat = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const store = {
    state: { chatId: null as string | null, chatTurns: [] as { content: string }[] },
    set(patch: Partial<{ chatId: string | null; chatTurns: { content: string }[] }>) {
      store.state = { ...store.state, ...patch };
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    startNewChat: vi.fn((id: string) => store.set({ chatId: id, chatTurns: [] })),
    switchToChat: vi.fn((id: string) => store.set({ chatId: id })),
    sendMessage: vi.fn(),
    configure: vi.fn(),
  };
  return store;
});

const nav = vi.hoisted(() => ({ pathname: "/research/docs", search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("research-agent-ui", () => ({
  useChat: () => {
    const state = useSyncExternalStore(chat.subscribe, () => chat.state);
    return { ...state, startNewChat: chat.startNewChat, switchToChat: chat.switchToChat, sendMessage: chat.sendMessage };
  },
  configureResearchAgentUI: chat.configure,
  ChatInputBox: () => <div data-testid="chat-input" />,
  ChatWindow: () => <div data-testid="chat-window" />,
}));

const docs = vi.hoisted(() => ({ props: null as null | Record<string, any> }));
vi.mock("react-reason-editor/reason-docs", () => ({
  ReasonDocs: (props: Record<string, any>) => {
    docs.props = props;
    return (
      <div data-testid="reason-docs" data-signal={props.openFilesSidebarSignal}>
        {props.mainContent}
        {props.belowMainContent}
      </div>
    );
  },
}));
vi.mock("react-reason-editor-sidebar", () => ({ Sidebar: () => null, SidebarContent: () => null }));
const theme = vi.hoisted(() => ({ setColor: vi.fn(), setLang: vi.fn() }));
vi.mock("react-reason-editor/theme", () => ({ themeActions: { setColor: theme.setColor } }));
vi.mock("react-reason-editor/locale-bundle", () => ({ localeActions: { setLang: theme.setLang } }));
vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("katex/contrib/mhchem", () => ({}));
vi.mock("easydrawer/styles.css", () => ({}));
vi.mock("../../src/components/reason-editor.css", () => ({}));
const grab = vi.hoisted(() => vi.fn());
vi.mock("grab-url", () => ({ default: grab }));

import { QwksearchWorkspace } from "../../src/components/Workspace";
import { MainViewProvider, useMainView } from "../../src/components/MainViewProvider";
import { OPEN_OWN_SIDEBAR_EVENT } from "../../src/lib/open-sidebar-event";
import { cleanup, flush, installDomShims, mount } from "../helpers/dom";

beforeAll(installDomShims);
beforeEach(() => {
  localStorage.clear();
  chat.state = { chatId: null, chatTurns: [] };
  nav.pathname = "/research/docs";
  nav.search = "";
  window.history.replaceState(null, "", "/research/docs");
  docs.props = null;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function View() {
  return <span data-testid="view">{useMainView().activeView}</span>;
}

async function render() {
  mount(
    <MainViewProvider>
      <View />
      <QwksearchWorkspace />
    </MainViewProvider>,
  );
  await flush();
}

const view = () => document.querySelector('[data-testid="view"]')!.textContent;
const props = () => docs.props!;

describe("QwksearchWorkspace", () => {
  it("opens on the research view with the chat window and sets the editor locale", async () => {
    await render();
    expect(view()).toBe("research");
    expect(document.querySelector('[data-testid="chat-window"]')).not.toBeNull();
    expect(theme.setLang).toHaveBeenCalledWith("en");
    expect(theme.setColor).toHaveBeenCalledWith("default");
    expect(chat.configure).toHaveBeenCalledWith({ onOpenChat: expect.any(Function) });
  });

  it("restores a named document from the path", async () => {
    localStorage.setItem("REASON-documents", JSON.stringify([{ id: "d1", title: "Cap Answers" }]));
    nav.pathname = "/research/docs/cap-answers";
    window.history.replaceState(null, "", "/research/docs/cap-answers");
    await render();
    expect(view()).toBe("docs");
    expect(props().initialDocId).toBe("d1");
    expect(document.querySelector('[data-testid="chat-input"]')).not.toBeNull();
    // Until the editor reports the document open, the incoming path is kept.
    expect(window.location.pathname).toBe("/research/docs/cap-answers");

    act(() => props().onActiveDocumentChange("d1"));
    expect(window.location.pathname).toBe("/research/docs/cap-answers");
    act(() => props().onActiveDocumentChange(null));
    expect(window.location.pathname).toBe("/research/docs");
  });

  it("rewrites a legacy ?docs= link to the document's path", async () => {
    localStorage.setItem("REASON-documents", JSON.stringify([{ id: "d2", title: "K Aff" }]));
    nav.search = "docs=d2";
    window.history.replaceState(null, "", "/research/docs?docs=d2");
    await render();
    expect(props().initialDocId).toBe("d2");
    act(() => props().onActiveDocumentChange("d2"));
    expect(window.location.pathname + window.location.search).toBe("/research/docs/k-aff");
  });

  it("restores a chat from ?chat= and keeps it in the URL", async () => {
    nav.search = "chat=c1";
    await render();
    expect(chat.switchToChat).toHaveBeenCalledWith("c1");
    expect(view()).toBe("research");
    expect(window.location.search).toBe("?chat=c1");
    expect(props().activeExtraTabId).toBe("c1");
    expect(props().extraTabs).toEqual([{ id: "c1", title: "New Chat", kind: "chat" }]);
  });

  it("adds, selects and closes chat tabs", async () => {
    await render();
    act(() => props().onExtraTabAdd());
    const first = chat.state.chatId!;
    expect(first).toBeTruthy();
    expect(props().extraTabs).toHaveLength(1);
    act(() => props().onExtraTabAdd());
    const second = chat.state.chatId!;
    expect(props().extraTabs).toHaveLength(2);

    act(() => props().onFileTabSelect());
    expect(view()).toBe("docs");
    act(() => props().onExtraTabSelect(first));
    expect(view()).toBe("research");
    expect(chat.state.chatId).toBe(first);

    // Closing the active tab moves to a neighbour; closing the last one falls back to docs.
    act(() => props().onExtraTabClose(first));
    expect(chat.state.chatId).toBe(second);
    expect(view()).toBe("research");
    act(() => props().onExtraTabClose(second));
    expect(view()).toBe("docs");
  });

  it("opens chats linked from chat history in place", async () => {
    await render();
    const { onOpenChat } = chat.configure.mock.calls.at(-1)![0];
    let handled = false;
    act(() => {
      handled = onOpenChat("c9");
    });
    expect(handled).toBe(true);
    expect(chat.switchToChat).toHaveBeenCalledWith("c9");
  });

  it("sends a clicked topic as a new chat's first message", async () => {
    await render();
    act(() => props().onSearchTopic("nuclear deterrence"));
    await flush();
    expect(chat.startNewChat).toHaveBeenCalled();
    expect(chat.sendMessage).toHaveBeenCalledWith("nuclear deterrence");
    expect(chat.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("asks the agent for page tips and topics from the document's text", async () => {
    grab.mockImplementation(async (path: string) =>
      path === "agent/page-tips" ? { tips: ["Cite more"] } : { topics: ["deterrence"] },
    );
    await render();
    await expect(props().onGenerateTips("Title", "<p>Hello&nbsp;<b>world</b></p><script>x()</script>")).resolves.toEqual(["Cite more"]);
    expect(grab).toHaveBeenCalledWith("agent/page-tips", {
      method: "POST",
      body: JSON.stringify({ title: "Title", content: "Hello world" }),
    });
    await expect(props().onGenerateTopics("Title", "<p>x</p>")).resolves.toEqual(["deterrence"]);

    grab.mockResolvedValue({});
    await expect(props().onGenerateTips("t", "")).resolves.toEqual([]);
    await expect(props().onGenerateTopics("t", "")).resolves.toEqual([]);
    grab.mockRejectedValue(new Error("down"));
    await expect(props().onGenerateTips("t", "")).resolves.toEqual([]);
    await expect(props().onGenerateTopics("t", "")).resolves.toEqual([]);
  });

  it("opens its own files sidebar when the dock asks", async () => {
    await render();
    const before = props().openFilesSidebarSignal;
    act(() => {
      window.dispatchEvent(new Event(OPEN_OWN_SIDEBAR_EVENT));
    });
    expect(props().openFilesSidebarSignal).toBe(before + 1);
  });

  it("remembers the last view across mounts", async () => {
    localStorage.setItem("qwksearch-main-view", "docs");
    await render();
    expect(view()).toBe("docs");
  });
});

describe("useMainView", () => {
  it("throws outside its provider", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => mount(<View />)).toThrow("useMainView must be used within a MainViewProvider");
    error.mockRestore();
  });
});
