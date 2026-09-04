import { beforeEach, describe, expect, it } from "vitest";
import {
  adoptCoachMaterial,
  buildCoachMaterialLibraryFromStore,
  deleteCoachMaterial,
  findRelevantMaterialsFromStore,
  getCoachMaterial,
  listCoachMaterials,
  listCoachMaterialTagsFromStore,
  listPendingCoachMaterialsFromStore,
  saveCoachMaterial,
  setCoachMaterialReviewStatus,
} from "../src/state/coachMaterials";
import { listVersionsForMaterial } from "../src/state/coachMaterialVersions";
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

const CAMP: CoachMaterial = {
  id: "camp-1",
  kind: "camp_material",
  title: "Camp Handout",
  tags: ["case"],
  text: "A camp handout on case construction.",
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listCoachMaterials", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listCoachMaterials()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("coachMaterials", "{not json");
    expect(listCoachMaterials()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("coachMaterials", JSON.stringify({ not: "an array" }));
    expect(listCoachMaterials()).toEqual([]);
  });

  it("lists every saved material", () => {
    saveCoachMaterial(LECTURE);
    saveCoachMaterial(CAMP);
    expect(listCoachMaterials()).toEqual([LECTURE, CAMP]);
  });
});

describe("getCoachMaterial", () => {
  it("finds a saved material by id", () => {
    saveCoachMaterial(LECTURE);
    expect(getCoachMaterial("lecture-1")).toEqual(LECTURE);
  });

  it("returns undefined for an id that isn't stored", () => {
    expect(getCoachMaterial("missing")).toBeUndefined();
  });
});

describe("saveCoachMaterial", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveCoachMaterial(LECTURE);
    const revised: CoachMaterial = { ...LECTURE, title: "Topicality Basics (Revised)", tags: ["theory", "t"] };
    saveCoachMaterial(revised);

    expect(listCoachMaterials()).toEqual([revised]);
    expect(getCoachMaterial("lecture-1")).toEqual(revised);
  });

  it("creating a new material records no version history", () => {
    saveCoachMaterial(LECTURE);
    expect(listVersionsForMaterial("lecture-1")).toEqual([]);
  });

  it("returns the saved material with no version when creating", () => {
    expect(saveCoachMaterial(LECTURE)).toEqual({ material: LECTURE });
  });

  it("overwriting an existing id snapshots the record it replaces as a version", () => {
    saveCoachMaterial(LECTURE);
    const revised: CoachMaterial = { ...LECTURE, title: "Topicality Basics (Revised)" };
    saveCoachMaterial(revised);

    const versions = listVersionsForMaterial("lecture-1");
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ materialId: "lecture-1", title: "Topicality Basics" });
  });

  it("returns the version snapshot it created when overwriting", () => {
    saveCoachMaterial(LECTURE);
    const revised: CoachMaterial = { ...LECTURE, title: "Topicality Basics (Revised)" };
    const result = saveCoachMaterial(revised);

    expect(result.material).toEqual(revised);
    expect(result.version).toMatchObject({ materialId: "lecture-1", title: "Topicality Basics" });
  });

  it("overwriting repeatedly accumulates versions, newest first", () => {
    saveCoachMaterial(LECTURE);
    saveCoachMaterial({ ...LECTURE, title: "Revision 1" });
    saveCoachMaterial({ ...LECTURE, title: "Revision 2" });

    const versions = listVersionsForMaterial("lecture-1");
    expect(versions.map((v) => v.title)).toEqual(["Revision 1", "Topicality Basics"]);
  });
});

describe("adoptCoachMaterial", () => {
  it("inserts a material that isn't already stored", () => {
    adoptCoachMaterial(LECTURE);
    expect(listCoachMaterials()).toEqual([LECTURE]);
  });

  it("upserts by id rather than duplicating an already-stored material", () => {
    saveCoachMaterial(LECTURE);
    adoptCoachMaterial({ ...LECTURE, title: "Adopted title" });

    expect(listCoachMaterials()).toHaveLength(1);
    expect(getCoachMaterial("lecture-1")?.title).toBe("Adopted title");
  });

  it("does not snapshot a version when overwriting", () => {
    saveCoachMaterial(LECTURE);
    adoptCoachMaterial({ ...LECTURE, title: "Adopted title" });

    expect(listVersionsForMaterial("lecture-1")).toEqual([]);
  });
});

describe("deleteCoachMaterial", () => {
  it("removes a stored material by id", () => {
    saveCoachMaterial(LECTURE);
    saveCoachMaterial(CAMP);
    deleteCoachMaterial("lecture-1");

    expect(listCoachMaterials()).toEqual([CAMP]);
    expect(getCoachMaterial("lecture-1")).toBeUndefined();
  });

  it("is a no-op when the id isn't stored", () => {
    saveCoachMaterial(CAMP);
    deleteCoachMaterial("missing");
    expect(listCoachMaterials()).toEqual([CAMP]);
  });

  it("also removes that material's version history", () => {
    saveCoachMaterial(LECTURE);
    saveCoachMaterial({ ...LECTURE, title: "Revised" });
    expect(listVersionsForMaterial("lecture-1")).toHaveLength(1);

    deleteCoachMaterial("lecture-1");

    expect(listVersionsForMaterial("lecture-1")).toEqual([]);
  });

  it("returns the removed version ids, and an empty array when there were none", () => {
    saveCoachMaterial(LECTURE);
    const { version } = saveCoachMaterial({ ...LECTURE, title: "Revised" });

    expect(deleteCoachMaterial("lecture-1")).toEqual([version!.id]);
    expect(deleteCoachMaterial("missing")).toEqual([]);
  });
});

