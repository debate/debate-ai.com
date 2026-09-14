// @vitest-environment jsdom
/**
 * @fileoverview Covers the browser filesystem adapter — the one `npm run dev`
 * and the suite run against.
 *
 * It has two modes and both matter. Where the File System Access API exists it
 * is a real editor: a file opened through a picker is written back through its
 * handle. Everywhere else it degrades to an in-memory map mirrored into
 * localStorage, so a dev reload keeps the flow that was open. The tests drive
 * both, plus the cancelled-picker path, which must read as "no file chosen"
 * rather than an error.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFlowFs } from "../src/lib/persistence/flowFsMemory";

const STORE_KEY = "ebb-dev-flow-files";
const RECENTS_KEY = "ebb-dev-recents";
const FLOWS_DIR = "/home/dev/Documents/ebb";

type Pickers = {
  showOpenFilePicker?: unknown;
  showSaveFilePicker?: unknown;
  showDirectoryPicker?: unknown;
};

/** A file handle in the shape the adapter uses, recording what was written. */
function fakeHandle(name: string, text = "") {
  const written: string[] = [];
  return {
    written,
    closed: 0,
    handle: {
      name,
      getFile: async () => ({ text: async () => text }),
      createWritable: async () => ({
        write: async (chunk: string) => {
          written.push(chunk);
        },
        close: async () => {},
      }),
    } as unknown as FileSystemFileHandle,
  };
}

const abort = () => new DOMException("The user aborted a request.", "AbortError");

const clearPickers = () => {
  for (const key of [
    "showOpenFilePicker",
    "showSaveFilePicker",
    "showDirectoryPicker",
  ]) {
    delete (window as unknown as Record<string, unknown>)[key];
  }
};

beforeEach(() => {
  localStorage.clear();
  clearPickers();
});

afterEach(() => {
  clearPickers();
  vi.restoreAllMocks();
});

describe("locations", () => {
  it("reports the flows directory and home", async () => {
    await expect(createFlowFs().locations()).resolves.toEqual({
      flowsDir: FLOWS_DIR,
      home: "/home/dev",
    });
  });
});

describe("createFlow", () => {
  it("writes a new flow under the given directory", async () => {
    const fs = createFlowFs();
    const path = await fs.createFlow(FLOWS_DIR, "round.ebb", "{}");

    expect(path).toBe(`${FLOWS_DIR}/round.ebb`);
    expect(await fs.readFlow(path)).toMatchObject({ text: "{}" });
  });

  it("does not overwrite an existing name", async () => {
    const fs = createFlowFs();
    const first = await fs.createFlow(FLOWS_DIR, "round.ebb", "one");
    const second = await fs.createFlow(FLOWS_DIR, "round.ebb", "two");

    expect(second).not.toBe(first);
    expect((await fs.readFlow(first))?.text).toBe("one");
    expect((await fs.readFlow(second))?.text).toBe("two");
  });

  it("only dedupes against names in the same directory", async () => {
    const fs = createFlowFs();
    await fs.createFlow("/elsewhere", "round.ebb", "one");
    const path = await fs.createFlow(FLOWS_DIR, "round.ebb", "two");

    expect(path).toBe(`${FLOWS_DIR}/round.ebb`);
  });

  it("stamps the new file so readFlow can report an mtime", async () => {
    const fs = createFlowFs();
    const path = await fs.createFlow(FLOWS_DIR, "round.ebb", "{}");

    expect((await fs.readFlow(path))?.mtimeMs).toBeGreaterThan(0);
  });
});

describe("readFlow", () => {
  it("returns null for a path that was never written", async () => {
    await expect(createFlowFs().readFlow("/nope.ebb")).resolves.toBeNull();
  });

  it("reports a zero mtime for a file restored from a previous session", async () => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ [`${FLOWS_DIR}/old.ebb`]: "restored" }),
    );
    const fs = createFlowFs();

    expect(await fs.readFlow(`${FLOWS_DIR}/old.ebb`)).toEqual({
      text: "restored",
      mtimeMs: 0,
    });
  });
});

