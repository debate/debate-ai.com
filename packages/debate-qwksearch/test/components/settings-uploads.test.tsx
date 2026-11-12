/** @vitest-environment jsdom */
/**
 * @fileoverview Uploads settings: storage usage against the quota, the
 * signed-out message, the file list with sizes and dates, and deleting one
 * file, a selection, or everything.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const grab = vi.hoisted(() => vi.fn());
vi.mock("grab-url", () => ({ default: grab }));

import Uploads from "../../src/components/Settings/Sections/Uploads";
import { bodyText, button, cleanup, clickAsync, flush, installDomShims, mount, toggle } from "../helpers/dom";

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

const files = [
  { fileId: "f1", fileName: "case.docx", fileExtension: "docx", sizeBytes: 2048, createdAt: 1_700_000_000 },
  { fileId: "f2", fileName: "https://example.com", fileExtension: "url", sizeBytes: 0, createdAt: "not a date" },
  { fileId: "f3", fileName: "big.pdf", fileExtension: "pdf", sizeBytes: 15 * 1024 * 1024 },
];

function listing(list = files, used = 950, quota = 1000) {
  return { files: list, usage: { used, quota, remaining: quota - used } };
}

describe("Uploads settings", () => {
  it("shows usage, sizes and a near-full bar", async () => {
    grab.mockResolvedValue(listing());
    mount(<Uploads />);
    expect(document.querySelector(".animate-spin")).not.toBeNull();
    await flush();
    expect(bodyText()).toContain("950 B of 1000 B (95%)");
    expect(document.querySelector(".bg-red-500")).not.toBeNull();
    expect(bodyText()).toContain("3 files");
    expect(bodyText()).toContain("DOCX · 2.0 KB ·");
    expect(bodyText()).toContain("URL · 0 B");
    expect(bodyText()).toContain("PDF · 15 MB");
  });

  it("asks a signed-out user to sign in", async () => {
    grab.mockResolvedValue({ message: "Sign in to list your uploads" });
    mount(<Uploads />);
    await flush();
    expect(bodyText()).toContain("Sign in to view and manage your uploaded files.");
  });

  it("reports a failed listing", async () => {
    grab.mockResolvedValue({ message: "boom" });
    mount(<Uploads />);
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Failed to load uploads.");
    expect(bodyText()).toContain("No uploads yet.");
  });

  it("deletes one file, then a selection, then everything", async () => {
    grab.mockImplementation(async (path: string, opts?: { method?: string }) =>
      opts?.method === "DELETE" ? { success: true } : listing(files, 10, 1000),
    );
    mount(<Uploads />);
    await flush();
    expect(document.querySelector(".bg-sky-500")).not.toBeNull();

    await clickAsync(document.querySelector('button[title="Delete file"]')!);
    expect(grab).toHaveBeenCalledWith("doc/uploads?fileId=f1", { method: "DELETE" });
    expect(toast.success).toHaveBeenCalledWith("Deleted 1 file.");

    const boxes = [...document.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
    toggle(boxes[1]);
    toggle(boxes[2]);
    expect(bodyText()).toContain("2 selected");
    toggle(boxes[2]);
    toggle(boxes[2]);
    await clickAsync(button("Delete selected"));
    expect(grab).toHaveBeenCalledWith(`doc/uploads?fileId=${encodeURIComponent("f2,f3")}`, { method: "DELETE" });
    expect(toast.success).toHaveBeenCalledWith("Deleted 2 files.");

    await clickAsync(button("Delete all"));
    expect(grab).toHaveBeenCalledWith("doc/uploads?all=true", { method: "DELETE" });
    expect(toast.success).toHaveBeenCalledWith("All uploads deleted.");

    await clickAsync(button("Refresh"));
    expect(grab.mock.calls.filter(([p]) => p === "doc/uploads").length).toBeGreaterThanOrEqual(5);
  });

  it("reports a failed delete", async () => {
    grab.mockImplementation(async (_path: string, opts?: { method?: string }) =>
      opts?.method === "DELETE" ? { success: false, message: "nope" } : listing([files[0]]),
    );
    mount(<Uploads />);
    await flush();
    expect(bodyText()).toContain("1 file");
    await clickAsync(button("Delete all"));
    expect(toast.error).toHaveBeenCalledWith("Failed to delete uploads.");
  });
});