describe("buildCoachMaterialLibraryFromStore", () => {
  it("returns an empty library when nothing is stored", () => {
    expect(buildCoachMaterialLibraryFromStore()).toEqual({ groups: [], totalMaterials: 0 });
  });

  it("groups every persisted material by kind, mirroring buildCoachMaterialLibrary", () => {
    saveCoachMaterial(LECTURE);
    saveCoachMaterial(CAMP);

    const library = buildCoachMaterialLibraryFromStore();

    expect(library.totalMaterials).toBe(2);
    expect(library.groups).toEqual([
      { kind: "lecture_transcript", materials: [LECTURE] },
      { kind: "camp_material", materials: [CAMP] },
    ]);
  });

  it("filters persisted materials by a keyword search when given a filter", () => {
    saveCoachMaterial(LECTURE);
    saveCoachMaterial(CAMP);

    const library = buildCoachMaterialLibraryFromStore({ query: "topicality" });

    expect(library.totalMaterials).toBe(1);
    expect(library.groups).toEqual([{ kind: "lecture_transcript", materials: [LECTURE] }]);
  });

  it("filters persisted materials by tag when given a filter", () => {
    saveCoachMaterial(LECTURE);
    saveCoachMaterial(CAMP);

    const library = buildCoachMaterialLibraryFromStore({ tag: "case" });

    expect(library.groups).toEqual([{ kind: "camp_material", materials: [CAMP] }]);
  });
});

describe("listCoachMaterialTagsFromStore", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listCoachMaterialTagsFromStore()).toEqual([]);
  });

  it("collects every distinct tag across persisted materials, alphabetically sorted", () => {
    saveCoachMaterial(LECTURE);
    saveCoachMaterial(CAMP);

    expect(listCoachMaterialTagsFromStore()).toEqual(["case", "theory"]);
  });
});

describe("findRelevantMaterialsFromStore", () => {
  it("returns no matches when nothing is stored", () => {
    expect(findRelevantMaterialsFromStore("topicality")).toEqual([]);
  });

  it("ranks persisted materials by relevance to the query", () => {
    saveCoachMaterial(LECTURE);
    saveCoachMaterial(CAMP);

    const matches = findRelevantMaterialsFromStore("topicality");

    expect(matches).toHaveLength(1);
    expect(matches[0]?.material).toEqual(LECTURE);
  });

  it("passes options (e.g. limit) through to findRelevantMaterials", () => {
    saveCoachMaterial(LECTURE);
    saveCoachMaterial(CAMP);

    const matches = findRelevantMaterialsFromStore("case", { limit: 1 });

    expect(matches).toHaveLength(1);
    expect(matches[0]?.material).toEqual(CAMP);
  });

  it("excludes a pending material even when it's the only relevant match", () => {
    saveCoachMaterial({ ...LECTURE, status: "pending" });
    expect(findRelevantMaterialsFromStore("topicality")).toEqual([]);
  });

  it("excludes a rejected material even when it's the only relevant match", () => {
    saveCoachMaterial({ ...LECTURE, status: "rejected" });
    expect(findRelevantMaterialsFromStore("topicality")).toEqual([]);
  });

  it("includes an explicitly approved material", () => {
    saveCoachMaterial({ ...LECTURE, status: "approved" });
    const matches = findRelevantMaterialsFromStore("topicality");
    expect(matches).toHaveLength(1);
  });
});

describe("listPendingCoachMaterialsFromStore", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listPendingCoachMaterialsFromStore()).toEqual([]);
  });

  it("returns only materials with a pending status", () => {
    saveCoachMaterial({ ...LECTURE, status: "pending" });
    saveCoachMaterial({ ...CAMP, status: "approved" });

    const pending = listPendingCoachMaterialsFromStore();
    expect(pending.map((m) => m.id)).toEqual(["lecture-1"]);
  });

  it("excludes a material with no status field (treated as approved)", () => {
    saveCoachMaterial(LECTURE);
    expect(listPendingCoachMaterialsFromStore()).toEqual([]);
  });
});

describe("setCoachMaterialReviewStatus", () => {
  it("approves a pending material, stamping the reviewer", () => {
    saveCoachMaterial({ ...LECTURE, status: "pending" });

    const updated = setCoachMaterialReviewStatus("lecture-1", "approved", "Coach K");

    expect(updated?.status).toBe("approved");
    expect(updated?.reviewedBy).toBe("Coach K");
    expect(getCoachMaterial("lecture-1")?.status).toBe("approved");
  });

  it("rejects a pending material with an optional note", () => {
    saveCoachMaterial({ ...LECTURE, status: "pending" });

    const updated = setCoachMaterialReviewStatus("lecture-1", "rejected", "Coach K", "Needs a citation");

    expect(updated?.status).toBe("rejected");
    expect(updated?.reviewNote).toBe("Needs a citation");
  });

  it("returns undefined and changes nothing for an id that isn't stored", () => {
    expect(setCoachMaterialReviewStatus("missing", "approved", "Coach K")).toBeUndefined();
    expect(listCoachMaterials()).toEqual([]);
  });

  it("does not record a version snapshot — a review decision isn't a content edit", () => {
    saveCoachMaterial({ ...LECTURE, status: "pending" });
    setCoachMaterialReviewStatus("lecture-1", "approved", "Coach K");

    expect(listVersionsForMaterial("lecture-1")).toEqual([]);
  });
});