describe("writeFlow", () => {
  it("stores the text and returns the stamp it wrote", async () => {
    const fs = createFlowFs();
    const mtimeMs = await fs.writeFlow(`${FLOWS_DIR}/a.ebb`, "hello");

    expect(await fs.readFlow(`${FLOWS_DIR}/a.ebb`)).toEqual({
      text: "hello",
      mtimeMs,
    });
  });

  it("replaces the previous contents", async () => {
    const fs = createFlowFs();
    await fs.writeFlow(`${FLOWS_DIR}/a.ebb`, "one");
    await fs.writeFlow(`${FLOWS_DIR}/a.ebb`, "two");

    expect((await fs.readFlow(`${FLOWS_DIR}/a.ebb`))?.text).toBe("two");
  });

  it("writes through to a real file handle when the file came from a picker", async () => {
    const { handle, written } = fakeHandle("picked.ebb", "on disk");
    (window as unknown as Pickers).showOpenFilePicker = vi
      .fn()
      .mockResolvedValue([handle]);

    const fs = createFlowFs();
    const path = (await fs.pickOpenPath()) as string;
    await fs.writeFlow(path, "edited");

    expect(written).toEqual(["edited"]);
  });
});

describe("persistence across a reload", () => {
  it("mirrors written files into localStorage", async () => {
    const fs = createFlowFs();
    await fs.writeFlow(`${FLOWS_DIR}/a.ebb`, "hello");

    expect(JSON.parse(localStorage.getItem(STORE_KEY) as string)).toEqual({
      [`${FLOWS_DIR}/a.ebb`]: "hello",
    });
  });

  it("restores files a previous session left behind", async () => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ [`${FLOWS_DIR}/old.ebb`]: "restored" }),
    );

    expect((await createFlowFs().readFlow(`${FLOWS_DIR}/old.ebb`))?.text).toBe(
      "restored",
    );
  });

  it("starts empty rather than throwing on a corrupt mirror", async () => {
    localStorage.setItem(STORE_KEY, "{ not json");
    await expect(
      createFlowFs().readFlow(`${FLOWS_DIR}/old.ebb`),
    ).resolves.toBeNull();
  });

  it("keeps working when localStorage refuses the write", async () => {
    const fs = createFlowFs();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });

    await expect(fs.writeFlow(`${FLOWS_DIR}/a.ebb`, "hello")).resolves.toBeTypeOf(
      "number",
    );
  });
});

describe("pickOpenPath", () => {
  it("falls back to the first known file with no picker available", async () => {
    const fs = createFlowFs();
    const path = await fs.createFlow(FLOWS_DIR, "only.ebb", "{}");

    expect(await fs.pickOpenPath()).toBe(path);
  });

  it("reports no file when there is neither a picker nor a file", async () => {
    await expect(createFlowFs().pickOpenPath()).resolves.toBeNull();
  });

  it("adopts the file the picker returned, contents and all", async () => {
    const { handle } = fakeHandle("picked.ebb", "from disk");
    (window as unknown as Pickers).showOpenFilePicker = vi
      .fn()
      .mockResolvedValue([handle]);

    const fs = createFlowFs();
    const path = await fs.pickOpenPath();

    expect(path).toBe(`${FLOWS_DIR}/picked.ebb`);
    expect((await fs.readFlow(path as string))?.text).toBe("from disk");
  });

  it("asks for a single ebb or json file", async () => {
    const show = vi.fn().mockResolvedValue([fakeHandle("a.ebb").handle]);
    (window as unknown as Pickers).showOpenFilePicker = show;

    await createFlowFs().pickOpenPath();

    expect(show.mock.calls[0][0]).toMatchObject({ multiple: false });
  });

  it("reads a cancelled picker as no file chosen", async () => {
    (window as unknown as Pickers).showOpenFilePicker = vi
      .fn()
      .mockRejectedValue(abort());

    await expect(createFlowFs().pickOpenPath()).resolves.toBeNull();
  });

  it("surfaces a real picker failure", async () => {
    (window as unknown as Pickers).showOpenFilePicker = vi
      .fn()
      .mockRejectedValue(new Error("disk on fire"));

    await expect(createFlowFs().pickOpenPath()).rejects.toThrow("disk on fire");
  });

  it("reports no file when the picker returns nothing", async () => {
    (window as unknown as Pickers).showOpenFilePicker = vi
      .fn()
      .mockResolvedValue([]);

    await expect(createFlowFs().pickOpenPath()).resolves.toBeNull();
  });
});

