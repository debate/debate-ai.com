/** @vitest-environment jsdom */
import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PrivacySettingsSection } from "../../../src/components/settings/sections/PrivacySettingsSection";
import { DEFAULT_RECORDING_PRIVACY, RECORDING_RELEASE_VERSION, type RecordingPrivacy } from "../../../src/lib/privacy/recording-release";
import { bodyText, button, change, click, cleanup, clickAsync, flush, installDomShims, jsonResponse, mockFetch, mount } from "../../helpers/dom";

beforeAll(() => installDomShims());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const released: RecordingPrivacy = {
  ...DEFAULT_RECORDING_PRIVACY,
  release: "released",
  releaseVersion: RECORDING_RELEASE_VERSION,
  releasedAt: "2026-02-03T12:00:00Z",
};

const radio = (name: string, value: string) =>
  document.querySelector<HTMLInputElement>(`input[type=radio][name='${name}'][value='${value}']`)!;
const usernameInput = () => document.querySelector<HTMLInputElement>("input[aria-label='Public username']")!;
const alertText = () => bodyText();

function privacyRoutes(opts: { privacy?: RecordingPrivacy; getStatus?: number; put?: (body: Record<string, unknown>) => unknown } = {}) {
  const current = { value: opts.privacy ?? DEFAULT_RECORDING_PRIVACY };
  return mockFetch([
    {
      match: "/api/settings/privacy/deletion-requests",
      method: "GET",
      respond: { requests: [] },
    },
    {
      match: "/api/settings/privacy/deletion-requests",
      method: "POST",
      respond: ({ body }: { body: unknown }) => {
        const { scope, categories, details } = body as { scope: string; categories: string[]; details: string };
        return { request: { id: 9, scope, categories, details, status: "pending", createdAt: "2026-03-01T00:00:00Z" } };
      },
    },
    {
      match: "/api/settings/privacy",
      method: "PUT",
      respond: ({ body }: { body: unknown }) => {
        if (opts.put) return opts.put(body as Record<string, unknown>);
        current.value = { ...current.value, ...(body as Partial<RecordingPrivacy>) };
        return { privacy: current.value };
      },
    },
    {
      match: "/api/settings/privacy",
      method: "GET",
      status: opts.getStatus,
      respond: opts.getStatus && opts.getStatus >= 400 ? { error: "Server broke" } : { privacy: current.value },
    },
  ]);
}

