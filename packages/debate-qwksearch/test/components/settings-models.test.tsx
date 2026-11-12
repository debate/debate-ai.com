/** @vitest-environment jsdom */
/**
 * @fileoverview The Models settings: a provider card (its models, adding and
 * deleting a model, updating and deleting the connection, testing its
 * models), the chat-model picker, the model-families carousel, the "View
 * All" connected-models modal and the "Add Provider" flow.
 */
import { act, useState } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConfigModelProvider, ModelProviderUISection, UIConfigField } from "../../src/components/lib/config-types";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const grab = vi.hoisted(() => vi.fn());
vi.mock("grab-url", () => ({ default: grab }));
const api = vi.hoisted(() => ({
  addProvider: vi.fn(),
  listProviders: vi.fn(),
  updateProvider: vi.fn(),
  deleteProvider: vi.fn(),
  addProviderModel: vi.fn(),
  deleteProviderModel: vi.fn(),
}));
vi.mock("qwksearch-api-client", () => api);
const chat = vi.hoisted(() => ({ setChatModelProvider: vi.fn() }));
vi.mock("research-agent-ui", () => ({ useChat: () => chat }));
// The provider sprite cropper; jsdom can't decode the sprite image anyway.
vi.mock("chat-agent-toolkit", () => ({ cropProviderAsDataURL: vi.fn(async () => null) }));

import Models from "../../src/components/Settings/Sections/Models/Section";
import ModelProvider from "../../src/components/Settings/Sections/Models/ModelProvider";
import { bodyText, button, byText, change, cleanup, click, clickAsync, flush, installDomShims, keyDown, mount, submit } from "../helpers/dom";

beforeAll(installDomShims);
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  localStorage.clear();
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  error.mockRestore();
});

const apiKeyField: UIConfigField = {
  name: "API Key",
  key: "apiKey",
  type: "password",
  required: true,
  description: "",
  scope: "server",
  placeholder: "sk-…",
};

function provider(overrides: Partial<ConfigModelProvider> = {}): ConfigModelProvider {
  return {
    id: "p1",
    name: "My OpenAI",
    type: "openai",
    chatModels: [
      { name: "GPT 4o", key: "gpt-4o" },
      { name: "Llama Mini", key: "llama-mini" },
    ],
    config: { apiKey: "sk-old" },
    hash: "h",
    ...overrides,
  } as ConfigModelProvider;
}

/** Renders a provider card with real state, the way the Models section does. */
function Harness({ initial, fields = [apiKeyField] }: { initial: ConfigModelProvider[]; fields?: UIConfigField[] }) {
  const [providers, setProviders] = useState(initial);
  return (
    <div>
      <span data-testid="count">{providers.length}</span>
      {providers.map((p) => (
        <ModelProvider key={p.id} modelProvider={p} fields={fields} setProviders={setProviders} />
      ))}
    </div>
  );
}

const dialogs = () => [...document.querySelectorAll<HTMLElement>("[role=dialog]")];

