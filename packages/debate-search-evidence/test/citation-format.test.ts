/**
 * @fileoverview Covers `formatEvidenceCitation` (Evidence Library **Format
 * citation**): short cite first, person / organization / two-author cites,
 * undated cites, an existing bare short cite, idempotence, Source URL
 * appending, and the blank / no-author `null` cases.
 */
import { describe, expect, it } from "vitest"

import { CITE_SEPARATOR, formatEvidenceCitation } from "../src/lib/citation-format"

const full = 'Jane Smith, Professor of Economics at MIT, 3-14-2024, "Tariffs and Growth," Foreign Affairs'

describe("formatEvidenceCitation", () => {
  it("puts the short cite in front of a full citation", () => {
    expect(formatEvidenceCitation(full)).toEqual({
      cite: `Smith 24${CITE_SEPARATOR}${full}`,
      shortCite: "Smith 24",
      changed: true,
    })
  })

  it("handles organizations and two authors", () => {
    expect(formatEvidenceCitation("Brookings Institution, 2023, report")?.shortCite).toBe("Brookings Institution 23")
    expect(formatEvidenceCitation("John A. Doe and Mary Roe, 2019, Journal of Trade")?.shortCite).toBe("Doe & Roe 19")
  })

  it("marks an undated citation ND", () => {
    expect(formatEvidenceCitation("Jane Smith, Professor at MIT, Foreign Affairs")?.cite).toBe(
      "Smith ND — Jane Smith, Professor at MIT, Foreign Affairs",
    )
  })

  it("does not repeat a short cite the citation already opens with", () => {
    expect(formatEvidenceCitation("Smith 24, Jane Smith, MIT, 2024")?.cite).toBe("Smith 24 — Jane Smith, MIT, 2024")
    expect(formatEvidenceCitation("Smith 24")).toEqual({ cite: "Smith 24", shortCite: "Smith 24", changed: false })
  })

  it("is idempotent", () => {
    for (const input of [full, "John A. Doe and Mary Roe, 2019, Journal", "Jane Smith, Professor at MIT"]) {
      const once = formatEvidenceCitation(input, "https://example.com/a")!
      const twice = formatEvidenceCitation(once.cite, "https://example.com/a")!
      expect(twice).toEqual({ ...once, changed: false })
    }
  })

  it("collapses whitespace in the pasted citation", () => {
    expect(formatEvidenceCitation("  Jane   Smith,\n Professor at MIT,  2024 ")?.cite).toBe("Smith 24 — Jane Smith, Professor at MIT, 2024")
  })

  it("appends the Source URL unless the citation already has it", () => {
    expect(formatEvidenceCitation("Jane Smith, Professor at MIT, 2024,", " https://example.com/a ")?.cite).toBe(
      "Smith 24 — Jane Smith, Professor at MIT, 2024, https://example.com/a",
    )
    expect(formatEvidenceCitation("Jane Smith, Professor at MIT, 2024, www.Example.com/a/", "https://example.com/a")?.cite).toBe(
      "Smith 24 — Jane Smith, Professor at MIT, 2024, www.Example.com/a/",
    )
    const formatted = formatEvidenceCitation("Smith 24 — Jane Smith, MIT, 2024", "https://example.com/b")
    expect(formatted).toMatchObject({ cite: "Smith 24 — Jane Smith, MIT, 2024, https://example.com/b", changed: true })
  })

  it("returns null for a blank citation or one with no author", () => {
    expect(formatEvidenceCitation("   ")).toBeNull()
    expect(formatEvidenceCitation("", "https://example.com")).toBeNull()
    expect(formatEvidenceCitation("2024, 12, 3")).toBeNull()
  })
})
