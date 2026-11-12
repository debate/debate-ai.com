/** @vitest-environment jsdom */
/**
 * @fileoverview The embed's shell: the provider-setup dialog, the settings
 * opener that routes to `/settings` tabs, `GrabBaseScope`'s scoped grab-url
 * base and the provider stack that waits for the QwkSearch session.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("grab-url", () => ({ default: vi.fn() }));
const api = vi.hoisted(() => ({ addProvider: vi.fn() }));
vi.mock("qwksearch-api-client", () => api);
vi.mock("chat-agent-toolkit", () => ({ cropProviderAsDataURL: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const rau = vi.hoisted(() => ({ configure: vi.fn() }));
vi.mock("research-agent-ui", () => ({
  configureResearchAgentUI: rau.configure,
  ChatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ExtractPanelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
const session = vi.hoisted(() => ({ isPending: true, outcome: vi.fn() }));
vi.mock("../../src/components/connect-auth", () => ({
  authClient: {},
  useQwkSearchSession: () => ({ session: { connected: false }, isPending: session.isPending }),
  useQwkSearchConnectOutcome: session.outcome,
}));

import ProviderSetupModal from "../../src/components/Settings/Sections/Models/ProviderSetupModal";
import { SettingsModalProvider, useSettingsModal } from "../../src/components/Settings/SettingsModal";
import { GrabBaseScope } from "../../src/components/GrabBaseScope";
import { QwksearchProviders } from "../../src/components/Providers";
import { QWKSEARCH_API_BASE } from "../../src/components/base-url";
import { useMainView } from "../../src/components/MainViewProvider";
import { bodyText, button, change, cleanup, click, flush, installDomShims, mount, submit } from "../helpers/dom";

beforeAll(installDomShims);
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  error = vi.spyOn(console, "error").mockImplementation(() => {});
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn(async () => {}) } });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  error.mockRestore();
});

const providerSection = {
  name: "OpenRouter",
  key: "openrouter",
  fields: [
    { name: "API Key", key: "apiKey", type: "password", required: true, description: "", scope: "server", links: [{ name: "Get API key", url: "https://openrouter.ai/keys" }] },
    { name: "Base URL", key: "baseUrl", type: "string", required: false, description: "", scope: "server", default: "https://openrouter.ai/api" },
  ],
} as never;

describe("ProviderSetupModal", () => {
  it("adds a connection with the key and extra fields", async () => {
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();
    api.addProvider.mockResolvedValue({ data: { provider: { id: "p1", name: "OR", type: "openrouter" } } });
    mount(<ProviderSetupModal open onOpenChange={onOpenChange} provider={providerSection} onSuccess={onSuccess} />);
    expect(bodyText()).toContain("OpenRouter");
    expect(document.querySelector<HTMLAnchorElement>('a[href="https://openrouter.ai/keys"]')).not.toBeNull();
    expect(button("Add Connection").disabled).toBe(true);

    change(document.querySelector('input[placeholder="Enter your API key..."]')!, "sk-or");
    click(document.querySelector('button[title="Copy API key"]')!);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("sk-or");
    change(document.querySelector('input[placeholder="Enter base url"]')!, "https://proxy.example");
    submit(document.querySelector("[role=dialog] form")!);
    await flush();
    expect(api.addProvider).toHaveBeenCalledWith({
      body: { type: "openrouter", config: { apiKey: "sk-or", baseUrl: "https://proxy.example" } },
    });
    expect(onSuccess).toHaveBeenCalledWith({ id: "p1", name: "OR", type: "openrouter" });
    expect(toast.success).toHaveBeenCalledWith("Connection added successfully");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("reports a failed add and an unsupported model preview", async () => {
    api.addProvider.mockRejectedValue(new Error("Bad key"));
    mount(<ProviderSetupModal open onOpenChange={vi.fn()} provider={providerSection} onSuccess={vi.fn()} />);
    change(document.querySelector('input[placeholder="Enter your API key..."]')!, "sk");
    click(button("Preview Models"));
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Listing models for this provider is not supported yet");
    submit(document.querySelector("[role=dialog] form")!);
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Bad key");
  });

  it("closes from Cancel", () => {
    const onOpenChange = vi.fn();
    mount(<ProviderSetupModal open onOpenChange={onOpenChange} provider={providerSection} onSuccess={vi.fn()} />);
    click(button("Cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("SettingsModalProvider", () => {
  function Opener() {
    const { openSettings, closeSettings } = useSettingsModal();
    return (
      <>
        <button onClick={() => openSettings("models")}>open</button>
        <button onClick={() => closeSettings()}>close</button>
      </>
    );
  }

  it("routes settings requests to the /settings tabs", () => {
    mount(
      <SettingsModalProvider>
        <Opener />
      </SettingsModalProvider>,
    );
    click(button("open"));
    expect(router.push).toHaveBeenCalledWith(expect.stringMatching(/^\/settings\?category=/));
    click(button("close"));
    expect(router.push).toHaveBeenLastCalledWith("/doc");
    const { onOpenSettings } = rau.configure.mock.calls.find(([c]) => c.onOpenSettings)![0];
    expect(onOpenSettings()).toBe(true);
  });

  it("throws outside its provider", () => {
    expect(() => mount(<Opener />)).toThrow("useSettingsModal must be used within a SettingsModalProvider");
  });
});

describe("GrabBaseScope", () => {
  it("points grab-url at qwksearch while mounted and restores the old defaults", () => {
    const win = window as unknown as { grab?: { defaults?: Record<string, unknown> } };
    win.grab = { defaults: { baseURL: "/api/", timeout: 5 } };
    const handle = mount(
      <GrabBaseScope>
        <span>child</span>
      </GrabBaseScope>,
    );
    expect(bodyText()).toBe("child");
    expect(win.grab.defaults).toEqual({ baseURL: QWKSEARCH_API_BASE, timeout: 5 });
    handle.unmount();
    expect(win.grab.defaults).toEqual({ baseURL: "/api/", timeout: 5 });
  });

  it("creates the grab global when there is none", () => {
    const win = window as unknown as { grab?: { defaults?: Record<string, unknown> } };
    delete win.grab;
    const handle = mount(<GrabBaseScope>x</GrabBaseScope>);
    expect(win.grab!.defaults!.baseURL).toBe(QWKSEARCH_API_BASE);
    handle.unmount();
    expect(win.grab!.defaults).toEqual({});
  });
});

describe("QwksearchProviders", () => {
  function Child() {
    return <span>view: {useMainView().activeView}</span>;
  }

  it("holds children back until the session is known", () => {
    session.isPending = true;
    const handle = mount(
      <QwksearchProviders>
        <Child />
      </QwksearchProviders>,
    );
    expect(bodyText()).toBe("");
    expect(session.outcome).toHaveBeenCalled();
    session.isPending = false;
    handle.rerender(
      <QwksearchProviders>
        <Child />
      </QwksearchProviders>,
    );
    expect(bodyText()).toBe("view: research");
  });
});