describe("Model provider card", () => {
  it("lists the provider's models", () => {
    mount(<Harness initial={[provider()]} />);
    expect(bodyText()).toContain("My OpenAI");
    expect(bodyText()).toContain("2 models configured");
    expect(bodyText()).toContain("GPT 4o");
  });

  it("shows a provider's error instead of its models", () => {
    mount(<Harness initial={[provider({ chatModels: [{ name: "Invalid API key", key: "error" }] })]} />);
    expect(bodyText()).toContain("Invalid API key");
    expect(bodyText()).not.toContain("models configured");
    expect(() => button("Add")).toThrow();
  });

  it("shows the empty state for a provider with no models", () => {
    mount(<Harness initial={[provider({ chatModels: [] })]} />);
    expect(bodyText()).toContain("No chat models configured");
  });

  it("deletes a model, and reports a failed delete", async () => {
    api.deleteProviderModel.mockResolvedValueOnce({});
    mount(<Harness initial={[provider()]} />);
    await clickAsync(byText("GPT 4o", "div").querySelector("button")!);
    expect(api.deleteProviderModel).toHaveBeenCalledWith({ path: { id: "p1" }, body: { key: "gpt-4o", type: "chat" } });
    expect(toast.success).toHaveBeenCalledWith("Model deleted successfully.");
    expect(bodyText()).toContain("1 model configured");

    api.deleteProviderModel.mockRejectedValueOnce(new Error("no"));
    await clickAsync(byText("Llama Mini", "div").querySelector("button")!);
    expect(toast.error).toHaveBeenCalledWith("Failed to delete model.");
  });

  it("adds a chat model and rejects non-chat model keys", async () => {
    api.addProviderModel.mockResolvedValue({});
    mount(<Harness initial={[provider()]} />);
    click(button("Add"));
    expect(bodyText()).toContain("Add new chat model");
    change(document.querySelector('input[placeholder="e.g., GPT-4"]')!, "Whisper");
    change(document.querySelector('input[placeholder="e.g., gpt-4"]')!, "whisper-1");
    submit(dialogs()[0].querySelector("form")!);
    await flush();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("audio transcription"));
    expect(api.addProviderModel).not.toHaveBeenCalled();

    change(document.querySelector('input[placeholder="e.g., GPT-4"]')!, "Claude");
    change(document.querySelector('input[placeholder="e.g., gpt-4"]')!, "claude-x");
    submit(dialogs()[0].querySelector("form")!);
    await flush();
    expect(api.addProviderModel).toHaveBeenCalledWith({ path: { id: "p1" }, body: { name: "Claude", key: "claude-x", type: "chat" } });
    expect(toast.success).toHaveBeenCalledWith("Model added successfully.");
    expect(bodyText()).toContain("3 models configured");
  });

  it("reports a failed model add", async () => {
    api.addProviderModel.mockRejectedValue(new Error("down"));
    mount(<Harness initial={[provider()]} />);
    click(button("Add"));
    change(document.querySelector('input[placeholder="e.g., GPT-4"]')!, "X");
    change(document.querySelector('input[placeholder="e.g., gpt-4"]')!, "x-chat");
    submit(dialogs()[0].querySelector("form")!);
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Failed to add model.");
  });

  it("updates the connection's config", async () => {
    api.updateProvider.mockResolvedValue({ data: { provider: provider({ name: "Renamed", config: { apiKey: "sk-new" } }) } });
    mount(<Harness initial={[provider()]} />);
    // The pencil button is the first icon-only button after Test Models.
    const pencil = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => !b.textContent?.trim() && !b.title,
    )!;
    click(pencil);
    expect(bodyText()).toContain("Update connection");
    const keyInput = document.querySelector<HTMLInputElement>('input[placeholder="sk-…"]')!;
    expect(keyInput.value).toBe("sk-old");
    change(keyInput, "sk-new");
    submit(dialogs()[0].querySelector("form")!);
    await flush();
    expect(api.updateProvider).toHaveBeenCalledWith({ path: { id: "p1" }, body: { config: { apiKey: "sk-new" } } });
    expect(toast.success).toHaveBeenCalledWith("Connection updated successfully.");
    expect(bodyText()).toContain("Renamed");
  });

  it("keeps an env-based provider's stored key when the field is left blank", async () => {
    api.updateProvider.mockRejectedValue(new Error("nope"));
    mount(<Harness initial={[provider({ isEnvBased: true })]} />);
    const pencil = [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => !b.textContent?.trim() && !b.title)!;
    click(pencil);
    expect(document.querySelector<HTMLInputElement>('input[placeholder="sk-…"]')!.value).toBe("");
    submit(dialogs()[0].querySelector("form")!);
    await flush();
    expect(api.updateProvider).toHaveBeenCalledWith({ path: { id: "p1" }, body: { config: { apiKey: "sk-old" } } });
    expect(toast.error).toHaveBeenCalledWith("Failed to update connection.");
  });

  it("deletes the connection after confirming", async () => {
    api.deleteProvider.mockResolvedValue({});
    mount(<Harness initial={[provider()]} />);
    click(document.querySelector('button[title="Delete connection"]')!);
    expect(bodyText()).toContain('delete the connection "My OpenAI"');
    click(button("Cancel"));
    expect(dialogs()).toHaveLength(0);

    click(document.querySelector('button[title="Delete connection"]')!);
    await clickAsync(button("Delete"));
    expect(api.deleteProvider).toHaveBeenCalledWith({ path: { id: "p1" } });
    expect(toast.success).toHaveBeenCalledWith("Connection deleted successfully.");
    expect(document.querySelector('[data-testid="count"]')!.textContent).toBe("0");
  });

  it("reports a failed connection delete", async () => {
    api.deleteProvider.mockRejectedValue(new Error("no"));
    mount(<Harness initial={[provider()]} />);
    click(document.querySelector('button[title="Delete connection"]')!);
    await clickAsync(button("Delete"));
    expect(toast.error).toHaveBeenCalledWith("Failed to delete connection.");
    expect(document.querySelector('[data-testid="count"]')!.textContent).toBe("1");
  });

  it("tests the provider's models and shows the results", async () => {
    grab.mockResolvedValue({
      provider: "openai",
      totalModels: 2,
      testDuration: 1500,
      availableModels: [{ modelId: "gpt-4o", modelName: "GPT 4o", available: true, latency: 300, type: "chat" }],
      unavailableModels: [{ modelId: "o9", modelName: "O9", available: false, error: "404", type: "chat" }],
    });
    mount(<Harness initial={[provider()]} />);
    await clickAsync(button("Test Models"));
    expect(grab).toHaveBeenCalledWith("agent/test-models", {
      method: "POST",
      body: { providerType: "openai", apiKey: "sk-old", onlyFree: true },
    });
    expect(toast.success).toHaveBeenCalledWith("Found 1/2 working models for My OpenAI");
    expect(bodyText()).toContain("Model Test Results: My OpenAI");
    expect(bodyText()).toContain("Testing completed in 1.5s");
    expect(bodyText()).toContain("300ms");
    expect(bodyText()).toContain("Unavailable Models");
    expect(bodyText()).toContain("404");
  });

  it("reports a malformed test response", async () => {
    grab.mockResolvedValue({ availableModels: "nope" });
    mount(<Harness initial={[provider()]} />);
    await clickAsync(button("Test Models"));
    expect(toast.error).toHaveBeenCalledWith("Invalid model test results format");
    grab.mockResolvedValue(null);
    await clickAsync(button("Test Models"));
    expect(toast.error).toHaveBeenCalledWith("Invalid response from server");
  });
});

