import { describe, it, expect } from "vitest";
import type { CaselistDocument } from "../src/caselist/caselist-archive";
import type { Caselist } from "../src/caselist/caselist-config";
import {
  buildCaselistDocumentSeedStatements,
  caselistDocumentId,
  buildPathHash,
  caselistDocumentSeedValues,
  sqlLiteral,
} from "../src/caselist/caselist-document-sql";

const mockCaselist: Caselist = {
  slug: "hspolicy26",
  label: "HS Policy 2025-26",
  event: "policy",
  level: "hs",
  year: 2026,
};

const mockDocument: CaselistDocument = {
  path: "hspolicy26/Glenbrook North/Chen-Patel/1AC.docx",
  fileName: "1AC.docx",
  school: "Glenbrook North",
  team: "Chen-Patel",
  side: "Aff",
  html: "<p>Test HTML content</p>",
  cards: [],
  metadata: undefined,
  outline: undefined,
};

describe("caselist-document-sql", () => {
  describe("sqlLiteral", () => {
    it("escapes single quotes in strings", () => {
      expect(sqlLiteral("O'Reilly")).toBe("'O''Reilly'");
    });
    it("handles null and undefined", () => {
      expect(sqlLiteral(null)).toBe("NULL");
      expect(sqlLiteral(undefined)).toBe("NULL");
    });
    it("handles numbers and booleans", () => {
      expect(sqlLiteral(42)).toBe("42");
      expect(sqlLiteral(true)).toBe("1");
      expect(sqlLiteral(false)).toBe("0");
    });
  });

  describe("caselistDocumentId", () => {
    it("generates a stable ID from a path hash", () => {
      const hash = "hspolicy26|Glenbrook North/Chen-Patel/1AC.docx";
      const id1 = caselistDocumentId(hash);
      const id2 = caselistDocumentId(hash);
      expect(id1).toBe(id2);
      expect(id1).toBeGreaterThan(0);
    });

    it("generates different IDs for different hashes", () => {
      const id1 = caselistDocumentId("hash1");
      const id2 = caselistDocumentId("hash2");
      expect(id1).not.toBe(id2);
    });
  });

  describe("buildPathHash", () => {
    it("combines caselist slug and archive path", () => {
      const hash = buildPathHash("hspolicy26", "Glenbrook North/Chen-Patel/1AC.docx");
      expect(hash).toBe("hspolicy26|Glenbrook North/Chen-Patel/1AC.docx");
    });
  });

  describe("caselistDocumentSeedValues", () => {
    it("returns column values in the correct order", () => {
      const values = caselistDocumentSeedValues(mockDocument, mockCaselist, "2026-01-06");
      expect(values).toHaveLength(13);
      expect(values[0]).toBeTypeOf("number"); // id
      expect(values[1]).toBe("hspolicy26|hspolicy26/Glenbrook North/Chen-Patel/1AC.docx"); // pathHash
      expect(values[2]).toBe("hspolicy26"); // caselistSlug
      expect(values[3]).toBe("HS Policy 2025-26"); // caselistLabel
      expect(values[4]).toBe("Glenbrook North"); // school
      expect(values[5]).toBe("Chen-Patel"); // team
      expect(values[6]).toBe("Aff"); // side
      expect(values[7]).toBe("1AC.docx"); // fileName
      expect(values[8]).toBe("hspolicy26/Glenbrook North/Chen-Patel/1AC.docx"); // archivePath
      expect(values[9]).toBe("<p>Test HTML content</p>"); // html
      expect(values[10]).toBe(0); // cardCount
      expect(values[11]).toBeTypeOf("number"); // ingestedAt
      expect(values[12]).toBe("2026-01-06"); // archiveDate
    });

    it("handles null team and side", () => {
      const docNoTeam: CaselistDocument = {
        ...mockDocument,
        team: null,
        side: null,
      };
      const values = caselistDocumentSeedValues(docNoTeam, mockCaselist, undefined);
      expect(values[5]).toBe(""); // team should be empty string
      expect(values[6]).toBe(""); // side should be empty string
      expect(values[12]).toBe(""); // archiveDate should be empty string
    });
  });

  describe("buildCaselistDocumentSeedStatements", () => {
    it("generates INSERT statements with upsert", () => {
      const statements = buildCaselistDocumentSeedStatements(
        [mockDocument],
        mockCaselist,
        "2026-01-06",
        1700000000,
      );
      expect(statements).toHaveLength(2); // INSERT + DELETE
      expect(statements[0]).toContain("INSERT INTO \"caselist_documents\"");
      expect(statements[0]).toContain("ON CONFLICT(\"id\") DO UPDATE");
      expect(statements[1]).toContain("DELETE FROM \"caselist_documents\"");
      expect(statements[1]).toContain("caselist_slug");
      expect(statements[1]).toContain("1700000000");
    });

    it("batches multiple documents", () => {
      const doc2: CaselistDocument = {
        ...mockDocument,
        fileName: "2AC.docx",
        path: "hspolicy26/Glenbrook North/Chen-Patel/2AC.docx",
      };
      const statements = buildCaselistDocumentSeedStatements(
        [mockDocument, doc2],
        mockCaselist,
        "2026-01-06",
        1700000000,
        { maxRows: 1 },
      );
      // Should create multiple batches (2 INSERTs + 1 DELETE = 3)
      expect(statements.length).toBeGreaterThanOrEqual(3);
    });
  });
});