describe("PrivacySettingsSection recording release", () => {
  it("shows the sign-in prompts when the account is signed out", async () => {
    mockFetch([{ match: "/api/settings/privacy", respond: {}, status: 401 }]);
    mount(<PrivacySettingsSection />);
    await flush();
    expect(bodyText()).toContain("to choose whether your recordings can be published");
    expect(bodyText()).toContain("to ask us to delete data tied to your account.");
    expect(bodyText()).toContain("privacy policy");
  });

  it("defaults to not publishing and shows an anonymous credit preview", async () => {
    privacyRoutes();
    mount(<PrivacySettingsSection accountName="Ada Lovelace" />);
    await flush();
    expect(radio("release", "not-released").checked).toBe(true);
    expect(radio("release", "released").checked).toBe(false);
    expect(bodyText()).toContain("Shown as: Anonymous contributor");
    expect(bodyText()).not.toContain("Agreed on");
  });

  it("saves the agreement and shows the date it was given", async () => {
    const { calls } = privacyRoutes({ put: () => ({ privacy: released }) });
    mount(<PrivacySettingsSection />);
    await flush();
    click(radio("release", "released"));
    await flush();
    const put = calls.find((call) => call.method === "PUT");
    expect(put?.body).toEqual({ release: "released" });
    expect(radio("release", "released").checked).toBe(true);
    expect(bodyText()).toContain("Agreed on");
    expect(bodyText()).toContain("Saved.");
  });

  it("falls back to the private defaults and reports the error when loading fails", async () => {
    privacyRoutes({ getStatus: 500 });
    mount(<PrivacySettingsSection />);
    await flush();
    expect(alertText()).toContain("Server broke");
    expect(radio("release", "not-released").checked).toBe(true);
  });

  it("saves media and credit choices, previewing the real name in the chosen format", async () => {
    const { calls } = privacyRoutes({ privacy: released });
    mount(<PrivacySettingsSection accountName="Ada Lovelace" />);
    await flush();

    click(radio("media", "audio-only"));
    await flush();
    expect(calls.filter((call) => call.method === "PUT").at(-1)?.body).toEqual({ media: "audio-only" });
    expect(radio("media", "audio-only").checked).toBe(true);

    click(radio("credit", "real-name"));
    await flush();
    expect(bodyText()).toContain("Shown as: Ada L.");

    click(radio("realNameFormat", "full"));
    await flush();
    expect(calls.filter((call) => call.method === "PUT").at(-1)?.body).toEqual({ realNameFormat: "full" });
    expect(bodyText()).toContain("Shown as: Ada Lovelace");
  });

  it("warns a real-name credit with no account name will show as anonymous", async () => {
    privacyRoutes({ privacy: { ...released, credit: "real-name" } });
    mount(<PrivacySettingsSection />);
    await flush();
    expect(bodyText()).toContain("Your account has no name yet");
    expect(bodyText()).toContain("Shown as: Anonymous contributor");
  });

  it("only offers the username credit once a username is typed", async () => {
    privacyRoutes({ privacy: released });
    mount(<PrivacySettingsSection />);
    await flush();
    expect(radio("credit", "username").disabled).toBe(true);
    expect(bodyText()).toContain("Type a username below first.");
    change(usernameInput(), "debater42");
    expect(radio("credit", "username").disabled).toBe(false);
    expect(bodyText()).not.toContain("Type a username below first.");
  });

  it("saves a trimmed username on blur, then credits it", async () => {
    const { calls } = privacyRoutes({ privacy: released });
    mount(<PrivacySettingsSection />);
    await flush();
    change(usernameInput(), "debater42");
    blur(usernameInput());
    await flush();
    expect(calls.filter((call) => call.method === "PUT").at(-1)?.body).toEqual({ username: "debater42" });

    click(radio("credit", "username"));
    await flush();
    expect(calls.filter((call) => call.method === "PUT").at(-1)?.body).toEqual({ credit: "username", username: "debater42" });
    expect(bodyText()).toContain("Shown as: debater42");
  });

  it("trims whitespace around the username before saving it on blur", async () => {
    const { calls } = privacyRoutes({ privacy: released });
    mount(<PrivacySettingsSection />);
    await flush();
    change(usernameInput(), "  spaced  ");
    blur(usernameInput());
    await flush();
    expect(calls.filter((call) => call.method === "PUT").at(-1)?.body).toEqual({ username: "spaced" });
  });

  it("does not save an unchanged username on blur", async () => {
    const { calls } = privacyRoutes({ privacy: { ...released, username: "same" } });
    mount(<PrivacySettingsSection />);
    await flush();
    blur(usernameInput());
    await flush();
    expect(calls.some((call) => call.method === "PUT")).toBe(false);
  });

  it("shows the server's message when a save is rejected", async () => {
    privacyRoutes({ put: () => new Response(JSON.stringify({ error: "Invalid username" }), { status: 400 }) });
    mount(<PrivacySettingsSection />);
    await flush();
    click(radio("media", "audio-only"));
    await flush();
    expect(alertText()).toContain("Invalid username");
    expect(bodyText()).not.toContain("Saved.");
  });

  it("falls back to the status when the error body is not JSON, and handles a dropped connection", async () => {
    const routes = privacyRoutes({ put: () => new Response("oops", { status: 502 }) });
    mount(<PrivacySettingsSection />);
    await flush();
    click(radio("media", "audio-only"));
    await flush();
    expect(alertText()).toContain("Request failed (502)");

    routes.fn.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") throw new TypeError("offline");
      return jsonResponse({ privacy: DEFAULT_RECORDING_PRIVACY });
    });
    click(radio("media", "audio-only"));
    await flush();
    expect(alertText()).toContain("Could not reach the server. Your choice was not saved.");
  });
});

