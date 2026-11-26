import { describe, expect, it, vi } from "vitest";

import { APP_ROUTES, CLIENT_ROUTES, PAGE_ROUTES } from "../../src/routes";

// research-agent-ui is a prebuilt bundle that imports bare `next/navigation`,
// which only the browser host aliases to this package's shim; loaded in plain
// Node it does not resolve. The two settings pages are the only routes that
// reach it, so stand it in rather than leave their loaders unchecked.
vi.mock("research-agent-ui", () => ({
  ChatInputBox: () => null,
  ChatWindow: () => null,
  configureResearchAgentUI: () => {},
  useChat: () => ({}),
}));
vi.mock("research-agent-ui/settings", () => ({ settingsSections: [] }));

describe("route table", () => {
  it("has no duplicate patterns across the page and client routes", () => {
    const counts = new Map<string, number>();
    for (const route of APP_ROUTES) counts.set(route.pattern, (counts.get(route.pattern) ?? 0) + 1);
    expect([...counts].filter(([, count]) => count > 1)).toEqual([]);
  });

  it("builds APP_ROUTES as the page routes followed by the client routes", () => {
    expect(APP_ROUTES).toEqual([...PAGE_ROUTES, ...CLIENT_ROUTES]);
  });

  it("uses Next-style patterns that start with a slash", () => {
    for (const route of APP_ROUTES) expect(route.pattern.startsWith("/")).toBe(true);
  });
});

describe("route loaders", () => {
  it.each(APP_ROUTES.map((route) => [route.pattern, route] as const))(
    "%s loads a page component",
    async (_pattern, route) => {
      const page = await route.load();
      expect(typeof page.default).toBe("function");
      if (route.layout) {
        const layout = await route.layout();
        expect(typeof layout.default).toBe("function");
      }
    },
    60_000,
  );
});
