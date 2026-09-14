/**
 * @fileoverview Covers the URLs the app uses to reach the help docs.
 *
 * The docs are static-exported into `public/docs` by `scripts/build-docs.mjs`
 * and served at `/docs` on the app's own origin, so these links have to be
 * same-origin paths by default — a regression back to an absolute GitHub URL
 * (or to a `/docs/docs/…` double prefix) would still render as a working link
 * while quietly sending readers off the site.
 */

import { describe, expect, it } from "vitest"

import {
  docsHomeUrl,
  docsPageUrl,
  featureDocsUrlForRoute,
  guideDocsUrl,
} from "../docs-links"
import { APP_FEATURES, featureDocUrl } from "../ui/features/feature-catalog"

describe("docsPageUrl", () => {
  it("resolves a page to a same-origin path under /docs", () => {
    expect(docsPageUrl("features/drill-sets")).toBe("/docs/features/drill-sets")
  })

  it("accepts a leading slash or an .mdx extension", () => {
    expect(docsPageUrl("/features/drill-sets")).toBe("/docs/features/drill-sets")
    expect(docsPageUrl("features/drill-sets.mdx")).toBe("/docs/features/drill-sets")
    expect(docsPageUrl("features/drill-sets.md")).toBe("/docs/features/drill-sets")
  })

  it("prefixes the path exactly once", () => {
    expect(docsPageUrl("features/drill-sets").match(/\/docs\//g)).toHaveLength(1)
  })
})

describe("docsHomeUrl", () => {
  it("is the docs root on this origin", () => {
    expect(docsHomeUrl()).toBe("/docs")
  })
})

describe("guideDocsUrl", () => {
  it("resolves each guide under /docs/guides", () => {
    expect(guideDocsUrl("training-tools")).toBe("/docs/guides/training-tools")
    expect(guideDocsUrl("practice-tools")).toBe("/docs/guides/practice-tools")
    expect(guideDocsUrl("research-collaboration")).toBe(
      "/docs/guides/research-collaboration",
    )
  })
})

describe("featureDocsUrlForRoute", () => {
  it("resolves a route that the catalog gives a doc", () => {
    const entry = APP_FEATURES.find((feature) => feature.doc)
    expect(entry).toBeDefined()
    expect(featureDocsUrlForRoute(entry!.href)).toBe(
      `/docs/features/${entry!.doc!.replace(/\.mdx?$/, "")}`,
    )
  })

  it("returns undefined for a route with no doc", () => {
    expect(featureDocsUrlForRoute("/no-such-route")).toBeUndefined()
  })
})

describe("featureDocUrl", () => {
  it("drops the source file's extension", () => {
    expect(featureDocUrl({ doc: "drill-sets.md" } as never)).toBe(
      "/docs/features/drill-sets",
    )
  })

  it("agrees with docsPageUrl for every catalog entry", () => {
    for (const entry of APP_FEATURES) {
      const url = featureDocUrl(entry)
      if (!url) continue
      expect(url).toBe(docsPageUrl(`features/${entry.doc}`))
      expect(url.startsWith("/docs/features/")).toBe(true)
    }
  })
})