function blur(el: HTMLElement) {
  act(() => {
    el.focus();
    el.blur();
  });
}

describe("PrivacySettingsSection deletion requests", () => {
  const detailsBox = () => document.querySelector<HTMLTextAreaElement>("#privacy-deletion-details")!;
  const checkbox = (label: string) =>
    [...document.querySelectorAll<HTMLLabelElement>("label")].find((l) => l.textContent === label)!.querySelector("input")!;

  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("lists earlier requests with their categories, status and notes", async () => {
    mockFetch([
      {
        match: "/api/settings/privacy/deletion-requests",
        respond: {
          requests: [
            { id: 1, scope: "all", categories: [], details: "Everything please", status: "pending", createdAt: "2026-01-01T00:00:00Z" },
            { id: 2, scope: "part", categories: ["flows", "mystery"], details: "", status: "done", createdAt: "2026-01-02T00:00:00Z" },
            { id: 3, scope: "part", categories: [], details: "", status: "pending", createdAt: "2026-01-03T00:00:00Z" },
          ],
        },
      },
      { match: "/api/settings/privacy", respond: { privacy: DEFAULT_RECORDING_PRIVACY } },
    ]);
    mount(<PrivacySettingsSection />);
    await flush();
    const items = [...document.querySelectorAll("li")].map((li) => li.textContent ?? "");
    expect(items[0]).toContain("All data");
    expect(items[0]).toContain("Everything please");
    expect(items[1]).toContain("Flows and round data, mystery");
    expect(items[1]).toContain("done");
    expect(items[2]).toContain("Part of my data");
  });

  it("sends the chosen categories and details, then clears the form", async () => {
    const { calls } = privacyRoutes();
    mount(<PrivacySettingsSection />);
    await flush();
    click(checkbox("Flows and round data"));
    click(checkbox("Comments and forum posts"));
    click(checkbox("Flows and round data"));
    change(detailsBox(), "Please remove my round from 2024");
    await clickAsync(button("Send request"));
    const post = calls.find((call) => call.method === "POST");
    expect(post?.body).toEqual({ scope: "part", categories: ["comments"], details: "Please remove my round from 2024" });
    expect(bodyText()).toContain("Request sent.");
    expect(detailsBox().value).toBe("");
    expect(document.querySelectorAll("li").length).toBe(1);
  });

  it("asks before requesting deletion of everything and sends no categories", async () => {
    const { calls } = privacyRoutes();
    mount(<PrivacySettingsSection />);
    await flush();
    click(radio("deletion-scope", "all"));
    expect(document.querySelector("input[type=checkbox]")).toBeNull();

    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await clickAsync(button("Send request"));
    expect(calls.some((call) => call.method === "POST")).toBe(false);

    await clickAsync(button("Send request"));
    expect(calls.find((call) => call.method === "POST")?.body).toEqual({ scope: "all", categories: [], details: "" });
  });

  it("reports a rejected or unreachable request", async () => {
    const routes = mockFetch([
      { match: "/api/settings/privacy/deletion-requests", method: "POST", respond: { error: "Too many requests" }, status: 429 },
      { match: "/api/settings/privacy/deletion-requests", respond: { requests: [] } },
      { match: "/api/settings/privacy", respond: { privacy: DEFAULT_RECORDING_PRIVACY } },
    ]);
    mount(<PrivacySettingsSection />);
    await flush();
    await clickAsync(button("Send request"));
    expect(bodyText()).toContain("Too many requests");
    expect(bodyText()).not.toContain("Request sent.");

    const original = routes.fn.getMockImplementation()!;
    routes.fn.mockImplementation(async (input, init) => {
      if (init?.method === "POST") throw new TypeError("offline");
      return original(input, init);
    });
    await clickAsync(button("Send request"));
    expect(bodyText()).toContain("Could not reach the server. Your request was not sent.");
  });
});
