import { describe, expect, it } from "vitest"
import {
  BACKUP_GROUPS,
  BACKUP_TABLES,
  emptyBackupStats,
  parseBackupGroups,
  pageEnd,
  quoteIdent,
  sqlLiteral,
  tablesForGroups,
} from "../../src/lib/db-backup"

describe("db-backup helpers", () => {
  describe("BACKUP_GROUPS and BACKUP_TABLES", () => {
    it("has all three groups", () => {
      expect(BACKUP_GROUPS).toEqual(["videos", "cards", "history"])
    })

    it("has tables for each group", () => {
      const groups = BACKUP_TABLES.map((t) => t.group)
      expect(new Set(groups)).toEqual(new Set(BACKUP_GROUPS))
    })

    it("scrubs identifying columns on allowed tables", () => {
      const withScrub = BACKUP_TABLES.filter((t) => t.scrub)
      expect(withScrub.length).toBeGreaterThan(0)
      for (const table of withScrub) {
        expect(table.scrub).toBeDefined()
        for (const [column, replacement] of Object.entries(table.scrub!)) {
          expect(replacement === null || replacement === "").toBe(true)
        }
      }
    })
  })

  describe("parseBackupGroups", () => {
    it("returns all groups for empty input", () => {
      expect(parseBackupGroups("")).toEqual([...BACKUP_GROUPS])
      expect(parseBackupGroups(null)).toEqual([...BACKUP_GROUPS])
      expect(parseBackupGroups(undefined)).toEqual([...BACKUP_GROUPS])
    })

    it("parses comma-separated groups", () => {
      expect(parseBackupGroups("videos,cards")).toEqual(["videos", "cards"])
    })

    it("parses array input", () => {
      expect(parseBackupGroups(["videos"])).toEqual(["videos"])
    })

    it("ignores unknown groups", () => {
      expect(parseBackupGroups("videos,unknown")).toEqual(["videos"])
    })

    it("is case-insensitive and trims", () => {
      expect(parseBackupGroups("  VIDEOS , Cards ")).toEqual(["videos", "cards"])
    })
  })

  describe("tablesForGroups", () => {
    it("returns tables for the given groups", () => {
      const videos = tablesForGroups(["videos"])
      expect(videos.every((t) => t.group === "videos")).toBe(true)
      expect(videos.length).toBeGreaterThan(0)
    })

    it("returns all tables for all groups", () => {
      const all = tablesForGroups([...BACKUP_GROUPS])
      expect(all).toEqual(BACKUP_TABLES)
    })
  })

  describe("pageEnd", () => {
    it("returns the last index that fits in the budget", () => {
      expect(pageEnd([100, 200, 300], 500)).toBe(1) // 100+200=300 fits, +300=600 > 500
      expect(pageEnd([100, 200, 300], 1000)).toBe(2) // all fit
      expect(pageEnd([100], 50)).toBe(0) // first row always fits
    })

    it("handles empty input", () => {
      expect(pageEnd([], 1000)).toBe(-1)
    })
  })

  describe("quoteIdent", () => {
    it("wraps the name in double quotes", () => {
      expect(quoteIdent("videos")).toBe('"videos"')
    })

    it("escapes embedded double quotes", () => {
      expect(quoteIdent('my"table')).toBe('"my""table"')
    })
  })

  describe("sqlLiteral", () => {
    it("renders null as NULL", () => {
      expect(sqlLiteral(null)).toBe("NULL")
      expect(sqlLiteral(undefined)).toBe("NULL")
    })

    it("renders numbers as-is", () => {
      expect(sqlLiteral(42)).toBe("42")
      expect(sqlLiteral(3.14)).toBe("3.14")
    })

    it("renders NaN and Infinity as NULL", () => {
      expect(sqlLiteral(NaN)).toBe("NULL")
      expect(sqlLiteral(Infinity)).toBe("NULL")
    })

    it("renders booleans as 0 or 1", () => {
      expect(sqlLiteral(true)).toBe("1")
      expect(sqlLiteral(false)).toBe("0")
    })

    it("renders dates as unix timestamps", () => {
      const date = new Date("2024-01-01T00:00:00Z")
      expect(sqlLiteral(date)).toBe(String(Math.floor(date.getTime() / 1000)))
    })

    it("renders strings with escaped single quotes", () => {
      expect(sqlLiteral("it's")).toBe("'it''s'")
      expect(sqlLiteral("hello")).toBe("'hello'")
    })

    it("renders ArrayBuffers as hex blobs", () => {
      const buffer = new ArrayBuffer(2)
      new Uint8Array(buffer).set([0xab, 0xcd])
      expect(sqlLiteral(buffer)).toBe("X'abcd'")
    })

    it("renders Uint8Arrays as hex blobs", () => {
      const bytes = new Uint8Array([0x01, 0x02])
      expect(sqlLiteral(bytes)).toBe("X'0102'")
    })
  })

  describe("emptyBackupStats", () => {
    it("returns a fresh stats object", () => {
      const stats = emptyBackupStats()
      expect(stats.tables).toEqual({})
      expect(stats.missing).toEqual([])
      expect(stats.totalRows).toBe(0)
    })
  })
})