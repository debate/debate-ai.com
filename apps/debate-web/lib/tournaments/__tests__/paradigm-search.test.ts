import { afterEach, describe, expect, it, vi } from "vitest"

import { clearParadigmCache, handleParadigmSearch, parseNames, parseParadigmSearch } from "../paradigm-search"

// The shape of tabroom.com/index/paradigm.mhtml's result table.
const row = (id: number, first: string, last: string, school = "Harker") => `
  <tr>
    <td> ${first} </td>
    <td> ${last} </td>
    <td> <span class="hidden">x</span>${school} </td>
    <td class="centeralign"><a class="buttonwhite bluetext" href="/index/paradigm.mhtml?judge_person_id=${id}">Paradigm</a></td>
  </tr>`
const page = (...rows: string[]) => `<html><body><table id="paradigms"><thead><tr><th>First</th><th>Last</th></tr></thead><tbody>${rows.join("")}</tbody></table></body></html>`

afterEach(() => clearParadigmCache())

describe("parseParadigmSearch", () => {
  it("returns the one judge with that first and last name", () => {
    expect(parseParadigmSearch(page(row(101, "Scott", "Phillips"), row(102, "Scottie", "Phillips")), "Scott", "Phillips")).toBe(101)
  })

  it("matches case- and accent-insensitively", () => {
    expect(parseParadigmSearch(page(row(7, "José", "Núñez")), "jose", "NUNEZ")).toBe(7)
  })

  it("returns null for several judges of the same name, or none", () => {
    expect(parseParadigmSearch(page(row(1, "Sam", "Lee"), row(2, "Sam", "Lee", "Greenhill")), "Sam", "Lee")).toBeNull()
    expect(parseParadigmSearch(page(row(1, "Sam", "Lee")), "Sam", "Li")).toBeNull()
    expect(parseParadigmSearch("<p>No results</p>", "Sam", "Lee")).toBeNull()
  })
})

describe("parseNames", () => {
  it("reads First|Last pairs, de-duplicated, skipping blanks", () => {
    expect(parseNames("https://x/api?name=Sam|Lee&name=sam|lee&name=|Lee&name=Ann|Yu")).toEqual([
      { first: "sam", last: "lee" },
      { first: "Ann", last: "Yu" },
    ])
  })
})

describe("handleParadigmSearch", () => {
  it("answers every name in one response and caches each search", async () => {
    const fetchImpl = vi.fn(async (url: URL | RequestInfo) => {
      const last = new URL(String(url)).searchParams.get("search_last")
      return new Response(last === "Lee" ? page(row(55, "Sam", "Lee")) : page())
    })
    const request = () => new Request("https://d.ebate.app/api/tabroom-paradigms?name=Sam|Lee&name=Ann|Yu")
    const res = await handleParadigmSearch(request(), fetchImpl as typeof fetch)
    expect(await res.json()).toEqual({ "sam lee": 55, "ann yu": null })
    expect(res.headers.get("cache-control")).toContain("max-age=86400")
    await handleParadigmSearch(request(), fetchImpl as typeof fetch)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("answers null when Tabroom fails, without caching the failure", async () => {
    const fetchImpl = vi.fn(async () => new Response("down", { status: 503 }))
    const res = await handleParadigmSearch(new Request("https://d.ebate.app/api/tabroom-paradigms?name=Sam|Lee"), fetchImpl as typeof fetch)
    expect(await res.json()).toEqual({ "sam lee": null })
  })
})
