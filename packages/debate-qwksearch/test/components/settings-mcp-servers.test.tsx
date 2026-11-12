/** @vitest-environment jsdom */
/**
 * @fileoverview The MCP Servers settings: the empty state, adding a server
 * of a configured type, toggling, updating and deleting one, and the
 * OpenConnector app directory grouped by category.
 */
import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { MCPServerConfig, MCPServerUISection, UIConfigField } from "../../src/components/lib/config-types";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const grab = vi.hoisted(() => vi.fn());
vi.mock("grab-url", () => ({ default: grab }));
vi.mock("chat-agent-toolkit/connectors/openconnector-providers-index.json", () => ({
  default: [
    { service: "github", displayName: "GitHub", categories: ["Developer"], authTypes: ["oauth"], homepageUrl: "https://www.github.com", actionCount: 12, actions: [] },
    { service: "linear", displayName: "", categories: ["Developer", "Productivity"], authTypes: [], homepageUrl: "not a url", actionCount: 1, actions: [] },
    { service: "notes", displayName: "Notes", categories: [], authTypes: [], homepageUrl: null, actionCount: 3, actions: [] },
  ],
}));

import MCPServers from "../../src/components/Settings/Sections/MCPServers/Section";
import { bodyText, button, byText, change, cleanup, click, clickAsync, flush, installDomShims, mount, submit } from "../helpers/dom";

beforeAll(installDomShims);
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  error.mockRestore();
});

const urlField: UIConfigField = {
  name: "Server URL",
  key: "url",
  type: "string",
  required: true,
  description: "",
  scope: "server",
  placeholder: "https://mcp.example",
  default: "https://default.example",
};

const fields: MCPServerUISection[] = [
  { name: "OpenConnector", key: "openconnector", fields: [urlField] },
  { name: "Custom", key: "custom", fields: [] },
];

const server = (overrides: Partial<MCPServerConfig> = {}): MCPServerConfig => ({
  id: "s1",
  name: "Main server",
  type: "openconnector",
  config: { url: "https://main.example" },
  enabled: true,
  hash: "h",
  ...overrides,
});

const dialog = () => document.querySelector<HTMLElement>("[role=dialog]")!;

