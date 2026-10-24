// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `ContactsPanel`: the sign-in prompt, the
 * contact list with its online count and actions, incoming / outgoing
 * requests and the block list, and the add-a-contact search (debounced user
 * search, already-known states, and requests by email).
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContactsPanel } from "../src/panels/ContactsPanel";
import { contact, fakeContacts, user } from "./helpers/contacts";
import { click, flush, mount, type, type Mounted } from "./helpers/mount";

const mocks = vi.hoisted(() => ({
  searchUsers: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("../src/state/contacts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  searchUsers: mocks.searchUsers,
}));

let view: Mounted;
const text = () => view.container.textContent ?? "";
const button = (label: string, nth = 0) =>
  Array.from(view.container.querySelectorAll("button")).filter((el) => el.textContent?.trim() === label)[nth];
const search = () => view.container.querySelector('input[aria-label="Search registered users"]') as HTMLInputElement;
/** Waits out the search box's 250 ms debounce. */
const debounce = () => flush(() => new Promise((resolve) => setTimeout(resolve, 300)));

const alice = user("alice");
const bob = user("bob");

beforeEach(() => {
  mocks.searchUsers.mockReset().mockResolvedValue([]);
  Object.values(mocks.toast).forEach((fn) => fn.mockReset());
});

afterEach(async () => {
  await view?.unmount();
});

describe("ContactsPanel", () => {
  it("asks you to sign in when disabled", async () => {
    view = await mount(createElement(ContactsPanel, { enabled: false }));
    expect(text()).toContain("Sign in to manage contacts.");
  });

  it("shows loading, then the empty state", async () => {
    view = await mount(createElement(ContactsPanel, { contacts: fakeContacts({ loading: true, loaded: false }) }));
    expect(text()).toContain("Loading contacts…");
    await view.unmount();
    view = await mount(createElement(ContactsPanel, { contacts: fakeContacts() }));
    expect(text()).toContain("No contacts yet.");
  });

  it("lists contacts with presence and wires share, remove and block", async () => {
    const contacts = fakeContacts({ contacts: [contact(1, alice, true), contact(2, bob)] });
    const onShareWith = vi.fn();
    view = await mount(createElement(ContactsPanel, { contacts, onShareWith }));

    expect(text()).toContain("1 online");
    expect(text()).toContain("2 contacts");
    expect(text()).toContain("Available");
    expect(text()).toContain("Away");

    await click(button("Share a card"));
    expect(onShareWith).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    await click(button("Remove"));
    expect(contacts.remove).toHaveBeenCalledWith(1);
    expect(mocks.toast.success).toHaveBeenCalledWith("Contact removed.");
    await click(button("Block", 1));
    expect(contacts.block).toHaveBeenCalledWith("bob");
    expect(mocks.toast.success).toHaveBeenCalledWith("Bob blocked.");
  });

  it("reports a failed action as an error toast", async () => {
    const contacts = fakeContacts({
      contacts: [contact(1, alice)],
      remove: vi.fn(async () => {
        throw new Error("Server said no");
      }),
    });
    view = await mount(createElement(ContactsPanel, { contacts }));
    await click(button("Remove"));
    expect(mocks.toast.error).toHaveBeenCalledWith("Server said no");
  });

  it("hides Remove for an organization's members", async () => {
    const contacts = fakeContacts({
      organization: { id: "org", name: "Lincoln High", role: "member" },
      contacts: [contact(0, alice)],
    });
    view = await mount(createElement(ContactsPanel, { contacts }));
    expect(text()).toContain("Members of Lincoln High");
    expect(button("Remove")).toBeUndefined();
    await view.unmount();
    view = await mount(
      createElement(ContactsPanel, { contacts: fakeContacts({ organization: contacts.organization }) }),
    );
    expect(text()).toContain("No other members yet.");
  });

  it("accepts, declines and blocks incoming requests, cancels sent ones and unblocks", async () => {
    const contacts = fakeContacts({
      incoming: [{ id: 5, user: alice, createdAt: "2026-01-01" }],
      outgoing: [{ id: 6, user: bob, createdAt: "2026-01-01" }],
      blocked: [{ user: user("carol"), createdAt: "2026-01-01" }],
    });
    view = await mount(createElement(ContactsPanel, { contacts }));

    expect(text()).toContain("Requests for you");
    expect(text()).toContain("Sent requests");
    expect(text()).toContain("Pending");

    await click(button("Accept"));
    expect(contacts.accept).toHaveBeenCalledWith(5);
    await click(button("Decline"));
    expect(contacts.decline).toHaveBeenCalledWith(5);
    await click(button("Block"));
    expect(contacts.block).toHaveBeenCalledWith("alice");
    await click(button("Cancel"));
    expect(contacts.remove).toHaveBeenCalledWith(6);
    await click(button("Unblock"));
    expect(contacts.unblock).toHaveBeenCalledWith("carol");
  });

  it("searches users, marks known ones and sends a request", async () => {
    mocks.searchUsers.mockResolvedValue([alice, user("dave")]);
    const contacts = fakeContacts({ contacts: [contact(1, alice)] });
    view = await mount(createElement(ContactsPanel, { contacts }));

    await type(search(), "a");
    await debounce();
    expect(mocks.searchUsers).toHaveBeenCalledWith("a");
    expect(text()).toContain("Contact");
    await click(button("Add"));
    expect(contacts.request).toHaveBeenCalledWith({ userId: "dave" });
    expect(mocks.toast.success).toHaveBeenCalledWith("Contact request sent.");
    expect(search().value).toBe("");
  });

  it("offers a request by email when nobody matches", async () => {
    const contacts = fakeContacts({ request: vi.fn(async () => ({ status: "already-contacts" as const })) });
    view = await mount(createElement(ContactsPanel, { contacts }));

    await type(search(), "nobody");
    await debounce();
    expect(text()).toContain("No registered users match.");

    await type(search(), "new@example.com");
    await debounce();
    expect(text()).toContain("No account with that email yet");
    await click(button("Send request"));
    expect(contacts.request).toHaveBeenCalledWith({ email: "new@example.com" });
    expect(mocks.toast.success).toHaveBeenCalledWith("You're already contacts.");
  });
});
