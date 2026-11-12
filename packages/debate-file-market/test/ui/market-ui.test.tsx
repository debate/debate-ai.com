/** @vitest-environment jsdom */
/**
 * @fileoverview The market UI: the board of files for sale, the wallet card
 * and its Stripe top-up, the return-from-Stripe toast and balance polling,
 * the table-of-contents preview, and a listing's buy / open-a-copy flow.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ListingDetail, MarketBoardResponse } from "../../src";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { FileMarketPanel, ListingView, OutlinePreview, WalletCard } from "../../src/ui";
import { topUpReturnMessage } from "../../src/ui/WalletCard";
import { bodyText, button, cleanup, click, flush, installDomShims, mockFetch, mount } from "../helpers/dom";

beforeAll(installDomShims);
// jsdom can't navigate to another page, but it does follow same-page hash
// links, so the tests point `location.assign` targets at `#…` URLs and read
// the hash back.
beforeEach(() => {
  window.history.replaceState(null, "", "/research/market");
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

const topUps = [{ id: "usd-10" as const, amountCents: 1000, label: "$10", paymentLink: "https://buy.stripe.com/x" }];

function board(overrides: Partial<MarketBoardResponse> = {}): MarketBoardResponse {
  return {
    wallet: { balanceCents: 1250 },
    topUps,
    topUpsEnabled: true,
    listings: [
      {
        id: "l1",
        title: "Cap K",
        priceCents: 500,
        seller: { id: "u1", name: "Ada", image: null },
        headings: 12,
        sales: 3,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "l 2",
        title: "Fresh file",
        priceCents: 300,
        seller: { id: "u2", name: "Bo", image: null },
        headings: 2,
        sales: 0,
        createdAt: "",
        updatedAt: "",
      },
    ],
    ...overrides,
  };
}

function listing(overrides: Partial<ListingDetail> = {}): ListingDetail {
  return {
    ...board().listings[0],
    outline: [
      { level: 1, text: "Pocket" },
      { level: 4, text: "Tag" },
    ],
    owned: false,
    isSeller: false,
    active: true,
    ...overrides,
  };
}

describe("topUpReturnMessage", () => {
  it("reads only the two known outcomes", () => {
    expect(topUpReturnMessage("?topup=success")).toBe("success");
    expect(topUpReturnMessage("?topup=cancelled")).toBe("cancelled");
    expect(topUpReturnMessage("?topup=weird")).toBeNull();
    expect(topUpReturnMessage("")).toBeNull();
  });
});

describe("OutlinePreview", () => {
  it("lists headings indented by level", () => {
    mount(<OutlinePreview outline={listing().outline} className="max-h-10" />);
    const items = [...document.querySelectorAll("li")];
    expect(items.map((li) => li.textContent)).toEqual(["Pocket", "Tag"]);
    expect(items[1].className).toContain("pl-9");
    expect(document.querySelector("ol")!.className).toContain("max-h-10");
  });

  it("explains an empty preview", () => {
    mount(<OutlinePreview outline={[]} />);
    expect(bodyText()).toContain("This file has no headings");
  });
});

describe("WalletCard", () => {
  it("asks a signed-out visitor to sign in", () => {
    mount(<WalletCard wallet={null} topUps={topUps} topUpsEnabled />);
    expect(bodyText()).toContain("Sign in with an account to fund a wallet");
  });

  it("shows the balance and sends a top-up to Stripe, minus any old ?topup", async () => {
    window.history.replaceState(null, "", "/research/market/l1?topup=success");
    const { calls } = mockFetch([{ method: "POST", match: "/api/market/top-up", respond: { url: "#stripe-checkout" } }]);
    mount(<WalletCard wallet={{ balanceCents: 1250 }} topUps={topUps} topUpsEnabled />);
    expect(document.querySelector('[aria-label="Wallet balance"]')!.textContent).toBe("$12.50");
    click(button("Add $10"));
    await flush();
    expect(calls[0].body).toEqual({ topUp: "usd-10", returnTo: "/research/market/l1" });
    expect(window.location.hash).toBe("#stripe-checkout");
  });

  it("uses an explicit return path and reports a failed top-up", async () => {
    const { calls } = mockFetch([{ method: "POST", match: "/top-up", respond: { error: "Stripe is down" }, status: 503 }]);
    mount(<WalletCard wallet={{ balanceCents: 0 }} topUps={topUps} topUpsEnabled returnTo="/back" />);
    click(button("Add $10"));
    await flush();
    expect(calls[0].body).toEqual({ topUp: "usd-10", returnTo: "/back" });
    expect(toast.error).toHaveBeenCalledWith("Stripe is down");
    expect(button("Add $10").disabled).toBe(false);
  });

  it("disables top-ups when the site has none", () => {
    mount(<WalletCard wallet={{ balanceCents: 0 }} topUps={topUps} topUpsEnabled={false} />);
    expect(button("Add $10").disabled).toBe(true);
    expect(bodyText()).toContain("Adding money isn't available on this site yet.");
  });
});

describe("FileMarketPanel", () => {
  it("lists files for sale with seller, headings and sales", async () => {
    mockFetch([{ match: "/api/market", respond: board() }]);
    mount(<FileMarketPanel />);
    expect(document.querySelector(".animate-spin")).not.toBeNull();
    await flush();
    expect(bodyText()).toContain("Ada · 12 headings · 3 sold");
    expect(bodyText()).toContain("Bo · 2 headings");
    expect(bodyText()).not.toContain("0 sold");
    expect([...document.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toContain("/research/market/l%202");
    expect(bodyText()).toContain("$12.50");
  });

  it("shows an empty board and a load error", async () => {
    mockFetch([{ match: "/api/market", respond: board({ listings: [] }) }]);
    mount(<FileMarketPanel />);
    await flush();
    expect(bodyText()).toContain("Nothing is for sale yet.");
    cleanup();

    mockFetch([{ match: "/api/market", respond: { error: "D1 is busy" }, status: 503 }]);
    mount(<FileMarketPanel />);
    await flush();
    expect(bodyText()).toBe("D1 is busy");
  });

  it("toasts a cancelled payment and clears ?topup", async () => {
    window.history.replaceState(null, "", "/research/market?topup=cancelled&x=1");
    mockFetch([{ match: "/api/market", respond: board() }]);
    mount(<FileMarketPanel />);
    await flush();
    expect(toast).toHaveBeenCalledWith("Payment cancelled — nothing was charged.");
    expect(window.location.search).toBe("?x=1");
  });

  it("polls the balance after a successful payment", async () => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/research/market?topup=success");
    const { calls } = mockFetch([{ match: "/api/market", respond: board() }]);
    mount(<FileMarketPanel />);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Payment received"));
    const before = calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls.length).toBe(before + 3);
  });
});

describe("ListingView", () => {
  const editorHref = (id: number) => `#doc-${id}`;

  it("shows the preview and buys the file", async () => {
    const { calls } = mockFetch([
      { match: "/listings/l1/purchase", method: "POST", respond: { listing: listing({ owned: true }), wallet: { balanceCents: 750 }, documentId: 42 } },
      { match: "/listings/l1", respond: { listing: listing() } },
      { match: "/api/market", respond: board() },
    ]);
    mount(<ListingView id="l1" editorHref={editorHref} />);
    await flush();
    expect(bodyText()).toContain("Sold by Ada · 3 sold");
    expect(bodyText()).toContain("The preview shows the headings only.");
    click(button("Buy for $5.00"));
    await flush();
    expect(calls.some((c) => c.url.endsWith("/purchase"))).toBe(true);
    expect(toast.success).toHaveBeenCalledWith('Bought "Cap K". Opening it now.');
    expect(window.location.hash).toBe("#doc-42");
    expect(bodyText()).toContain("$7.50");
    expect(bodyText()).toContain("Open a copy in my files");
  });

  it("reports a failed purchase and reloads", async () => {
    const { calls } = mockFetch([
      { match: "/purchase", method: "POST", respond: { error: "Insufficient funds" }, status: 402 },
      { match: "/listings/l1", respond: { listing: listing() } },
      { match: "/api/market", respond: board() },
    ]);
    mount(<ListingView id="l1" editorHref={editorHref} />);
    await flush();
    const loads = calls.filter((c) => c.url.endsWith("/listings/l1")).length;
    click(button("Buy for $5.00"));
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Insufficient funds");
    expect(calls.filter((c) => c.url.endsWith("/listings/l1")).length).toBe(loads + 1);
  });

  it("can't buy with too little in the wallet or once the listing ended", async () => {
    mockFetch([
      { match: "/listings/l1", respond: { listing: listing({ priceCents: 5000, active: false }) } },
      { match: "/api/market", respond: board() },
    ]);
    mount(<ListingView id="l1" editorHref={editorHref} />);
    await flush();
    expect(bodyText()).toContain("no longer for sale");
    expect(bodyText()).toContain("Your wallet has $12.50. Add money to buy this file.");
    expect(button("Buy for $50.00").disabled).toBe(true);
  });

  it("opens a copy of an owned file, staying busy while the editor opens", async () => {
    mockFetch([
      { match: "/listings/l1/copy", method: "POST", respond: { documentId: 9 } },
      { match: "/listings/l1", respond: { listing: listing({ owned: true, isSeller: true, sales: 0 }) } },
      { match: "/api/market", respond: { error: "x" }, status: 500 },
    ]);
    mount(<ListingView id="l1" editorHref={editorHref} />);
    await flush();
    expect(bodyText()).toContain("Sold by Ada");
    expect(bodyText()).not.toContain("The preview shows the headings only.");
    // The board failed to load, so there's no wallet card.
    expect(bodyText()).not.toContain("Your wallet");
    click(button("Open a copy"));
    await flush();
    expect(window.location.hash).toBe("#doc-9");
    expect(button("Open a copy").disabled).toBe(true);
  });

  it("reports a failed copy and re-enables the button", async () => {
    mockFetch([
      { match: "/listings/l1/copy", method: "POST", respond: { error: "Copy failed" }, status: 500 },
      { match: "/listings/l1", respond: { listing: listing({ owned: true }) } },
      { match: "/api/market", respond: board() },
    ]);
    mount(<ListingView id="l1" editorHref={editorHref} />);
    await flush();
    click(button("Open a copy in my files"));
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Copy failed");
    expect(button("Open a copy in my files").disabled).toBe(false);
  });

  it("shows a load error", async () => {
    mockFetch([{ match: "/listings/", respond: { error: "No such file." }, status: 404 }]);
    mount(<ListingView id="zz" editorHref={editorHref} />);
    await flush();
    expect(bodyText()).toBe("No such file.");
  });
});
