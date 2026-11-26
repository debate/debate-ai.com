/** @vitest-environment jsdom */
/**
 * @fileoverview `LecturesPage` is the coordinator behind /videos, /lectures
 * and their siblings: it turns the route slug and query string into filter
 * state, asks the feed for that listing, and hands rendering to one of four
 * branch views. The branch views and the data hooks are stubbed here so the
 * assertions are about what the coordinator decides — which branch, which
 * feed filters, which URL writes — not about what the children draw.
 */

import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { VideoType } from "../src/types/videos"
import type { VideoFeedFilters } from "../src/hooks/useVideoFeed"

const nav = vi.hoisted(() => ({
  params: {} as Record<string, string | string[] | undefined>,
  pathname: "/videos",
  replace: vi.fn(),
}))

const feedState = vi.hoisted(() => ({
  videos: [] as unknown[],
  hasMore: false,
  isLoading: false,
  isLoadingMore: false,
  loadMore: vi.fn(),
  filters: [] as Array<Record<string, unknown>>,
  metaFilters: [] as Array<Record<string, unknown> | undefined>,
}))

const watchHistory = vi.hoisted(() => ({ map: new Map<string, { videoId: string; watchedAt: string }>() }))

const captured = vi.hoisted(() => ({
  grid: null as null | Record<string, any>,
  shell: [] as Array<Record<string, any>>,
  filterBar: null as null | Record<string, any>,
  panel: null as null | Record<string, any>,
  dictionary: null as null | Record<string, any>,
  statistics: null as null | Record<string, any>,
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useParams: () => nav.params,
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock("../src/hooks/useVideoFeed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/hooks/useVideoFeed")>()),
  useVideoFeed: (filters: Record<string, unknown>) => {
    feedState.filters.push(filters)
    return {
      videos: feedState.videos,
      total: feedState.videos.length,
      facets: null,
      hasMore: feedState.hasMore,
      isLoading: feedState.isLoading,
      isLoadingMore: feedState.isLoadingMore,
      errorMessage: "",
      loadMore: feedState.loadMore,
      reload: vi.fn(),
    }
  },
  useVideoMeta: (filters?: Record<string, unknown>) => {
    feedState.metaFilters.push(filters)
    return {
      meta: { topics: [{ year: 2026 }], history: { seasons: [] } },
      counts: {
        total: 100,
        rounds: 60,
        lectures: 40,
        lecturesOnly: 40,
        topPicks: 5,
        byStyle: { 1: 10, 2: 20, 3: 30, 4: 40 },
      },
      lectureCategories: [
        { label: "WSD", count: 7 },
        { label: "Speech", count: 3 },
      ],
      suggestions: { keywords: [], tournaments: [] },
      isLoading: false,
    }
  },
}))

vi.mock("../src/hooks/useWatchHistory", () => ({ useWatchHistory: () => watchHistory.map }))
vi.mock("../src/hooks/useYouTubeStats", () => ({ useYouTubeStats: () => ({ views: 1 }) }))
vi.mock("../src/hooks/useInfiniteScroll", () => ({ useInfiniteScroll: vi.fn() }))

vi.mock("../src/panels/LecturesVideoGridView", () => ({
  LecturesVideoGridView: (props: Record<string, any>) => {
    captured.grid = props
    return <div data-testid="grid" ref={props.videosSectionRef} />
  },
}))
vi.mock("../src/panels/LecturesSidebarShell", () => ({
  LecturesSidebarShell: (props: Record<string, any>) => {
    captured.shell.push(props)
    return <div data-testid={`shell-${props.activeId}`}>{props.children}</div>
  },
}))
vi.mock("../src/panels/dictionary/LecturesDictionaryView", () => ({
  LecturesDictionaryView: (props: Record<string, any>) => {
    captured.dictionary = props
    return <div data-testid="dictionary" />
  },
}))
vi.mock("../src/panels/statistics/StatisticsPage", () => ({
  StatisticsPage: (props: Record<string, any>) => {
    captured.statistics = props
    return <div data-testid="statistics" />
  },
}))
vi.mock("../src/components/layout/StickyHeader", () => ({
  StickyHeader: ({ controls }: { controls?: ReactNode }) => <header>{controls}</header>,
}))
vi.mock("@debate-ai/rankings/src/leaderboard/RankingsLeaderboardPanel", () => ({
  LeaderboardPanel: (props: Record<string, any>) => {
    captured.panel = props
    return <div data-testid="leaderboard" />
  },
}))
vi.mock("@debate-ai/rankings/src/leaderboard/LeaderboardFilterBar", () => ({
  LeaderboardFilterBar: (props: Record<string, any>) => {
    captured.filterBar = props
    return <div data-testid="filter-bar" />
  },
}))

