/**
 * @fileoverview Contact groups: the pure name and picker rules in
 * `lib/contacts.ts` and the `/api/contacts/groups` client in
 * `state/contactGroups.ts`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_CONTACT_GROUP_NAME_LENGTH,
  normalizeContactGroupName,
  togglePickedGroup,
} from "../src/lib/contacts";
import {
  createContactGroup,
  deleteContactGroup,
  fetchContactGroups,
  updateContactGroup,
} from "../src/state/contactGroups";

afterEach(() => vi.unstubAllGlobals());

describe("normalizeContactGroupName", () => {
  it("trims, collapses whitespace and caps the length", () => {
    expect(normalizeContactGroupName("  Varsity \n squad ")).toBe("Varsity squad");
    expect(normalizeContactGroupName("x".repeat(100))).toBe("x".repeat(MAX_CONTACT_GROUP_NAME_LENGTH));
  });

  it("rejects blanks and non-strings", () => {
    expect(normalizeContactGroupName("   ")).toBeNull();
    expect(normalizeContactGroupName(undefined)).toBeNull();
    expect(normalizeContactGroupName(4)).toBeNull();
  });
});

describe("togglePickedGroup", () => {
  const available = new Set(["a", "b", "c"]);

  it("picks every available member", () => {
    expect([...togglePickedGroup(new Set(["z"]), ["a", "b", "gone"], available)].sort()).toEqual(["a", "b", "z"]);
  });

  it("completes a partly picked group instead of clearing it", () => {
    expect([...togglePickedGroup(new Set(["a"]), ["a", "b"], available)].sort()).toEqual(["a", "b"]);
  });

  it("clears the group when every member is already picked, leaving others alone", () => {
    expect([...togglePickedGroup(new Set(["a", "b", "z"]), ["a", "b"], available)]).toEqual(["z"]);
  });

  it("does nothing for a group with no available members, and never mutates its input", () => {
    const picked = new Set(["a"]);
    expect(togglePickedGroup(picked, ["gone"], available)).toEqual(picked);
    togglePickedGroup(picked, ["b"], available);
    expect([...picked]).toEqual(["a"]);
  });
});

function stubFetch(response: { ok: boolean; json?: unknown } | Error) {
  const fn = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return { ok: response.ok, json: async () => response.json } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("group client", () => {
  it("fetches groups, and resolves null when signed out or offline", async () => {
    stubFetch({ ok: true, json: { groups: [{ id: 1, name: "A", memberIds: [] }] } });
    expect(await fetchContactGroups()).toEqual([{ id: 1, name: "A", memberIds: [] }]);
    stubFetch({ ok: true, json: {} });
    expect(await fetchContactGroups()).toEqual([]);
    stubFetch({ ok: false });
    expect(await fetchContactGroups()).toBeNull();
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch(new Error("offline"));
    expect(await fetchContactGroups()).toBeNull();
  });

  it("sends create and update bodies and returns the group", async () => {
    const group = { id: 2, name: "B", memberIds: ["u"] };
    const fn = stubFetch({ ok: true, json: { group } });
    expect(await createContactGroup({ name: "B", memberIds: ["u"] })).toEqual(group);
    expect(fn).toHaveBeenCalledWith(
      "/api/contacts/groups",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "B", memberIds: ["u"] }) }),
    );
    expect(await updateContactGroup({ id: 2, name: "C" })).toEqual(group);
    expect(fn).toHaveBeenLastCalledWith(
      "/api/contacts/groups",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ id: 2, name: "C" }) }),
    );
  });

  it("throws the server's message on a refused write", async () => {
    stubFetch({ ok: false, json: { error: "You already have a group with that name." } });
    await expect(createContactGroup({ name: "B" })).rejects.toThrow("You already have a group with that name.");
    stubFetch({ ok: false, json: {} });
    await expect(updateContactGroup({ id: 1 })).rejects.toThrow("Could not update that group.");
  });

  it("deletes by id", async () => {
    const fn = stubFetch({ ok: true });
    await deleteContactGroup(7);
    expect(fn).toHaveBeenCalledWith("/api/contacts/groups?id=7", { method: "DELETE" });
    stubFetch({ ok: false, json: { error: "No group with that id." } });
    await expect(deleteContactGroup(7)).rejects.toThrow("No group with that id.");
  });
});