describe("pickSavePath", () => {
  it("puts the suggested name in the flows directory with no picker", async () => {
    await expect(
      createFlowFs().pickSavePath("/somewhere/else/round.ebb"),
    ).resolves.toBe(`${FLOWS_DIR}/round.ebb`);
  });

  it("uses the name the picker settled on", async () => {
    (window as unknown as Pickers).showSaveFilePicker = vi
      .fn()
      .mockResolvedValue(fakeHandle("chosen.ebb").handle);

    await expect(createFlowFs().pickSavePath("round.ebb")).resolves.toBe(
      `${FLOWS_DIR}/chosen.ebb`,
    );
  });

  it("seeds the picker with the suggested filename", async () => {
    const show = vi.fn().mockResolvedValue(fakeHandle("chosen.ebb").handle);
    (window as unknown as Pickers).showSaveFilePicker = show;

    await createFlowFs().pickSavePath("/a/b/round.ebb");

    expect(show.mock.calls[0][0]).toMatchObject({ suggestedName: "round.ebb" });
  });

  it("reads a cancelled picker as no path chosen", async () => {
    (window as unknown as Pickers).showSaveFilePicker = vi
      .fn()
      .mockRejectedValue(abort());

    await expect(createFlowFs().pickSavePath("round.ebb")).resolves.toBeNull();
  });

  it("surfaces a real picker failure", async () => {
    (window as unknown as Pickers).showSaveFilePicker = vi
      .fn()
      .mockRejectedValue(new Error("nope"));

    await expect(createFlowFs().pickSavePath("round.ebb")).rejects.toThrow("nope");
  });
});

describe("pickDirectory", () => {
  it("reports no directory when the browser cannot pick one", async () => {
    await expect(createFlowFs().pickDirectory()).resolves.toBeNull();
  });

  it("stands in a home-relative path for the folder's name", async () => {
    (window as unknown as Pickers).showDirectoryPicker = vi
      .fn()
      .mockResolvedValue({ name: "Rounds" });

    await expect(createFlowFs().pickDirectory()).resolves.toBe("/home/dev/Rounds");
  });

  it("reads a cancelled picker as no directory chosen", async () => {
    (window as unknown as Pickers).showDirectoryPicker = vi
      .fn()
      .mockRejectedValue(abort());

    await expect(createFlowFs().pickDirectory()).resolves.toBeNull();
  });

  it("surfaces a real picker failure", async () => {
    (window as unknown as Pickers).showDirectoryPicker = vi
      .fn()
      .mockRejectedValue(new Error("nope"));

    await expect(createFlowFs().pickDirectory()).rejects.toThrow("nope");
  });
});

describe("recents", () => {
  it("reports nothing before anything is written", async () => {
    await expect(createFlowFs().readRecents()).resolves.toBeNull();
  });

  it("round-trips the recents blob", async () => {
    const fs = createFlowFs();
    await fs.writeRecents('["/a.ebb"]');

    expect(await fs.readRecents()).toBe('["/a.ebb"]');
    expect(localStorage.getItem(RECENTS_KEY)).toBe('["/a.ebb"]');
  });
});

describe("reveal", () => {
  it("is a no-op, since a browser cannot show a file in its folder", async () => {
    await expect(createFlowFs().reveal("/a.ebb")).resolves.toBeUndefined();
  });
});
