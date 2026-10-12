// @vitest-environment jsdom
/**
 * @fileoverview `useSearchState` — a new query always goes out and always wins.
 *
 * The regressions this pins: a slower answer for an older query landing after
 * a newer one was typed (stale results), a superseded request left running,
 * and a committed query (Enter, a picked suggestion) still waiting out the
 * typing debounce.
 */

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchState } from "../src/hooks/useSearchState";
import { SEARCH_DEBOUNCE_MS } from "../src/lib/search-query";
import { flush, mount } from "./helpers/mount";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface PendingFetch {
  url: string;
  signal: AbortSignal;
  respond: (body: unknown) => Promise<void>;
}

let fetches: PendingFetch[] = [];

function queryOf(f: PendingFetch): string | null {
  return new URL(f.url, "https://debate-ai.com").searchParams.get("q");
}

async function renderSearch() {
  const result = { current: undefined as unknown as ReturnType<typeof useSearchState> };
  function Probe() {
    result.current = useSearchState();
    return null;
  }
  const mounted = await mount(<Probe />);
  return { result, unmount: mounted.unmount };
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  fetches = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit) => {
      return new Promise<Response>((resolve, reject) => {
        const signal = init.signal as AbortSignal;
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        fetches.push({
          url,
          signal,
          respond: async (body) => {
            await act(async () => {
              resolve(new Response(JSON.stringify(body)));
              await vi.runOnlyPendingTimersAsync();
            });
          },
        });
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const result = (id: string) => ({ id, title: id });

describe("useSearchState", () => {
  it("aborts the old search and drops its late answer once the query changes", async () => {
    const { result: search, unmount } = await renderSearch();
    expect(fetches).toHaveLength(1);
    const defaultSearch = fetches[0];

    await flush(() => search.current.setSearchTerm("nuclear"));
    expect(defaultSearch.signal.aborted).toBe(true);

    await flush(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(fetches).toHaveLength(2);
    expect(queryOf(fetches[1])).toBe("nuclear");

    await fetches[1].respond({ results: [result("new")], total: 1 });
    // The default search's answer, arriving after the newer one, is ignored.
    await defaultSearch.respond({ results: [result("old")], total: 9 });
    expect(search.current.searchResults.map((r) => r.id)).toEqual(["new"]);
    expect(search.current.totalResults).toBe(1);
    expect(search.current.loading).toBe(false);
    await unmount();
  });

  it("waits out the debounce while typing", async () => {
    const { result: search, unmount } = await renderSearch();
    await fetches[0].respond({ results: [], total: 0 });

    await flush(() => search.current.setSearchTerm("nuc"));
    await flush(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    expect(fetches).toHaveLength(1);
    await flush(() => vi.advanceTimersByTime(1));
    expect(fetches.map(queryOf)).toEqual([null, "nuc"]);
    await unmount();
  });

  it("searches a committed query straight away", async () => {
    const { result: search, unmount } = await renderSearch();
    await fetches[0].respond({ results: [], total: 0 });

    await flush(() => search.current.setSearchTerm("nuclear war", { immediate: true }));
    expect(fetches.map(queryOf)).toEqual([null, "nuclear war"]);

    // Nothing else goes out once the debounce would have elapsed.
    await flush(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS * 2));
    expect(fetches).toHaveLength(2);
    await unmount();
  });

  it("sends the search waiting on the debounce when its term is committed", async () => {
    const { result: search, unmount } = await renderSearch();
    await fetches[0].respond({ results: [], total: 0 });

    await flush(() => search.current.setSearchTerm("nuclear"));
    expect(fetches).toHaveLength(1);
    await flush(() => search.current.setSearchTerm("nuclear", { immediate: true }));
    expect(fetches.map(queryOf)).toEqual([null, "nuclear"]);

    await flush(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS * 2));
    expect(fetches).toHaveLength(2);
    await unmount();
  });
});
