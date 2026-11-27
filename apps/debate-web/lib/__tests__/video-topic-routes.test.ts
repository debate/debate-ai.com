/**
 * @fileoverview A round video's short address, `/<topic code>/<tournament>/<round>/<teams>`
 * (`/cpd27/shirley/octofinals/kansas-ss-harvard-ab/1nc/llm`), is a root-level
 * route, and Topic Starters share its first segment for `vcx`, `ld` and `pf`.
 * Resolved here through vinext's own config matchers against the real
 * `next.config.mjs`, in the order the Worker runs them.
 *
 * Pins that only real topic code + two-digit year values match, that a Topic
 * Starter keeps its address, and that no top-level route, static file or
 * username can be shaped like a video topic code.
 */
import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { matchRewrite, requestContextFromRequest } from "vinext/config/config-matchers"
import {
  MAX_ROUND_SEGMENTS,
  MIN_ROUND_SEGMENTS,
  TOPIC_STARTER_ROOTS,
  VIDEO_TOPIC_CODE_SOURCE,
  isVideoRoundPath,
  isVideoTopicCode,
} from "@debate-ai/videos/src/lib/video-topic-path"
import { isUsername } from "@debate-ai/reason-docs/lib/reason-docs/personal-doc-paths"
import nextConfig, {
  TOPIC_STARTER_ROOTS as CONFIG_TOPIC_STARTER_ROOTS,
  VIDEO_TOPIC_CODE_SOURCE as CONFIG_VIDEO_TOPIC_CODE_SOURCE,
} from "../../next.config.mjs"

type Rewrite = Parameters<typeof matchRewrite>[1][number]

const ORIGIN = "https://d.ebate.app"
const rewrites = (await nextConfig.rewrites!()) as { beforeFiles: Rewrite[] }

/** The page a `beforeFiles` rewrite serves the path from, or `null`. */
function pageFor(pathAndQuery: string): string | null {
  const url = new URL(pathAndQuery, ORIGIN)
  const page = matchRewrite(url.pathname, rewrites.beforeFiles, requestContextFromRequest(new Request(url)))
  return page == null ? null : new URL(page, ORIGIN).pathname
}

describe("a round's short address", () => {
  it("is served by the video page, speech and view included", () => {
    expect(pageFor("/cpd27/shirley/octofinals/kansas-ss-harvard-ab")).toBe(
      "/videos/code/cpd27/shirley/octofinals/kansas-ss-harvard-ab",
    )
    expect(pageFor("/cpd27/shirley/octofinals/kansas-ss-harvard-ab/1nc/llm")).toBe(
      "/videos/code/cpd27/shirley/octofinals/kansas-ss-harvard-ab/1nc/llm",
    )
    expect(pageFor("/cpd27/shirley/octofinals/kansas-ss-harvard-ab/analysis/1nc/llm")).toBe(
      "/videos/code/cpd27/shirley/octofinals/kansas-ss-harvard-ab/analysis/1nc/llm",
    )
    expect(pageFor("/cpd27/shirley/octofinals/kansas-ss-harvard-ab/part-2?t=90")).toBe(
      "/videos/code/cpd27/shirley/octofinals/kansas-ss-harvard-ab/part-2",
    )
  })

  it("matches each format's codes, in any case", () => {
    for (const code of ["cpd27", "cpd00", "vcx24", "ldb23", "ldf05", "pfa27", "pfj07", "CPD27", "LDB23"]) {
      expect(pageFor(`/${code}/shirley/finals/a-b`), code).toBe(`/videos/code/${code}/shirley/finals/a-b`)
    }
  })

  it("matches nothing that is not a code with a two-digit year", () => {
    for (const code of ["cpd", "cpd2027", "cpd7", "cpd270", "ndt27x", "ldg23", "pfk27", "ld23", "cpda27", "wsd27", "acc27", "videos"]) {
      const page = pageFor(`/${code}/shirley/finals/a-b`)
      expect(page?.startsWith("/videos/code/") ?? false, code).toBe(false)
    }
  })

  it("is three to six segments after the code", () => {
    expect(pageFor("/cpd27")).toBeNull()
    expect(pageFor("/cpd27/shirley")).toBeNull()
    expect(pageFor("/cpd27/shirley/finals")).toBeNull()
    expect(pageFor("/cpd27/a/b/c/d/e/f")).toBe("/videos/code/cpd27/a/b/c/d/e/f")
    expect(pageFor("/cpd27/a/b/c/d/e/f/g")).toBeNull()
  })

  it("agrees with the path parser on which paths are rounds", () => {
    const paths = [
      "/cpd27/a/b/c", "/cpd27/a/b", "/cpd27/a/b/c/d/e/f", "/cpd27/a/b/c/d/e/f/g", "/vcx27/aff/a/b", "/vcx27/neg/a/b/c",
      "/pfa27/pro/a/b/c", "/pfa27/con/a/b", "/ldb23/ndt/finals/a-b", "/vcx27/affx/a/b", "/ndt27/a/b/c", "/bq27/a/b/c",
      "/cpd27/aff/a/b", "/vcx27", "/vcx27/aff",
    ]
    for (const path of paths) {
      const videoPage = pageFor(path)?.startsWith("/videos/code/") ?? false
      // `aff` is no tournament under a code with Topic Starters; `cpd` has none to spare.
      if (path.startsWith("/cpd27/aff/")) continue
      expect(videoPage, path).toBe(isVideoRoundPath(path))
    }
  })
})

