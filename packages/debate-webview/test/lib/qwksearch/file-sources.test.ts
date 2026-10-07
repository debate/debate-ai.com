/** @vitest-environment jsdom */
/**
 * @fileoverview The REASON file-source registry in localStorage: the local
 * source is always present and can't be deleted, sources are added, updated
 * and removed, and deleting the active source falls back to the local one.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  addFileSource,
  deleteFileSource,
  getActiveFileSource,
  getActiveFileSourceId,
  getFileSources,
  setActiveFileSourceId,
  testFileSourceConnection,
  updateFileSource,
  type AnyFileSource,
} from "../../../src/components/qwksearch/lib/file-sources"

const s3 = {
  name: "Team bucket",
  type: "s3",
  credentials: { accessKeyId: "id", secretAccessKey: "secret", region: "us-east-1", bucket: "cards" },
} as unknown as Omit<AnyFileSource, "id" | "createdAt" | "updatedAt">

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe("file sources", () => {
  it("starts with just the local source active", () => {
    expect(getFileSources().map((source) => source.id)).toEqual(["local-default"])
    expect(getActiveFileSourceId()).toBe("local-default")
    expect(getActiveFileSource().type).toBe("local")
  })

  it("adds a source with an id and timestamps, keeping the local one first", () => {
    vi.spyOn(Date, "now").mockReturnValue(1234)
    const added = addFileSource(s3)
    expect(added).toMatchObject({ id: "s3-1234", name: "Team bucket", type: "s3" })
    expect(added.createdAt).toEqual(expect.any(String))
    expect(getFileSources().map((source) => source.id)).toEqual(["local-default", "s3-1234"])
  })

  it("re-adds the local source if the stored list lost it", () => {
    localStorage.setItem("REASON-file-sources", JSON.stringify([{ id: "s3-1", name: "x", type: "s3" }]))
    expect(getFileSources().map((source) => source.id)).toEqual(["local-default", "s3-1"])
  })

  it("falls back to the local source when the stored list is corrupt", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    localStorage.setItem("REASON-file-sources", "{oops")
    expect(getFileSources().map((source) => source.id)).toEqual(["local-default"])
  })

  it("updates a source by id and leaves the rest alone", () => {
    const added = addFileSource(s3)
    updateFileSource(added.id, { name: "Renamed" })
    const sources = getFileSources()
    expect(sources.find((source) => source.id === added.id)?.name).toBe("Renamed")
    expect(sources.find((source) => source.id === "local-default")?.name).toBe("Local Files")
  })

  it("deletes a source and moves the active selection back to local", () => {
    const added = addFileSource(s3)
    setActiveFileSourceId(added.id)
    expect(getActiveFileSource().id).toBe(added.id)

    deleteFileSource(added.id)
    expect(getFileSources().map((source) => source.id)).toEqual(["local-default"])
    expect(getActiveFileSourceId()).toBe("local-default")
  })

  it("keeps the active selection when deleting a different source", () => {
    const first = addFileSource(s3)
    vi.spyOn(Date, "now").mockReturnValue(99)
    const second = addFileSource(s3)
    setActiveFileSourceId(first.id)
    deleteFileSource(second.id)
    expect(getActiveFileSourceId()).toBe(first.id)
  })

  it("refuses to delete the local source", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    deleteFileSource("local-default")
    expect(getFileSources().map((source) => source.id)).toEqual(["local-default"])
  })

  it("falls back to local when the active id names nothing", () => {
    setActiveFileSourceId("gone")
    expect(getActiveFileSource().id).toBe("local-default")
  })

  it("only reports a working connection for the local source", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(await testFileSourceConnection(getActiveFileSource())).toBe(true)
    expect(await testFileSourceConnection({ ...s3, id: "s3-1", createdAt: "", updatedAt: "" } as AnyFileSource)).toBe(
      false,
    )
  })
})
