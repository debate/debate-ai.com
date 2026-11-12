/** @vitest-environment jsdom */
/**
 * @fileoverview The File Sources settings section: lists the stored sources,
 * adds a source of each backend type with its own credential fields, edits
 * and deletes one, and refuses to save a source with no name.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import FileSources from "../../src/components/Settings/Sections/FileSources";
import { getFileSources } from "../../src/components/lib/file-sources";
import { bodyText, button, change, cleanup, click, installDomShims, mount, toggle } from "../helpers/dom";

beforeAll(installDomShims);
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const input = (placeholder: string) =>
  document.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"], textarea[placeholder="${placeholder}"]`)!;

describe("File Sources settings", () => {
  it("shows the built-in local source without edit or delete controls", () => {
    mount(<FileSources />);
    expect(bodyText()).toContain("Add New File Source");
    const local = getFileSources().find((s) => s.id === "local-default");
    expect(local).toBeDefined();
    expect(bodyText()).toContain(local!.name);
    // Only the "Add" button: the local row has no edit/delete icons.
    expect(document.querySelectorAll("button")).toHaveLength(1);
  });

  it("refuses to add a source without a name", () => {
    mount(<FileSources />);
    click(button("Add New File Source"));
    click(button("Add Source"));
    expect(toast.error).toHaveBeenCalledWith("Please enter a source name");
    expect(getFileSources()).toHaveLength(1);
  });

  it("adds an SSH source with its host, port, user and path", () => {
    mount(<FileSources />);
    click(button("Add New File Source"));
    change(input("My Remote Files"), "Box");
    change(input("example.com"), "box.example.com");
    change(input("22"), "2222");
    change(input("user"), "ada");
    change(input("••••••••"), "pw");
    change(input("/home/user/documents"), "/srv");
    click(button("Add Source"));

    expect(toast.success).toHaveBeenCalledWith("Source added");
    const ssh = getFileSources().find((s) => s.type === "ssh")!;
    expect(ssh.name).toBe("Box");
    expect(ssh.credentials).toMatchObject({ host: "box.example.com", port: 2222, username: "ada", password: "pw", basePath: "/srv" });
    expect(bodyText()).toContain("Box");
    expect(bodyText()).toContain("SSH");
  });

  it.each([
    ["s3", ["AKIAIOSFODNN7EXAMPLE", "••••••••", "us-east-1", "my-bucket"], "S3"],
    ["r2", ["your-account-id", "your-access-key-id", "••••••••", "my-bucket"], "R2"],
    ["b2", ["your-key-id", "••••••••", "my-bucket", "https://s3.us-west-004.backblazeb2.com"], "Backblaze B2"],
    ["turso", ["https://your-db.turso.io", "••••••••", "my-database"], "Turso DB"],
  ])("adds a %s source from its own credential fields", (type, placeholders, label) => {
    mount(<FileSources />);
    click(button("Add New File Source"));
    change(document.querySelector("select")!, type);
    change(input("My Remote Files"), `My ${type}`);
    for (const p of placeholders) change(input(p), `${p}-value`);
    click(button("Add Source"));
    const added = getFileSources().find((s) => s.type === type)!;
    expect(added.name).toBe(`My ${type}`);
    expect(Object.values(added.credentials as object)).toEqual(
      expect.arrayContaining(placeholders.map((p) => `${p}-value`)),
    );
    expect(bodyText()).toContain(label);
  });

  it("shows the Google login prompt only once Turso's Docs sync is ticked", () => {
    mount(<FileSources />);
    click(button("Add New File Source"));
    change(document.querySelector("select")!, "turso");
    expect(bodyText()).not.toContain("Login with Google");
    toggle(document.querySelector<HTMLInputElement>("input[type=checkbox]")!);
    expect(bodyText()).toContain("Login with Google");
  });

  it("splits Google Docs folder ids and starts unauthenticated", () => {
    mount(<FileSources />);
    click(button("Add New File Source"));
    change(document.querySelector("select")!, "gdocs");
    expect(bodyText()).toContain("Not authenticated");
    expect(button("Authenticate")).toBeDefined();
    change(input("My Remote Files"), "Drive");
    change(input("folder-id-1, folder-id-2"), "a, b ,, c");
    click(button("Add Source"));
    const gdocs = getFileSources().find((s) => s.type === "gdocs")!;
    expect(gdocs.credentials).toMatchObject({ folderIds: ["a", "b", "c"], isAuthenticated: false });
    expect(bodyText()).toContain("Google Docs");
  });

  it("cancels an add without saving", () => {
    mount(<FileSources />);
    click(button("Add New File Source"));
    change(input("My Remote Files"), "Nope");
    click(button("Cancel"));
    expect(getFileSources()).toHaveLength(1);
    expect(bodyText()).toContain("Add New File Source");
  });

  it("edits and then deletes a stored source", () => {
    mount(<FileSources />);
    click(button("Add New File Source"));
    change(input("My Remote Files"), "Old");
    change(input("example.com"), "h");
    click(button("Add Source"));

    // Row actions: [edit, delete] for the SSH row, then the Add button.
    const [edit] = [...document.querySelectorAll("button")];
    click(edit);
    change(input("My Remote Files"), "New name");
    click(button("Save"));
    expect(toast.success).toHaveBeenCalledWith("Source updated");
    expect(getFileSources().find((s) => s.type === "ssh")!.name).toBe("New name");

    click([...document.querySelectorAll("button")][0]);
    click(button("Cancel"));
    expect(bodyText()).toContain("New name");

    const del = [...document.querySelectorAll("button")][1];
    click(del);
    expect(toast.success).toHaveBeenCalledWith("Source deleted");
    expect(getFileSources().some((s) => s.type === "ssh")).toBe(false);
  });
});