const { LecturesPage } = await import("../src/panels/LecturesPage")
const { useVideoPlayerStore } = await import("../src/state/videoPlayerStore")
const { flush, mount } = await import("./helpers/mount")

const video = (id: string, topPick = false): VideoType => [id, `Video ${id}`, "2026-01-01", "Channel", 1, "", 1, null, null, null, null, null, null, null, null, topPick]

const lastFilters = () => feedState.filters.at(-1) as VideoFeedFilters & Record<string, unknown>

async function renderPage(url = "/videos", slug?: string, pathname = "/videos") {
  window.history.replaceState({}, "", url)
  nav.params = slug ? { category: slug } : {}
  nav.pathname = pathname
  return mount(<LecturesPage dockSlot={<i>dock</i>} accountSlot={<i>account</i>} />)
}

beforeEach(() => {
  window.localStorage.clear()
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })))
  feedState.videos = []
  feedState.hasMore = false
  feedState.isLoading = false
  feedState.isLoadingMore = false
  feedState.filters = []
  feedState.metaFilters = []
  feedState.loadMore.mockReset()
  nav.replace.mockReset()
  watchHistory.map = new Map()
  captured.grid = null
  captured.shell = []
  captured.filterBar = null
  captured.panel = null
  captured.dictionary = null
  captured.statistics = null
})

afterEach(() => {
  document.body.innerHTML = ""
  vi.unstubAllGlobals()
})

describe("LecturesPage branches", () => {
  it("shows the video grid by default, with the library counts as quick links", async () => {
    const page = await renderPage()
    expect(page.container.querySelector('[data-testid="grid"]')).not.toBeNull()
    expect(captured.grid?.currentCategory).toBe("lectures")
    expect(captured.grid?.quickLinkCounts).toMatchObject({
      allVideos: 100,
      lectures: 40,
      policy: 10,
      pf: 20,
      ld: 30,
      college: 40,
      topPicks: 5,
      wsd: 7,
      acc: 0,
      speech: 3,
      statistics: 100,
      dictionary: 203,
    })
    expect(lastFilters()).toMatchObject({ source: "all", enabled: true, withFacets: true, topPicksOnly: false })
    await page.unmount()
  })

  it("shows the dictionary for /videos/dictionary and the ?view=dictionary query", async () => {
    const bySlug = await renderPage("/videos/dictionary", "dictionary")
    expect(bySlug.container.querySelector('[data-testid="shell-dictionary"]')).not.toBeNull()
    expect(lastFilters().enabled).toBe(false)
    await flush(() => captured.dictionary?.onDictSearchTermChange("tabula"))
    expect(captured.dictionary?.dictSearchTerm).toBe("tabula")
    await bySlug.unmount()

    const byQuery = await renderPage("/videos?view=dictionary")
    expect(byQuery.container.querySelector('[data-testid="dictionary"]')).not.toBeNull()
    await byQuery.unmount()
  })

  it("shows the statistics view with the topics and the host's explorer slot", async () => {
    window.history.replaceState({}, "", "/practice/statistics")
    nav.params = {}
    nav.pathname = "/practice/statistics/"
    const stats = await mount(<LecturesPage topicAreasSlot={<b>areas</b>} />)
    await flush()
    expect(stats.container.querySelector('[data-testid="statistics"]')).not.toBeNull()
    expect(captured.statistics?.topics).toEqual([{ year: 2026 }])
    expect(captured.statistics?.youtubeStats).toEqual({ views: 1 })
    expect(captured.shell.at(-1)?.activeId).toBe("statistics")
    await stats.unmount()
  })

  it("lands on the leaderboard for /practice/rankings and rewrites the URL as its filters change", async () => {
    const page = await renderPage("/practice/rankings?format=VLD&by=schools", undefined, "/practice/rankings")
    expect(page.container.querySelector('[data-testid="leaderboard"]')).not.toBeNull()
    expect(captured.filterBar?.division).toBe("VLD")
    expect(captured.filterBar?.view).toBe("schools")
    expect(captured.panel?.history).toEqual({ seasons: [] })
    expect(page.container.querySelector('a[aria-label="Back to lectures"]')?.getAttribute("href")).toBe("/videos")

    await flush(() => captured.filterBar?.onChangeDivision("VPF"))
    expect(nav.replace).toHaveBeenLastCalledWith("?format=VPF&by=schools", { scroll: false })
    expect(captured.filterBar?.division).toBe("VPF")

    await flush(() => captured.filterBar?.onChangeView("teams"))
    expect(nav.replace).toHaveBeenLastCalledWith("?format=VPF", { scroll: false })
    expect(captured.panel?.controlledView).toBe("teams")

    await flush(() => captured.filterBar?.onChangeYear("2024"))
    expect(captured.panel?.controlledYear).toBe("2024")
    await page.unmount()
  })

  it("reads the school view from format=SCHOOLS and ignores an unknown format", async () => {
    const page = await renderPage("/practice/rankings?format=SCHOOLS", undefined, "/practice/rankings")
    expect(captured.filterBar?.view).toBe("schools")
    expect(captured.filterBar?.division).toBe("VPF")
    await page.unmount()
  })
})