describe("MCP Servers settings", () => {
  it("shows the empty state", () => {
    mount(<MCPServers fields={fields} values={[]} />);
    expect(bodyText()).toContain("No MCP servers configured");
  });

  it("adds a server with its type's fields", async () => {
    grab.mockResolvedValue({ server: server({ id: "s2", name: "New one" }) });
    mount(<MCPServers fields={fields} values={[]} />);
    click(button("Add Server"));
    expect(bodyText()).toContain("Add new MCP server");
    const url = document.querySelector<HTMLInputElement>('input[placeholder="https://mcp.example"]')!;
    expect(url.value).toBe("https://default.example");
    change(document.querySelector('input[placeholder="e.g., My OpenConnector Server"]')!, "New one");
    change(url, "https://mine.example");
    submit(dialog().querySelector("form")!);
    await flush();
    expect(grab).toHaveBeenCalledWith("agent/mcpservers", {
      method: "POST",
      body: { type: "openconnector", name: "New one", config: { url: "https://mine.example" } },
    });
    expect(toast.success).toHaveBeenCalledWith("MCP server added successfully.");
    expect(bodyText()).toContain("New one");
    expect(bodyText()).not.toContain("No MCP servers configured");
  });

  it("switches server type and reports a failed add", async () => {
    grab.mockRejectedValue(new Error("down"));
    mount(<MCPServers fields={fields} values={[]} />);
    click(button("Add Server"));
    change(dialog().querySelector("select")!, "custom");
    expect(document.querySelector('input[placeholder="https://mcp.example"]')).toBeNull();
    change(document.querySelector('input[placeholder="e.g., My OpenConnector Server"]')!, "x");
    submit(dialog().querySelector("form")!);
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Failed to add MCP server.");
  });

  it("toggles a server on and off", async () => {
    grab.mockResolvedValue({});
    mount(<MCPServers fields={fields} values={[server()]} />);
    expect(bodyText()).toContain("openconnector • Enabled");
    const toggle = byText("Main server", "div").closest(".border")!.querySelector<HTMLButtonElement>("button")!;
    await clickAsync(toggle);
    expect(grab).toHaveBeenCalledWith("agent/mcpservers/s1/toggle", { method: "POST", body: { enabled: false } });
    expect(toast.success).toHaveBeenCalledWith("MCP server disabled successfully.");
    expect(bodyText()).toContain("openconnector • Disabled");

    grab.mockRejectedValueOnce(new Error("nope"));
    await clickAsync(toggle);
    expect(toast.error).toHaveBeenCalledWith("Failed to toggle MCP server.");
    expect(bodyText()).toContain("Disabled");
  });

  it("updates a server's name and config", async () => {
    grab.mockResolvedValue({ server: server({ name: "Renamed" }) });
    mount(<MCPServers fields={fields} values={[server()]} />);
    const buttons = byText("Main server", "div").closest(".border")!.querySelectorAll<HTMLButtonElement>("button");
    click(buttons[1]);
    expect(bodyText()).toContain("Update MCP server");
    const inputs = dialog().querySelectorAll<HTMLInputElement>("input");
    expect(inputs[0].value).toBe("Main server");
    change(inputs[0], "Renamed");
    submit(dialog().querySelector("form")!);
    await flush();
    expect(grab).toHaveBeenCalledWith("agent/mcpservers/s1", {
      method: "PATCH",
      body: { name: "Renamed", config: { name: "Main server", url: "https://main.example" } },
    });
    expect(toast.success).toHaveBeenCalledWith("MCP server updated successfully.");
    expect(bodyText()).toContain("Renamed");
  });

  it("reports a failed update", async () => {
    grab.mockRejectedValue(new Error("x"));
    mount(<MCPServers fields={fields} values={[server({ type: "unknown" })]} />);
    click(byText("Main server", "div").closest(".border")!.querySelectorAll("button")[1]);
    submit(dialog().querySelector("form")!);
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Failed to update MCP server.");
  });

  it("deletes a server, and reports a failed delete", async () => {
    grab.mockRejectedValueOnce(new Error("x"));
    mount(<MCPServers fields={fields} values={[server()]} />);
    click(document.querySelector('button[title="Delete MCP server"]')!);
    expect(bodyText()).toContain("Main server");
    await clickAsync(button("Delete"));
    expect(toast.error).toHaveBeenCalledWith("Failed to delete MCP server.");

    grab.mockResolvedValue({});
    await clickAsync(button("Delete"));
    expect(grab).toHaveBeenLastCalledWith("agent/mcpservers/s1", { method: "DELETE" });
    expect(toast.success).toHaveBeenCalledWith("MCP server deleted successfully.");
    expect(bodyText()).toContain("No MCP servers configured");
  });

  it("lists OpenConnector apps by category and opens a linked app", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    mount(<MCPServers fields={fields} values={[]} />);
    expect(bodyText()).toContain("OpenConnector Apps");
    // "Developer" sorts first and holds both apps.
    expect(bodyText()).toContain("Developer(2)");
    expect(bodyText()).toContain("Developer · 12 actions");
    expect(bodyText()).toContain("linear");
    const githubRow = byText("GitHub", "p").closest("div")!.parentElement!.parentElement!;
    click(githubRow.querySelector("button")!);
    expect(open).toHaveBeenCalledWith("https://github.com", "_blank", "noopener,noreferrer");

    // An app with no parseable homepage has a letter logo and no link target.
    const linearRow = byText("linear", "p").closest("div")!.parentElement!.parentElement!;
    click(linearRow.querySelector("button")!);
    expect(open).toHaveBeenCalledTimes(1);

    click(byText("Productivity", "button"));
    expect(bodyText()).not.toContain("GitHub");

    const img = document.querySelector<HTMLImageElement>('img[alt="GitHub"]');
    expect(img).toBeNull();
    click(byText("Developer", "button"));
    act(() => {
      document.querySelector('img[alt="GitHub"]')!.dispatchEvent(new Event("error"));
    });
    expect(document.querySelector('img[alt="GitHub"]')).toBeNull();
    open.mockRestore();
  });
});