describe("Topic Starters under the same code", () => {
  it("stay in the Debate Editor under their roots, however deep", () => {
    for (const path of [
      "/vcx27/aff/aff-k/k-aff-answers", "/vcx27/aff/a/b/c/d/e/f", "/ldb23/neg/cp/x/y", "/pfa27/pro/case/one", "/pfa27/CON/case/one", "/vcx27/aff",
    ]) {
      expect(pageFor(path), path).toBe("/reason-editor")
    }
  })

  it("stay in the Debate Editor when too short or too long to be a round, or under another code", () => {
    for (const path of ["/vcx27", "/vcx27/shirley/finals", "/ldb23/x", "/vcx27/a/b/c/d/e/f/g", "/ndt26/a/b/c", "/bq27/a/b/c", "/vcx1928/a/b/c"]) {
      expect(pageFor(path), path).toBe("/reason-editor")
    }
  })
})

describe("what the Worker's rewrite shares with @debate-ai/videos", () => {
  it("carries the same code shape, Topic Starter roots and segment counts", () => {
    expect(CONFIG_VIDEO_TOPIC_CODE_SOURCE).toBe(VIDEO_TOPIC_CODE_SOURCE)
    expect(CONFIG_TOPIC_STARTER_ROOTS.split("|").sort()).toEqual([...TOPIC_STARTER_ROOTS].sort())
    expect(MIN_ROUND_SEGMENTS).toBe(3)
    expect(MAX_ROUND_SEGMENTS).toBe(6)
  })

  it("has a page for the segments it rewrites to", () => {
    expect(existsSync(join(__dirname, "../../app/videos/code/[code]/[...segments]/page.tsx"))).toBe(true)
  })
})

describe("the site's first path segment", () => {
  const appDir = join(__dirname, "../../app")
  const topLevel = readdirSync(appDir).filter((name) => !name.startsWith("[") && !name.startsWith("("))

  it("has no top-level route or static file shaped like a video topic code", () => {
    expect(topLevel.length).toBeGreaterThan(20)
    for (const name of [...topLevel, ...topLevel.map((name) => name.replace(/\.[^.]+$/, ""))]) {
      expect(isVideoTopicCode(name), name).toBe(false)
    }
  })

  it("accepts no username that is shaped like a video topic code", () => {
    for (const code of ["cpd27", "cpd06", "vcx24", "ldb23", "pfa27"]) expect(isUsername(code), code).toBe(false)
  })
})
