/** @vitest-environment jsdom */
/**
 * @fileoverview A research publisher's page: its details and files, the
 * Subscribe button and its wallet checks, and Save a copy once subscribed.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketBoardResponse, PublisherPageResponse } from "../../src";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { PublisherView } from "../../src/ui";
import { bodyText, button, cleanup, click, flush, installDomShims, mockFetch, mount } from "../helpers/dom";

beforeAll(installDomShims);
beforeEach(() => {
  window.history.replaceState(null, "", "/research/publishers/westwood-lab");
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const board: MarketBoardResponse = { wallet: { balanceCents: 1250 }, topUps: [], topUpsEnabled: false, listings: [] };

function page(overrides: Partial<PublisherPageResponse> = {}): PublisherPageResponse {
  return {
    publisher: {
      id: "p1",
      slug: "westwood-lab",
      name: "Westwood Lab",
      description: "Space research.",
      researchGroup: "Westwood HS",
      students: ["Ana Ruiz", "Ben Lee"],
      years: "2025–2026",
      website: "",
      priceCents: 500,
      owner: { id: "o1", name: "Coach Kim", image: null },
      subscribers: 2,
      createdAt: "",
    },
    files: [
      {
        documentId: 7,
        title: "Space aff",
        author: "Ana Ruiz",
        researchGroup: "Westwood HS",
        students: ["Ana Ruiz"],
        years: "2025–2026",
        publishedOn: "2026-03-14",
        summary: "",
        quoteCount: 40,
        pageCount: 12,
      },
    ],
    subscription: null,
    isOwner: false,
    wallet: { balanceCents: 1250 },
    ...overrides,
  };
}

describe("PublisherView", () => {
  const editorHref = (id: number) => `#doc-${id}`;

  it("shows the group, its students and its files, locked until subscribed", async () => {
    mockFetch([
      { match: "/publishers/westwood-lab", respond: page() },
      { match: "/api/market", respond: board },
    ]);
    mount(<PublisherView slug="westwood-lab" editorHref={editorHref} />);
    await flush();
    const text = bodyText();
    expect(text).toContain("Westwood Lab");
    expect(text).toContain("Westwood HS · 2025–2026 · run by Coach Kim");
    expect(text).toContain("Ben Lee");
    expect(text).toContain("Space aff");
    expect(text).toContain("Mar 14, 2026");
    expect(text).toContain("Subscribers");
    expect(() => button("Save a copy")).toThrow();
  });

  it("subscribes, then saves a copy into the reader's files", async () => {
    const subscribed = page({ subscription: { expiresAt: "2026-04-13T00:00:00.000Z", active: true }, wallet: { balanceCents: 750 } });
    const { calls } = mockFetch([
      { match: "/publishers/westwood-lab/subscribe", method: "POST", respond: subscribed },
      { match: "/files/7/copy", method: "POST", respond: { documentId: 99 } },
      { match: "/publishers/westwood-lab", respond: page() },
      { match: "/api/market", respond: board },
    ]);
    mount(<PublisherView slug="westwood-lab" editorHref={editorHref} />);
    await flush();
    click(button("Subscribe for $5.00 / month"));
    await flush();
    expect(calls.some((c) => c.url.endsWith("/subscribe"))).toBe(true);
    expect(toast.success).toHaveBeenCalledWith("Subscribed to Westwood Lab.");
    expect(bodyText()).toContain("Subscribed until Apr 13, 2026");
    click(button("Save a copy"));
    await flush();
    expect(window.location.hash).toBe("#doc-99");
  });

  it("disables Subscribe when the wallet is short", async () => {
    mockFetch([
      { match: "/publishers/westwood-lab", respond: page({ wallet: { balanceCents: 100 } }) },
      { match: "/api/market", respond: board },
    ]);
    mount(<PublisherView slug="westwood-lab" editorHref={editorHref} />);
    await flush();
    expect(button("Subscribe for $5.00 / month").disabled).toBe(true);
    expect(bodyText()).toContain("Your wallet has $1.00. Add money to subscribe.");
  });

  it("gives the owner Edit page and Save a copy", async () => {
    mockFetch([
      { match: "/publishers/westwood-lab", respond: page({ isOwner: true }) },
      { match: "/api/market", respond: board },
    ]);
    mount(<PublisherView slug="westwood-lab" editorHref={editorHref} />);
    await flush();
    expect(button("Save a copy")).toBeTruthy();
    click(button("Edit page"));
    await flush();
    expect(document.querySelector('[data-testid="publisher-editor"]')).not.toBeNull();
  });
});
