/**
 * Render test for `FlowHistoryDialog`'s "History" tab. As in
 * `test/panels.test.tsx`, the Vitest environment is `node`, so this renders
 * through `react-dom/server` and asserts on the markup — there's no DOM to
 * click through, so `onLoad`/`onClear` are wired but not exercised here; the
 * grouping logic they depend on is covered directly in
 * `flowHistoryGrouping.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { FlowHistoryList } from "../src/dialogs/FlowHistoryList";
import type { FlowHistory } from "../src/state/store";
import type { Flow } from "../src/types/flow";
import { markToolRecordsSynced, resetToolRecordAutoSync } from "debate-data-sync/src/state/tool-record-auto-sync";

const flow: Flow = {
  content: "1AC",
  level: 0,
  columns: ["1AC", "1NC"],
  invert: false,
  focus: false,
  index: 0,
  lastFocus: [0],
  children: [],
  id: 1,
};

function makeEntry(overrides: Partial<FlowHistory> = {}): FlowHistory {
  return {
    id: "1-1000",
    flow,
    timestamp: new Date(2024, 0, 5, 9, 0, 0).getTime(),
    label: "Neg case",
    ...overrides,
  };
}

const noop = () => {};

describe("FlowHistoryList", () => {
  it("shows an empty state when there is no history", () => {
    const html = renderToStaticMarkup(<FlowHistoryList history={[]} onLoad={noop} onClear={noop} />);
    expect(html).toContain("No history yet");
    // Nothing to clear, so the "Clear history" action shouldn't render either.
    expect(html).not.toContain("Clear history");
  });

  it("renders each entry's label under its day's group, with an entry count", () => {
    const day1 = new Date(2024, 0, 5, 9, 0, 0).getTime();
    const entries = [
      makeEntry({ id: "a", label: "Neg case", timestamp: day1 + 1000 }),
      makeEntry({ id: "b", label: "1AC block", timestamp: day1 }),
    ];

    const html = renderToStaticMarkup(<FlowHistoryList history={entries} onLoad={noop} onClear={noop} />);

    expect(html).toContain("Neg case");
    expect(html).toContain("1AC block");
    expect(html).toContain("2 entries");
    expect(html).toContain("Clear history");
  });

  it("uses singular 'entry' for a single-entry day", () => {
    const html = renderToStaticMarkup(
      <FlowHistoryList history={[makeEntry({ id: "solo" })]} onLoad={noop} onClear={noop} />,
    );
    expect(html).toContain("1 entry");
    expect(html).not.toContain("1 entries");
  });

  it("groups entries from different days separately", () => {
    const day1 = new Date(2024, 0, 5, 9, 0, 0).getTime();
    const day2 = new Date(2024, 0, 6, 9, 0, 0).getTime();
    const entries = [makeEntry({ id: "a", timestamp: day2 }), makeEntry({ id: "b", timestamp: day1 })];

    const html = renderToStaticMarkup(<FlowHistoryList history={entries} onLoad={noop} onClear={noop} />);

    const day1Key = new Date(day1).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const day2Key = new Date(day2).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    expect(html).toContain(day1Key);
    expect(html).toContain(day2Key);
  });

  it("shows no sync badge when the collection has never been baselined", () => {
    // The common case for a signed-out browser, or before the first sync
    // tick has run: neither "synced" nor "not yet synced" would be honest.
    const html = renderToStaticMarkup(
      <FlowHistoryList history={[makeEntry({ id: "solo" })]} onLoad={noop} onClear={noop} />,
    );
    expect(html).not.toContain("Synced");
    expect(html).not.toContain("Not yet synced");
  });
});

describe("FlowHistoryList sync status badge", () => {
  /** A minimal localStorage, since this package's Vitest environment is `node`. */
  function installLocalStorage(): void {
    const store = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  }

  beforeEach(() => {
    installLocalStorage();
    resetToolRecordAutoSync();
  });

  afterEach(() => {
    resetToolRecordAutoSync();
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it("badges an entry 'Synced' once its exact value has reached the account", () => {
    const entry = makeEntry({ id: "solo" });
    localStorage.setItem("flow-history", JSON.stringify([entry]));
    markToolRecordsSynced("flowHistory");

    const html = renderToStaticMarkup(<FlowHistoryList history={[entry]} onLoad={noop} onClear={noop} />);

    expect(html).toContain("Synced");
    expect(html).not.toContain("Not yet synced");
  });

  it("badges an entry 'Not yet synced' when it hasn't reached the account", () => {
    // Baselined with nothing in it yet — e.g. right after sign-in, before this
    // entry's first flush.
    localStorage.setItem("flow-history", JSON.stringify([]));
    markToolRecordsSynced("flowHistory");

    const html = renderToStaticMarkup(
      <FlowHistoryList history={[makeEntry({ id: "solo" })]} onLoad={noop} onClear={noop} />,
    );

    expect(html).toContain("Not yet synced");
  });

  it("badges a changed entry 'Not yet synced' even though an earlier value of it landed", () => {
    const original = makeEntry({ id: "solo", label: "Neg case" });
    localStorage.setItem("flow-history", JSON.stringify([original]));
    markToolRecordsSynced("flowHistory");

    const edited = { ...original, label: "Neg case v2" };
    const html = renderToStaticMarkup(<FlowHistoryList history={[edited]} onLoad={noop} onClear={noop} />);

    expect(html).toContain("Not yet synced");
  });
});
