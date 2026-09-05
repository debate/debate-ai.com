import { describe, expect, it } from "vitest";
import {
  MAX_SHARED_FILE_BYTES,
  MAX_SHARED_FILE_TAGS,
  buildSharedFileTree,
  canManageSharedFile,
  canViewSharedFile,
  collectSharedFileDescendantIds,
  filterSharedFiles,
  normalizeSharedFileTags,
  normalizeSharedFileTitle,
  parseSharedFileTags,
  partitionSharedFiles,
  sharedFilePath,
  validateSharedFilePayload,
  type SharedFileItem,
} from "../src/state/sharedFiles";

function item(overrides: Partial<SharedFileItem> & Pick<SharedFileItem, "id" | "title">): SharedFileItem {
  return {
    content: "",
    parentId: null,
    isFolder: false,
    tags: "[]",
    published: true,
    ownerId: null,
    sourceDocumentId: null,
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

const LIBRARY: SharedFileItem[] = [
  item({ id: 1, title: "2026 Energy Topic", isFolder: true, tags: '["topic-starter"]' }),
  item({ id: 2, title: "Aff", isFolder: true, parentId: 1, tags: '["folder"]' }),
  item({ id: 3, title: "1AC Clean Energy", parentId: 2, tags: '["docx","public"]' }),
  item({ id: 4, title: "Neg", isFolder: true, parentId: 1 }),
  item({ id: 5, title: "Spending DA", parentId: 4, tags: '["docx","public"]' }),
  item({ id: 6, title: "Alice's drill", ownerId: "alice", tags: '["drill"]' }),
  item({ id: 7, title: "Alice's private draft", ownerId: "alice", published: false }),
  item({ id: 8, title: "Bob's brief", ownerId: "bob", tags: '["brief"]' }),
];

describe("parseSharedFileTags", () => {
  it("parses a JSON string array", () => {
    expect(parseSharedFileTags('["a","b"]')).toEqual(["a", "b"]);
  });

  it("returns [] for empty, malformed, and non-array values", () => {
    expect(parseSharedFileTags("")).toEqual([]);
    expect(parseSharedFileTags(null)).toEqual([]);
    expect(parseSharedFileTags("not json")).toEqual([]);
    expect(parseSharedFileTags('{"a":1}')).toEqual([]);
  });

  it("drops non-string and blank entries", () => {
    expect(parseSharedFileTags('["a", 1, "", "  ", null, "b"]')).toEqual(["a", "b"]);
  });
});

describe("normalizeSharedFileTags", () => {
  it("trims, lowercases, and dedupes", () => {
    expect(normalizeSharedFileTags([" Policy ", "policy", "LD", ""])).toEqual(["policy", "ld"]);
  });

  it("caps the number of tags", () => {
    const many = Array.from({ length: MAX_SHARED_FILE_TAGS + 5 }, (_, i) => `tag${i}`);
    expect(normalizeSharedFileTags(many)).toHaveLength(MAX_SHARED_FILE_TAGS);
  });

  it("truncates an overlong tag", () => {
    expect(normalizeSharedFileTags(["x".repeat(100)])[0]).toHaveLength(40);
  });
});

describe("normalizeSharedFileTitle", () => {
  it("trims and falls back to Untitled / New Folder", () => {
    expect(normalizeSharedFileTitle("  Brief ")).toBe("Brief");
    expect(normalizeSharedFileTitle("   ")).toBe("Untitled");
    expect(normalizeSharedFileTitle(undefined, true)).toBe("New Folder");
  });
});

describe("validateSharedFilePayload", () => {
  it("accepts an empty object (a no-op PUT)", () => {
    expect(validateSharedFilePayload({})).toEqual({ ok: true, payload: {} });
  });

  it("normalizes tags and passes other fields through", () => {
    const result = validateSharedFilePayload({
      title: "Brief",
      content: "<p>x</p>",
      tags: [" A ", "a"],
      published: false,
      parentId: 3,
      isFolder: false,
    });
    expect(result).toEqual({
      ok: true,
      payload: { title: "Brief", content: "<p>x</p>", tags: ["a"], published: false, parentId: 3, isFolder: false },
    });
  });

  it("accepts a null parentId", () => {
    expect(validateSharedFilePayload({ parentId: null })).toEqual({ ok: true, payload: { parentId: null } });
  });

  it("rejects non-objects", () => {
    expect(validateSharedFilePayload(null).ok).toBe(false);
    expect(validateSharedFilePayload([]).ok).toBe(false);
    expect(validateSharedFilePayload("x").ok).toBe(false);
  });

  it.each([
    ["title", { title: 1 }],
    ["content", { content: {} }],
    ["tags", { tags: "a" }],
    ["tags entries", { tags: [1] }],
    ["published", { published: "yes" }],
    ["parentId", { parentId: 1.5 }],
    ["isFolder", { isFolder: 0 }],
  ])("rejects a malformed %s", (_label, input) => {
    const result = validateSharedFilePayload(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(_label.split(" ")[0]);
  });

  it("rejects content over the size cap", () => {
    const result = validateSharedFilePayload({ content: "x".repeat(MAX_SHARED_FILE_BYTES + 1) });
    expect(result).toEqual({ ok: false, error: "This file is too large to share." });
  });
});

describe("buildSharedFileTree", () => {
  it("nests children under folders, folders first then alphabetical", () => {
    const tree = buildSharedFileTree(LIBRARY);
    expect(tree.map((node) => node.item.title)).toEqual([
      "2026 Energy Topic",
      "Alice's drill",
      "Alice's private draft",
      "Bob's brief",
    ]);
    const topic = tree[0];
    expect(topic.children.map((node) => node.item.title)).toEqual(["Aff", "Neg"]);
    expect(topic.children[0].children[0].item.id).toBe(3);
  });

  it("promotes a row whose parent isn't in the list to the root", () => {
    const tree = buildSharedFileTree([item({ id: 9, title: "Orphan", parentId: 999 })]);
    expect(tree).toHaveLength(1);
    expect(tree[0].item.id).toBe(9);
  });

  it("terminates on a parent cycle", () => {
    const cyclic = [
      item({ id: 1, title: "A", isFolder: true, parentId: 2 }),
      item({ id: 2, title: "B", isFolder: true, parentId: 1 }),
    ];
    expect(() => buildSharedFileTree(cyclic)).not.toThrow();
  });
});

describe("collectSharedFileDescendantIds", () => {
  it("returns the root and every nested id", () => {
    expect(collectSharedFileDescendantIds(LIBRARY, 1).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns just the id for a leaf", () => {
    expect(collectSharedFileDescendantIds(LIBRARY, 6)).toEqual([6]);
  });

  it("terminates on a cycle", () => {
    const cyclic = [item({ id: 1, title: "A", parentId: 2 }), item({ id: 2, title: "B", parentId: 1 })];
    expect(collectSharedFileDescendantIds(cyclic, 1).sort()).toEqual([1, 2]);
  });
});

describe("sharedFilePath", () => {
  it("joins the ancestor titles", () => {
    expect(sharedFilePath(LIBRARY, 3)).toBe("2026 Energy Topic/Aff");
    expect(sharedFilePath(LIBRARY, 1)).toBe("");
  });
});

describe("filterSharedFiles", () => {
  it("returns everything for an empty query", () => {
    expect(filterSharedFiles(LIBRARY, "  ")).toHaveLength(LIBRARY.length);
  });

  it("matches title, tags, and path, keeping the ancestor folders of each hit", () => {
    const byTitle = filterSharedFiles(LIBRARY, "spending");
    expect(byTitle.map((i) => i.id).sort((a, b) => a - b)).toEqual([1, 4, 5]);

    const byTag = filterSharedFiles(LIBRARY, "drill");
    expect(byTag.map((i) => i.id)).toEqual([6]);

    const byPath = filterSharedFiles(LIBRARY, "energy topic/aff");
    expect(byPath.map((i) => i.id).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("is case-insensitive", () => {
    expect(filterSharedFiles(LIBRARY, "BOB")).toHaveLength(1);
  });
});

describe("access helpers", () => {
  it("only the owner can manage a row", () => {
    expect(canManageSharedFile(LIBRARY[5], "alice")).toBe(true);
    expect(canManageSharedFile(LIBRARY[5], "bob")).toBe(false);
    expect(canManageSharedFile(LIBRARY[0], "alice")).toBe(false);
    expect(canManageSharedFile(LIBRARY[5], null)).toBe(false);
  });

  it("published rows are viewable by anyone, unpublished rows only by the owner", () => {
    expect(canViewSharedFile(LIBRARY[0], null)).toBe(true);
    expect(canViewSharedFile(LIBRARY[6], "alice")).toBe(true);
    expect(canViewSharedFile(LIBRARY[6], "bob")).toBe(false);
    expect(canViewSharedFile(LIBRARY[6], null)).toBe(false);
  });

  it("partitions into mine vs. community, hiding others' unpublished rows", () => {
    const { mine, community } = partitionSharedFiles(LIBRARY, "alice");
    expect(mine.map((i) => i.id)).toEqual([6, 7]);
    expect(community.map((i) => i.id)).toEqual([1, 2, 3, 4, 5, 8]);

    const signedOut = partitionSharedFiles(LIBRARY, null);
    expect(signedOut.mine).toEqual([]);
    expect(signedOut.community.map((i) => i.id)).toEqual([1, 2, 3, 4, 5, 6, 8]);
  });
});
