import { describe, expect, it } from "vitest";
import {
  formatShortcutsReferenceText,
  type ShortcutsReferenceGroup,
} from "../src/editor/reference-export";

describe("formatShortcutsReferenceText", () => {
  it("renders a title line followed by each group's heading and rows", () => {
    const groups: ShortcutsReferenceGroup[] = [
      {
        title: "Format",
        rows: [
          { label: "Apply Cite style", keyText: "F8" },
          { label: "Apply Underline style", keyText: "F9 / Ctrl+U" },
        ],
      },
      {
        title: "Card",
        rows: [{ label: "Condense", keyText: "F3" }],
      },
    ];

    const text = formatShortcutsReferenceText(groups);
    const lines = text.split("\n");

    expect(lines[0]).toBe("Keyboard shortcuts");
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe("Format");
    expect(lines).toContain("Card");
    expect(text).toContain("Apply Cite style");
    expect(text).toContain("Condense");
    // Ends with exactly one trailing newline, no trailing blank line.
    expect(text.endsWith("\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
  });

  it("renders an em dash for an unbound command instead of a blank key", () => {
    const groups: ShortcutsReferenceGroup[] = [
      { title: "Edit", rows: [{ label: "Some plugin command", keyText: "" }] },
    ];
    expect(formatShortcutsReferenceText(groups)).toContain("—");
  });

  it("skips a group whose every command is filtered out (empty rows)", () => {
    const groups: ShortcutsReferenceGroup[] = [
      { title: "Empty section", rows: [] },
      { title: "Real section", rows: [{ label: "Do thing", keyText: "F1" }] },
    ];
    const text = formatShortcutsReferenceText(groups);
    expect(text).not.toContain("Empty section");
    expect(text).toContain("Real section");
  });

  it("returns just the title line when every group is empty", () => {
    const text = formatShortcutsReferenceText([{ title: "Nothing", rows: [] }]);
    expect(text).toBe("Keyboard shortcuts\n");
  });

  it("key-aligns rows within the widest key in the whole document", () => {
    const groups: ShortcutsReferenceGroup[] = [
      {
        title: "Group",
        rows: [
          { label: "Short key", keyText: "F1" },
          { label: "Long key", keyText: "Ctrl+Alt+Shift+F3" },
        ],
      },
    ];
    const lines = formatShortcutsReferenceText(groups)
      .split("\n")
      .filter((l) => l.includes("Short key") || l.includes("Long key"));
    // Both label columns should start at the same character offset.
    const shortIdx = lines[0]!.indexOf("Short key");
    const longIdx = lines[1]!.indexOf("Long key");
    expect(shortIdx).toBe(longIdx);
  });
});
