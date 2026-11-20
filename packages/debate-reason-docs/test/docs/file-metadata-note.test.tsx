/** @vitest-environment jsdom */
/**
 * @fileoverview The sidebar's "About this file" note: the open file's
 * publication details with a link to its publisher's page.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import type { FileMetadataResponse } from "@debate-ai/file-market";
import { FileMetadataNote, formatPublishedOn, hasFileDetails } from "../../src/docs/metadata/FileMetadataNote";
import { bodyText, cleanup, flush, installDomShims, mount } from "../helpers/dom";

beforeAll(installDomShims);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const details: FileMetadataResponse = {
  metadata: {
    author: "Ana Ruiz",
    publisherId: "p1",
    researchGroup: "Westwood HS",
    students: ["Ana Ruiz", "Ben Lee"],
    years: "2025–2026",
    publishedOn: "2026-03-14",
    summary: "Space aff",
  },
  publisher: { id: "p1", slug: "westwood-lab", name: "Westwood Lab", priceCents: 500 },
  ownPublishers: [],
  canEdit: true,
};

function stubFetch(body: unknown) {
  const fn = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }))
  vi.stubGlobal("fetch", fn)
  return fn
}

describe("FileMetadataNote", () => {
  it("shows the details and links the publisher's page", async () => {
    const fetchMock = stubFetch(details)
    mount(<FileMetadataNote documentId={5} title="Aff" />)
    await flush()
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/doc/documents/5/metadata")
    const text = bodyText()
    expect(text).toContain("By Ana Ruiz")
    expect(text).toContain("Westwood HS: Ana Ruiz, Ben Lee")
    expect(text).toContain("2025–2026 · Mar 14, 2026")
    const link = document.querySelector<HTMLAnchorElement>('a[href="/research/publishers/westwood-lab"]')
    expect(link?.textContent).toBe("Westwood Lab")
  })

  it("stays quiet for a file with no details", async () => {
    stubFetch({
      ...details,
      metadata: { author: "", publisherId: null, researchGroup: "", students: [], years: "", publishedOn: "", summary: "" },
      publisher: null,
    })
    mount(<FileMetadataNote documentId={6} title="Blank" />)
    await flush()
    expect(bodyText()).toContain("No author or publisher yet.")
    expect(bodyText()).toContain("Edit details")
  })
})

describe("camp publisher", () => {
  const blank = {
    ...details,
    metadata: { author: "", publisherId: null, researchGroup: "", students: [], years: "", publishedOn: "", summary: "" },
    publisher: null,
  }

  it("reads the camp from the end of the file name and opens its info modal", async () => {
    stubFetch(blank)
    mount(<FileMetadataNote documentId={7} title="Spending DA - DDI 2026 RS" />)
    await flush()
    const link = document.querySelector<HTMLButtonElement>('[data-testid="camp-publisher-link"]')
    expect(link?.textContent).toContain("Dartmouth Debate Institutes (DDI)")
    link!.click()
    await flush()
    const text = bodyText()
    expect(text).toContain("contact@ddidebate.org")
    expect(text).toContain("Hanover, NH")
  })

  it("calls a file with no camp code Unsorted", async () => {
    stubFetch(blank)
    mount(<FileMetadataNote documentId={8} title="My notes" />)
    await flush()
    expect(bodyText()).toContain("Publisher: Unsorted")
  })
})

describe("helpers", () => {
  it("formats a publication date and spots empty details", () => {
    expect(formatPublishedOn("2026-03-14")).toBe("Mar 14, 2026")
    expect(formatPublishedOn("spring 2026")).toBe("spring 2026")
    expect(hasFileDetails(null)).toBe(false)
    expect(hasFileDetails(details)).toBe(true)
  })
})
