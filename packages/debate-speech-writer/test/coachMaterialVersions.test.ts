import { beforeEach, describe, expect, it } from "vitest";
import {
  adoptMaterialVersion,
  appendMaterialVersion,
  deleteVersionsForMaterial,
  listAllCoachMaterialVersions,
  listVersionsForMaterial,
  materialFromVersion,
  MAX_VERSIONS_PER_MATERIAL,
} from "../src/state/coachMaterialVersions";
import type { CoachMaterial } from "../src/coach/team-coach-materials";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment is `node`, with no DOM. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const LECTURE: CoachMaterial = {
  id: "lecture-1",
  kind: "lecture_transcript",
  title: "Topicality Basics",
  topic: "T",
  tags: ["theory"],
  text: "A lecture transcript about topicality.",
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("appendMaterialVersion", () => {
  it("snapshots a material's fields under its id with a replacedAt timestamp", () => {
    const version = appendMaterialVersion(LECTURE, 1000);

    expect(version).toEqual({
      id: "lecture-1-v1000-0",
      materialId: "lecture-1",
      kind: "lecture_transcript",
      title: "Topicality Basics",
      topic: "T",
      tags: ["theory"],
      text: "A lecture transcript about topicality.",
      replacedAt: 1000,
    });
    expect(listVersionsForMaterial("lecture-1")).toEqual([version]);
  });

  it("defaults replacedAt to the current time when not given", () => {
    const before = Date.now();
    const version = appendMaterialVersion(LECTURE);
    expect(version.replacedAt).toBeGreaterThanOrEqual(before);
  });

  it("assigns distinct ids for two overwrites within the same millisecond", () => {
    const first = appendMaterialVersion(LECTURE, 5000);
    const second = appendMaterialVersion({ ...LECTURE, title: "Again" }, 5000);
    expect(first.id).not.toBe(second.id);
  });

  it("keeps versions for different materials separate", () => {
    appendMaterialVersion(LECTURE, 1000);
    appendMaterialVersion({ ...LECTURE, id: "camp-1" }, 2000);

    expect(listVersionsForMaterial("lecture-1")).toHaveLength(1);
    expect(listVersionsForMaterial("camp-1")).toHaveLength(1);
  });

  it("caps versions per material at MAX_VERSIONS_PER_MATERIAL, dropping the oldest", () => {
    for (let i = 0; i < MAX_VERSIONS_PER_MATERIAL + 3; i++) {
      appendMaterialVersion({ ...LECTURE, title: `Revision ${i}` }, 1000 + i);
    }

    const versions = listVersionsForMaterial("lecture-1");
    expect(versions).toHaveLength(MAX_VERSIONS_PER_MATERIAL);
    // Newest first; the three oldest (Revision 0, 1, 2) should be gone.
    expect(versions[0]?.title).toBe(`Revision ${MAX_VERSIONS_PER_MATERIAL + 2}`);
    expect(versions.some((v) => v.title === "Revision 0")).toBe(false);
  });
});

describe("listVersionsForMaterial", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listVersionsForMaterial("lecture-1")).toEqual([]);
  });

  it("returns versions newest first", () => {
    appendMaterialVersion({ ...LECTURE, title: "First" }, 1000);
    appendMaterialVersion({ ...LECTURE, title: "Second" }, 2000);

    const versions = listVersionsForMaterial("lecture-1");
    expect(versions.map((v) => v.title)).toEqual(["Second", "First"]);
  });
});

describe("listAllCoachMaterialVersions", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listAllCoachMaterialVersions()).toEqual([]);
  });

  it("returns every version across every material, insertion order", () => {
    const first = appendMaterialVersion(LECTURE, 1000);
    const second = appendMaterialVersion({ ...LECTURE, id: "camp-1" }, 2000);

    expect(listAllCoachMaterialVersions()).toEqual([first, second]);
  });
});

describe("deleteVersionsForMaterial", () => {
  it("removes every version of the given material only", () => {
    appendMaterialVersion(LECTURE, 1000);
    appendMaterialVersion({ ...LECTURE, id: "camp-1" }, 2000);

    deleteVersionsForMaterial("lecture-1");

    expect(listVersionsForMaterial("lecture-1")).toEqual([]);
    expect(listVersionsForMaterial("camp-1")).toHaveLength(1);
  });

  it("is a no-op when no versions exist for the id", () => {
    expect(() => deleteVersionsForMaterial("missing")).not.toThrow();
  });

  it("returns the ids that were removed, and an empty array when none were", () => {
    const version = appendMaterialVersion(LECTURE, 1000);
    expect(deleteVersionsForMaterial("lecture-1")).toEqual([version.id]);
    expect(deleteVersionsForMaterial("missing")).toEqual([]);
  });
});

describe("adoptMaterialVersion", () => {
  it("inserts a version that isn't already stored", () => {
    const version = appendMaterialVersion(LECTURE, 1000);
    deleteVersionsForMaterial("lecture-1");
    expect(listVersionsForMaterial("lecture-1")).toEqual([]);

    adoptMaterialVersion(version);

    expect(listVersionsForMaterial("lecture-1")).toEqual([version]);
  });

  it("upserts by id rather than duplicating an already-stored version", () => {
    const version = appendMaterialVersion(LECTURE, 1000);
    adoptMaterialVersion({ ...version, title: "Adopted title" });

    const versions = listVersionsForMaterial("lecture-1");
    expect(versions).toHaveLength(1);
    expect(versions[0]?.title).toBe("Adopted title");
  });

  it("does not trim against MAX_VERSIONS_PER_MATERIAL", () => {
    for (let i = 0; i < MAX_VERSIONS_PER_MATERIAL; i++) {
      appendMaterialVersion({ ...LECTURE, title: `Revision ${i}` }, 1000 + i);
    }
    adoptMaterialVersion({
      id: "adopted-extra",
      materialId: "lecture-1",
      kind: "lecture_transcript",
      title: "Adopted extra",
      tags: [],
      text: "extra",
      replacedAt: 99999,
    });

    expect(listVersionsForMaterial("lecture-1")).toHaveLength(MAX_VERSIONS_PER_MATERIAL + 1);
  });
});

describe("materialFromVersion", () => {
  it("rebuilds a CoachMaterial from a version snapshot, keyed by materialId", () => {
    const version = appendMaterialVersion(LECTURE, 1000);
    expect(materialFromVersion(version)).toEqual({ ...LECTURE, status: "pending" });
  });

  it("always comes back pending, even when the snapshotted material was approved", () => {
    const version = appendMaterialVersion({ ...LECTURE, status: "approved", reviewedBy: "Coach K" }, 1000);
    expect(materialFromVersion(version).status).toBe("pending");
  });
});
