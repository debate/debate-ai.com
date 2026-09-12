/**
 * @fileoverview Covers unpacking a bulk caselist archive: the provenance read
 * out of each entry's path, and the walk that converts a whole ZIP of `.docx`
 * without letting one bad document take the run down.
 *
 * The archives are built here with JSZip rather than checked in as fixtures —
 * a real season dump is hundreds of megabytes, and what these tests need from
 * one is its structure, not its size.
 */
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import {
  describeCaselistEntry,
  loadCaselistArchive,
} from "../src/caselist/caselist-archive";

/** Builds a minimal but real `.docx` — a ZIP with one `word/document.xml`. */
async function docx(tag: string, body: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading4"/></w:pPr><w:r><w:t>${tag}</w:t></w:r></w:p>
<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Smith 26</w:t></w:r><w:r><w:t> (Jane Smith, Brookings, 2026)</w:t></w:r></w:p>
<w:p><w:r><w:t>${body}</w:t></w:r></w:p>
</w:body></w:document>`,
  );
  return zip.generateAsync({ type: "arraybuffer" });
}

/** Builds an archive shaped like the ones openCaselist publishes. */
async function archive(
  files: Record<string, ArrayBuffer | string>,
): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("describeCaselistEntry", () => {
  it("reads school, team and side out of a school/team/file path", () => {
    expect(
      describeCaselistEntry("Glenbrook North/Chen-Patel/Heg Aff.docx", "hspolicy26"),
    ).toEqual({
      path: "Glenbrook North/Chen-Patel/Heg Aff.docx",
      fileName: "Heg Aff.docx",
      school: "Glenbrook North",
      team: "Chen-Patel",
      side: "Aff",
    });
  });

  it("strips a leading caselist folder", () => {
    expect(
      describeCaselistEntry("hsld26/Harvard Westlake/Ng-Rao/Neg - Cap K.docx", "hsld26"),
    ).toMatchObject({ school: "Harvard Westlake", team: "Ng-Rao", side: "Neg" });
  });

  it("reads the side off a speech-document name", () => {
    expect(describeCaselistEntry("Lexington/Ali-Cruz/1AC Warming.docx").side).toBe("Aff");
    expect(describeCaselistEntry("Lexington/Ali-Cruz/2NR Politics.docx").side).toBe("Neg");
  });

  it("prefers the file name over a folder when both could name a side", () => {
    // A folder called "Aff-Neg" must not outvote the document's own name.
    expect(
      describeCaselistEntry("Westminster/Aff-Neg Files/Cap K Neg.docx").side,
    ).toBe("Neg");
  });

  it("degrades to null rather than guessing", () => {
    // A wrong attribution is worse than a missing one: these values are what an
    // ingested card is credited to.
    expect(describeCaselistEntry("Some File.docx")).toMatchObject({
      school: null,
      team: null,
      side: null,
    });
    expect(describeCaselistEntry("Bellarmine/Topicality.docx")).toMatchObject({
      school: "Bellarmine",
      team: null,
      side: null,
    });
  });

  it("is not fooled by a school whose name contains 'neg'", () => {
    expect(describeCaselistEntry("Negaunee/Ito-Park/Topicality.docx").side).toBeNull();
  });
});

describe("loadCaselistArchive", () => {
  it("converts every document in the archive", async () => {
    const bytes = await archive({
      "Glenbrook North/Chen-Patel/Heg Aff.docx": await docx("Heg solves war", "Body."),
      "Westminster/Ito-Park/Cap K Neg.docx": await docx("Cap causes extinction", "Body."),
    });

    const load = await loadCaselistArchive(bytes, { slug: "hspolicy26" });

    expect(load.entryCount).toBe(2);
    expect(load.importedCount).toBe(2);
    expect(load.failures).toEqual([]);
    expect(load.documents.map((document) => document.school).sort()).toEqual([
      "Glenbrook North",
      "Westminster",
    ]);
    expect(load.documents[0].html).toContain("Heg solves war");
  });

  it("skips archive debris and non-Word files", async () => {
    const bytes = await archive({
      "Lexington/Ali-Cruz/1AC.docx": await docx("Warming advantage", "Body."),
      "__MACOSX/Lexington/._1AC.docx": "resource fork",
      "Lexington/Ali-Cruz/~$1AC.docx": "word lock file",
      "Lexington/Ali-Cruz/notes.txt": "not a document",
      "Lexington/Ali-Cruz/cites.pdf": "not a document",
    });

    const load = await loadCaselistArchive(bytes);

    expect(load.entryCount).toBe(1);
    expect(load.documents).toHaveLength(1);
  });

  it("records a bad document and keeps going", async () => {
    // One password-protected or truncated file in a 3,000-file archive must not
    // cost the other 2,999.
    const bytes = await archive({
      "Bellarmine/Kim-Lee/Good.docx": await docx("Readable", "Body."),
      "Bellarmine/Kim-Lee/Broken.docx": "not a zip at all",
    });

    const load = await loadCaselistArchive(bytes);

    expect(load.importedCount).toBe(1);
    expect(load.failures).toHaveLength(1);
    expect(load.failures[0]).toMatchObject({ path: "Bellarmine/Kim-Lee/Broken.docx" });
    expect(load.failures[0].reason).toBeTruthy();
  });

  it("streams to onDocument instead of accumulating", async () => {
    // What keeps a season dump from being held in memory all at once.
    const bytes = await archive({
      "A/Team/One Aff.docx": await docx("One", "Body."),
      "B/Team/Two Neg.docx": await docx("Two", "Body."),
    });

    const seen: string[] = [];
    const load = await loadCaselistArchive(bytes, {
      onDocument: (document) => {
        seen.push(document.fileName);
      },
    });

    expect(seen.sort()).toEqual(["One Aff.docx", "Two Neg.docx"]);
    expect(load.documents).toEqual([]);
    expect(load.importedCount).toBe(2);
  });

  it("stops at the limit", async () => {
    const bytes = await archive({
      "A/Team/One.docx": await docx("One", "Body."),
      "B/Team/Two.docx": await docx("Two", "Body."),
      "C/Team/Three.docx": await docx("Three", "Body."),
    });

    expect((await loadCaselistArchive(bytes, { limit: 2 })).importedCount).toBe(2);
  });

  it("parses cards only when asked", async () => {
    const bytes = await archive({
      "A/Team/One Aff.docx": await docx("Heg solves great power war", "Body text here."),
    });

    expect((await loadCaselistArchive(bytes)).documents[0].cards).toBeUndefined();

    const parsed = await loadCaselistArchive(bytes, { parseCards: true });

    expect(parsed.documents[0].cards?.length).toBeGreaterThan(0);
    expect(parsed.documents[0].cards?.[0].summary).toContain("Heg solves");
  });

  it("throws when the download itself is not a ZIP", async () => {
    // A run-level failure, unlike a bad document inside a good archive.
    await expect(
      loadCaselistArchive(new TextEncoder().encode("<html>404</html>")),
    ).rejects.toThrow(/truncated or corrupt/i);
  });
});
