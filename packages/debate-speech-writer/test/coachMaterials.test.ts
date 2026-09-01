import { beforeEach, describe, expect, it } from "vitest";
import {
  buildCoachMaterialLibraryFromStore,
  deleteCoachMaterial,
  findRelevantMaterialsFromStore,
  getCoachMaterial,
  listCoachMaterials,
  listCoachMaterialTagsFromStore,
  saveCoachMaterial,
} from "../src/state/coachMaterials";
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
});