describe("LecturesPage filters", () => {
  it("applies a style slug to the feed", async () => {
    const page = await renderPage("/videos/pf", "pf")
    expect(captured.grid?.selectedStyle).toBe(2)
    expect(lastFilters().style).toBe(2)
    await page.unmount()
  })

  it("reads an unknown slug as a lecture category id", async () => {
    const page = await renderPage("/lectures/topic_lectures", "Topic_Lectures")
    expect(captured.grid?.selectedCategory).toBe("topic_lectures")
    expect(lastFilters().categoryKey).toBeTruthy()
    expect(lastFilters().lecturesOnly).toBe(false)
    await page.unmount()

    const all = await renderPage("/lectures", "lectures")
    expect(captured.grid?.selectedCategory).toBe("all")
    expect(lastFilters().lecturesOnly).toBe(true)
    await all.unmount()
  })

  it("scrolls the video section into view once a slug's videos have loaded", async () => {
    feedState.videos = [video("a")]
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    const page = await renderPage("/videos/college", "college")
    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" })
    await page.unmount()

    scroll.mockClear()
    const plain = await renderPage("/videos")
    expect(scroll).not.toHaveBeenCalled()
    await plain.unmount()
  })

  it("restores search, category, sort and year from the query string", async () => {
    const page = await renderPage("/videos?q=kritik&category=wsd&sort=Views&year=2024")
    expect(captured.grid).toMatchObject({
      searchTerm: "kritik",
      selectedCategory: "wsd",
      sortOrder: "Views",
      selectedYear: "2024",
    })
    await page.unmount()
  })

  it("starts on the view named by the query (top picks, leaderboard, statistics)", async () => {
    const picks = await renderPage("/videos?view=topPicks")
    expect(captured.grid?.currentCategory).toBe("topPicks")
    expect(lastFilters().topPicksOnly).toBe(true)
    await picks.unmount()

    const board = await renderPage("/videos?view=leaderboard")
    expect(board.container.querySelector('[data-testid="leaderboard"]')).not.toBeNull()
    await board.unmount()

    const stats = await renderPage("/videos?view=statistics")
    expect(stats.container.querySelector('[data-testid="statistics"]')).not.toBeNull()
    await stats.unmount()
  })

  it("writes search, year, sort and style changes to the URL", async () => {
    const page = await renderPage()
    await flush(() => captured.grid?.onSearchChange("perm"))
    expect(captured.grid?.searchTerm).toBe("perm")
    expect(window.location.search).toContain("q=perm")
    expect(useVideoPlayerStore.getState().searchHandler).toBeTypeOf("function")

    useVideoPlayerStore.getState().searchHandler?.("topicality")
    await flush()
    expect(captured.grid?.searchTerm).toBe("topicality")

    await flush(() => captured.grid?.onYearChange("2023"))
    await flush(() => captured.grid?.onSortChange("Views"))
    await flush(() => captured.grid?.onStyleChange(3))
    expect(window.location.search).toContain("year=2023")
    expect(window.location.search).toContain("sort=Views")
    expect(window.location.search).toContain("style=3")
    expect(lastFilters()).toMatchObject({ year: "2023", sort: "Views", style: 3, q: "topicality" })

    await flush(() => captured.grid?.onStyleChange(""))
    expect(window.location.search).not.toContain("style=")

    await flush(() => captured.grid?.onClearSearch())
    expect(captured.grid?.searchTerm).toBe("")
    expect(window.location.search).not.toContain("q=")

    await page.unmount()
    expect(useVideoPlayerStore.getState().searchHandler).toBeNull()
  })

  it("toggles thumbnails, view mode and stacked playlists", async () => {
    const page = await renderPage()
    expect(captured.grid?.showThumbnails).toBe(true)
    await flush(() => captured.grid?.onToggleThumbnails())
    expect(captured.grid?.showThumbnails).toBe(false)
    await flush(() => captured.grid?.onViewModeChange("grid"))
    expect(captured.grid?.viewMode).toBe("grid")
    expect(captured.grid?.stackedPlaylists).toBe(true)
    await flush(() => captured.grid?.onToggleStackedPlaylists())
    expect(captured.grid?.stackedPlaylists).toBe(false)
    await flush(() => captured.grid?.onSearchFocus())
    expect(captured.grid?.isSearchFocused).toBe(true)
    await flush(() => captured.grid?.onSearchBlur())
    expect(captured.grid?.isSearchFocused).toBe(false)
    await flush(() => captured.grid?.onStatsModalOpenChange(true))
    expect(captured.grid?.statsModalOpen).toBe(true)
    await page.unmount()
  })
})