const sections: ModelProviderUISection[] = [
  { name: "OpenAI", key: "openai", fields: [apiKeyField] },
  { name: "Anthropic", key: "anthropic", fields: [{ ...apiKeyField, default: "sk-ant" } as UIConfigField] },
];

describe("Models section", () => {
  it("picks a chat model from the searchable, categorised list", () => {
    const values = [
      provider(),
      provider({ id: "p2", name: "Groq", type: "groq", chatModels: [{ name: "DeepSeek Reasoner", key: "deepseek-reasoner" }] }),
    ];
    mount(<Models fields={sections} values={values} />);
    expect(bodyText()).toContain("Select a model");
    const trigger = byText("Select a model", "button");
    click(trigger);
    expect(bodyText()).toContain("Most Capable");
    click(button("Fast"));
    expect(bodyText()).toContain("Llama Mini");
    expect(bodyText()).not.toContain("GPT 4o");
    click(button("Specialized"));
    expect(bodyText()).toContain("DeepSeek Reasoner");
    click(button("All Models"));
    change(document.querySelector('input[placeholder="Search models..."]')!, "zzz");
    expect(bodyText()).toContain("No models found");
    change(document.querySelector('input[placeholder="Search models..."]')!, "gpt");
    click(byText("GPT 4o", "button"));
    expect(localStorage.getItem("chatModelProviderId")).toBe("p1");
    expect(localStorage.getItem("chatModelKey")).toBe("gpt-4o");
    expect(chat.setChatModelProvider).toHaveBeenCalledWith({ providerId: "p1", key: "gpt-4o" });
    expect(bodyText()).toContain("My OpenAI - GPT 4o");
  });

  it("follows a model change made elsewhere", () => {
    mount(<Models fields={sections} values={[provider()]} />);
    localStorage.setItem("chatModelProviderId", "p1");
    localStorage.setItem("chatModelKey", "llama-mini");
    act(() => {
      window.dispatchEvent(new Event("chat-model-changed"));
    });
    expect(bodyText()).toContain("My OpenAI - Llama Mini");
  });

  it("lists every configured model in View All, split open/closed source", () => {
    mount(
      <Models
        fields={sections}
        values={[provider({ chatModels: [{ name: "GPT 4o", key: "gpt-4o" }, { name: "Llama", key: "llama-3" }, { name: "Odd", key: "odd-model" }, { name: "Err", key: "error" }] })]}
      />,
    );
    click(button("View All"));
    expect(bodyText()).toContain("All Configured Models");
    expect(bodyText()).toContain("Open Source");
    expect(bodyText()).toContain("Closed Source");
    expect(bodyText()).toContain("Other");
    expect(bodyText()).not.toContain("Err");
    // The footer's Add Connection just closes this modal.
    click(button("Add Connection"));
    expect(bodyText()).not.toContain("All Configured Models");
  });

  it("shows the empty View All state", () => {
    mount(<Models fields={sections} values={[]} />);
    click(button("View All"));
    expect(bodyText()).toContain("No models configured. Add a connection to get started.");
  });

  it("walks the model families carousel and sets a model active", () => {
    const scrollBy = vi.fn();
    Element.prototype.scrollBy = scrollBy as unknown as Element["scrollBy"];
    mount(<Models fields={sections} values={[provider({ chatModels: [{ name: "GPT 4o", key: "gpt-4o" }, { name: "Mystery", key: "mystery-1" }] })]} />);
    // Claude is first; openai isn't anthropic, so there's a compact Add provider.
    expect(bodyText()).toContain("by Anthropic · Claude Fable 5");
    expect(bodyText()).toContain("Enable a provider to use Claude models");
    click(document.querySelector('button[aria-label="Scroll right"]')!);
    click(document.querySelector('button[aria-label="Scroll left"]')!);
    expect(scrollBy).toHaveBeenCalledTimes(2);

    click(byText("ChatGPT", "button"));
    expect(bodyText()).toContain("Available from your connections");
    click(document.querySelector('button[title="Set gpt-4o as active model"]')!);
    expect(toast.success).toHaveBeenCalledWith("GPT 4o is now the active chat model");
    expect(bodyText()).toContain("Active: GPT 4o (My OpenAI)");

    click(byText("DeepSeek", "button"));
    expect(bodyText()).toContain("Open");

    // "Other" collects models that match no family.
    const other = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Other")!;
    click(other);
    expect(bodyText()).toContain("Models that don't match any of the families above");
    expect(bodyText()).toContain("Mystery");
  });

  it("opens the API-key help for a provider chip", () => {
    mount(<Models fields={sections} values={[]} />);
    click(document.querySelector('button[title="Configure Anthropic API key"]')!);
    expect(bodyText()).toContain("Configure Anthropic API Key");
    expect(document.querySelector<HTMLAnchorElement>('a[href="https://console.anthropic.com/settings/keys"]')).not.toBeNull();
    click(button("Done"));
    expect(bodyText()).not.toContain("Configure Anthropic API Key");
  });

  it("adds a provider connection from the carousel", async () => {
    api.addProvider.mockResolvedValue({ provider: provider({ id: "p9", name: "Claude Co", type: "anthropic", chatModels: [{ name: "Claude", key: "claude-1" }] }) });
    api.listProviders.mockResolvedValue({ providers: [] });
    mount(<Models fields={sections} values={[]} />);
    click(button("Add provider"));
    expect(bodyText()).toContain("Add new connection");
    const select = dialogs()[0].querySelector("select")!;
    expect(select.value).toBe("anthropic");
    expect(document.querySelector<HTMLInputElement>('input[placeholder="sk-…"]')!.value).toBe("sk-ant");
    change(document.querySelector('input[placeholder="sk-…"]')!, "sk-mine");
    submit(dialogs()[0].querySelector("form")!);
    await flush();
    expect(api.addProvider).toHaveBeenCalledWith({ body: { type: "anthropic", config: { apiKey: "sk-mine" } } });
    expect(toast.success).toHaveBeenCalledWith("Connection added successfully.");
    // Claude now has a connected provider, so the carousel offers its models
    // instead of the "Enable a provider" prompt.
    expect(bodyText()).not.toContain("Enable a provider to use Claude models");
    expect(bodyText()).toContain("Available from your connections");
  });

  it("opens Add Provider from Manage connections and reports a failed add", async () => {
    api.listProviders.mockResolvedValue({ data: { providers: [provider()] } });
    api.addProvider.mockRejectedValue(new Error("bad key"));
    mount(<Models fields={sections} values={[]} />);
    await clickAsync(button("Add Provider"));
    expect(api.listProviders).toHaveBeenCalled();
    expect(bodyText()).toContain("GPT 4o");
    click(button("Add Connection"));
    const select = dialogs()[0].querySelector("select")!;
    change(select, "openai");
    change(document.querySelector('input[placeholder="sk-…"]')!, "k");
    submit(dialogs()[0].querySelector("form")!);
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Failed to add connection.");
    keyDown(document.body, "Escape");
  });
});
