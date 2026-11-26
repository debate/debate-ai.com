/** @vitest-environment jsdom */
import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const orgs = vi.hoisted(() => ({
  list: { data: undefined as { id: string; name: string }[] | undefined, isPending: false },
  setActive: vi.fn(),
  create: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../../../src/lib/auth/client", () => ({
  authClient: {
    useListOrganizations: () => orgs.list,
    organization: { setActive: orgs.setActive, create: orgs.create },
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: orgs.refresh }) }));

import { ORGANIZATION_CHANGED_EVENT } from "@debate-ai/team-collaboration";
import {
  AddMembersDialog,
  CreateOrganizationDialog,
  OrganizationSubmenu,
} from "../../../src/components/layout/app-sidebar/organization-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../../../src/ui/primitives/dropdown-menu";
import { bodyText, button, byText, change, click, cleanup, clickAsync, flush, installDomShims, jsonResponse, mockFetch, mount, submit } from "../../helpers/dom";

beforeAll(() => installDomShims());
beforeEach(() => {
  orgs.list = { data: [{ id: "o1", name: "Lincoln High" }, { id: "o2", name: "Roosevelt" }], isPending: false };
  orgs.setActive.mockResolvedValue({});
  orgs.create.mockResolvedValue({ error: null });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderSubmenu(activeOrganizationId: string | null) {
  const onCreate = vi.fn();
  const onAddMembers = vi.fn();
  mount(
    <DropdownMenu open>
      <DropdownMenuTrigger>menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <OrganizationSubmenu
          itemClassName=""
          activeOrganizationId={activeOrganizationId}
          onCreate={onCreate}
          onAddMembers={onAddMembers}
        />
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  return { onCreate, onAddMembers };
}

function openSubmenu(label: string) {
  const trigger = byText(label, "[role=menuitem]");
  act(() => {
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
  });
}

const item = (text: string) => byText(text, "[role=menuitem]");

describe("OrganizationSubmenu", () => {
  it("labels the trigger 'Organizations' when no organization is active", async () => {
    renderSubmenu(null);
    expect(bodyText()).toContain("Organizations");
    openSubmenu("Organizations");
    await flush();
    expect(bodyText()).toContain("Personal");
    expect(bodyText()).toContain("Lincoln High");
    expect(bodyText()).toContain("Roosevelt");
    expect(bodyText()).toContain("New organization");
    expect(bodyText()).not.toContain("Members of");
  });

  it("names the active organization on the trigger and offers its members", async () => {
    const { onAddMembers, onCreate } = renderSubmenu("o2");
    openSubmenu("Roosevelt");
    await flush();
    click(item("Members of Roosevelt"));
    expect(onAddMembers).toHaveBeenCalledTimes(1);
    click(item("New organization"));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("shows a loading row while organizations load", async () => {
    orgs.list = { data: undefined, isPending: true };
    renderSubmenu(null);
    openSubmenu("Organizations");
    await flush();
    expect(bodyText()).toContain("Loading…");
  });

  it("switches to another organization, announces it and refreshes the page", async () => {
    const changed = vi.fn();
    window.addEventListener(ORGANIZATION_CHANGED_EVENT, changed);
    renderSubmenu("o1");
    openSubmenu("Lincoln High");
    await flush();
    await clickAsync(item("Roosevelt"));
    expect(orgs.setActive).toHaveBeenCalledWith({ organizationId: "o2" });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(orgs.refresh).toHaveBeenCalledTimes(1);
    window.removeEventListener(ORGANIZATION_CHANGED_EVENT, changed);
  });

  it("switches back to the personal workspace with a null organization", async () => {
    renderSubmenu("o1");
    openSubmenu("Lincoln High");
    await flush();
    await clickAsync(item("Personal"));
    expect(orgs.setActive).toHaveBeenCalledWith({ organizationId: null });
  });

  it("does nothing when the already-active workspace is picked", async () => {
    renderSubmenu("o1");
    openSubmenu("Lincoln High");
    await flush();
    await clickAsync([...document.querySelectorAll("[role=menuitem]")].find((el) => el.textContent === "Lincoln High")!);
    expect(orgs.setActive).not.toHaveBeenCalled();
    expect(orgs.refresh).not.toHaveBeenCalled();
  });
});

describe("CreateOrganizationDialog", () => {
  it("creates a trimmed, slugged organization, refreshes and closes", async () => {
    const onOpenChange = vi.fn();
    const changed = vi.fn();
    window.addEventListener(ORGANIZATION_CHANGED_EVENT, changed);
    mount(<CreateOrganizationDialog open onOpenChange={onOpenChange} />);
    await flush();
    expect(button("Create").disabled).toBe(true);

    change(document.querySelector("#organization-name")!, "  Lincoln High Debate ");
    expect(button("Create").disabled).toBe(false);
    submit(document.querySelector("form")!);
    await flush();

    expect(orgs.create).toHaveBeenCalledTimes(1);
    const arg = orgs.create.mock.calls[0][0];
    expect(arg.name).toBe("Lincoln High Debate");
    expect(arg.slug).toMatch(/^lincoln-high-debate-[0-9a-z]{6}$/);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(orgs.refresh).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    window.removeEventListener(ORGANIZATION_CHANGED_EVENT, changed);
  });

  it("ignores a blank name", async () => {
    mount(<CreateOrganizationDialog open onOpenChange={vi.fn()} />);
    await flush();
    change(document.querySelector("#organization-name")!, "   ");
    submit(document.querySelector("form")!);
    await flush();
    expect(orgs.create).not.toHaveBeenCalled();
  });

  it("shows the error and stays open when creation fails", async () => {
    orgs.create.mockResolvedValue({ error: { message: "Slug already taken" } });
    const onOpenChange = vi.fn();
    mount(<CreateOrganizationDialog open onOpenChange={onOpenChange} />);
    await flush();
    change(document.querySelector("#organization-name")!, "Team");
    submit(document.querySelector("form")!);
    await flush();
    expect(bodyText()).toContain("Slug already taken");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(orgs.refresh).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the error has none", async () => {
    orgs.create.mockResolvedValue({ error: {} });
    mount(<CreateOrganizationDialog open onOpenChange={vi.fn()} />);
    await flush();
    change(document.querySelector("#organization-name")!, "Team");
    submit(document.querySelector("form")!);
    await flush();
    expect(bodyText()).toContain("Could not create that organization.");
  });
});

describe("AddMembersDialog", () => {
  const page = (role: string, candidates = [{ id: "c1", name: "Casey", email: "c@x.com", image: null }]) => ({
    organization: { id: "o1", name: "Lincoln High", role },
    members: [
      { id: "m1", name: "Morgan", email: "m@x.com", image: null },
      { id: "m2", name: "", email: "n@x.com", image: null },
    ],
    candidates,
  });

  it("does not fetch while closed", async () => {
    const { calls } = mockFetch([]);
    mount(<AddMembersDialog open={false} onOpenChange={vi.fn()} />);
    await flush();
    expect(calls).toHaveLength(0);
  });

  it("lists members and lets an admin add a contact, then reloads the list", async () => {
    let loads = 0;
    const { calls } = mockFetch([
      { match: "/api/organizations/members", method: "POST", respond: { ok: true } },
      {
        match: "/api/organizations/members",
        respond: () => (++loads === 1 ? page("admin") : page("admin", [])),
      },
    ]);
    mount(<AddMembersDialog open onOpenChange={vi.fn()} />);
    await flush();
    expect(bodyText()).toContain("Members of Lincoln High");
    expect(bodyText()).toContain("Morgan");
    expect(bodyText()).toContain("Unnamed");
    expect(bodyText()).toContain("Casey");

    await clickAsync(button("Add"));
    const post = calls.find((call) => call.method === "POST");
    expect(post?.body).toEqual({ userId: "c1" });
    expect(bodyText()).toContain("Every contact is already a member.");
  });

  it("hides the contacts and explains for a plain member", async () => {
    mockFetch([{ match: "/api/organizations/members", respond: page("member") }]);
    mount(<AddMembersDialog open onOpenChange={vi.fn()} />);
    await flush();
    expect(bodyText()).toContain("Only an owner or admin can add members.");
    expect(bodyText()).not.toContain("Your contacts");
  });

  it("shows the server's error when members cannot be loaded", async () => {
    mockFetch([{ match: "/api/organizations/members", respond: { error: "No active organization" }, status: 400 }]);
    mount(<AddMembersDialog open onOpenChange={vi.fn()} />);
    await flush();
    expect(bodyText()).toContain("No active organization");
  });

  it("falls back to a generic message for an unreadable error response", async () => {
    mockFetch([{ match: "/api/organizations/members", respond: new Response("<html>", { status: 500 }) }]);
    mount(<AddMembersDialog open onOpenChange={vi.fn()} />);
    await flush();
    expect(bodyText()).toContain("Could not load members.");
  });

  it("reloads the list even when the add is rejected", async () => {
    const { calls } = mockFetch([
      { match: "/api/organizations/members", method: "POST", respond: jsonResponse({ error: "Already a member" }, 409) },
      { match: "/api/organizations/members", respond: () => page("owner") },
    ]);
    mount(<AddMembersDialog open onOpenChange={vi.fn()} />);
    await flush();
    await clickAsync(button("Add"));
    expect(calls.map((call) => call.method)).toEqual(["GET", "POST", "GET"]);
    expect(bodyText()).toContain("Casey");
    expect(button("Add").disabled).toBe(false);
  });
});