describe("LecturesPage favourites, hidden videos and history", () => {
  it("narrows the feed to starred videos, whatever other filters say", async () => {
    const page = await renderPage()
    await flush(() => captured.grid?.onToggleFavorite("fav1"))
    await flush(() => captured.grid?.onToggleFavoritesOnly())
    expect(captured.grid?.showFavoritesOnly).toBe(true)
    expect(captured.grid?.quickLinkCounts.favorites).toBe(1)
    expect(lastFilters().ids).toEqual(["fav1"])
    expect(lastFilters().excludeIds).toBeUndefined()
    expect(lastFilters().style).toBeUndefined()
    await page.unmount()
  })

  it("sends hidden videos as a deny-list, except while searching", async () => {
    const page = await renderPage()
    await flush(() => captured.grid?.onHideVideo("h1"))
    expect(lastFilters().excludeIds).toEqual(["h1"])
    expect(captured.grid?.hiddenVideos.has("h1")).toBe(true)

    await flush(() => captured.grid?.onSearchChange("find h1"))
    expect(lastFilters().excludeIds).toBeNull()

    await flush(() => captured.grid?.onClearSearch())
    await flush(() => captured.grid?.onUnhideVideo("h1"))
    expect(lastFilters().excludeIds).toBeNull()
    await page.unmount()
  })

  it("lists the watch history newest-watched first, as one full page", async () => {
    watchHistory.map = new Map([
      ["old", { videoId: "old", watchedAt: "2026-01-01T00:00:00Z" }],
      ["new", { videoId: "new", watchedAt: "2026-03-01T00:00:00Z" }],
    ])
    feedState.videos = [video("old"), video("new"), video("unseen")]
    const page = await renderPage("/videos/history", "history")
    expect(lastFilters().ids).toEqual(["new", "old"])
    expect(lastFilters().pageSize).toBeGreaterThan(50)
    expect(captured.grid?.currentVideos.map((v: VideoType) => v[0])).toEqual(["new", "old", "unseen"])
    expect(captured.grid?.quickLinkCounts.history).toBe(2)
    await page.unmount()
  })

  it("an empty history still filters, so it lists nothing rather than everything", async () => {
    const page = await renderPage("/videos/history", "history")
    expect(lastFilters().ids).toEqual([])
    await page.unmount()
  })

  it("marks top picks from the loaded videos", async () => {
    feedState.videos = [video("a", true), video("b"), video("c", true)]
    const page = await renderPage()
    expect([...captured.grid?.topPicks].sort()).toEqual(["a", "c"])
    expect(captured.grid?.totalVideos).toBe(3)
    await page.unmount()
  })
})

describe("LecturesPage paging", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("keeps paging on its own in the list view until the library is exhausted", async () => {
    feedState.hasMore = true
    const page = await renderPage()
    expect(captured.grid?.viewMode).toBe("list")
    await flush(() => vi.advanceTimersByTimeAsync(60))
    expect(feedState.loadMore).toHaveBeenCalled()
    await page.unmount()
  })

  it("uses an idle callback when the browser has one, and cancels it on unmount", async () => {
    feedState.hasMore = true
    const cancel = vi.fn()
    const request = vi.fn(() => 7)
    vi.stubGlobal("requestIdleCallback", request)
    vi.stubGlobal("cancelIdleCallback", cancel)
    window.requestIdleCallback = request as never
    window.cancelIdleCallback = cancel as never
    const page = await renderPage()
    expect(request).toHaveBeenCalled()
    await page.unmount()
    expect(cancel).toHaveBeenCalledWith(7)
    delete (window as { requestIdleCallback?: unknown }).requestIdleCallback
    delete (window as { cancelIdleCallback?: unknown }).cancelIdleCallback
  })

  it("does not auto-page the card grid or a feed with nothing more", async () => {
    feedState.hasMore = true
    const page = await renderPage()
    await flush(() => captured.grid?.onViewModeChange("grid"))
    feedState.loadMore.mockClear()
    await flush(() => vi.advanceTimersByTimeAsync(200))
    expect(feedState.loadMore).not.toHaveBeenCalled()
    await page.unmount()
  })
})
