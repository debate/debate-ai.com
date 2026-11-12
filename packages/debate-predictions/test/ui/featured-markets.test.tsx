// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `FeaturedMarkets`: division picker, top-teams
 * and major-tournament sections, empty states and sorting.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { FeaturedMarkets } from "../../src/ui/FeaturedMarkets"
import { bodyText, button, cleanup, mount } from "../helpers/dom"
import type { PredictionMarket, PredictionWallet } from "../../src/types"

const wallet: PredictionWallet | null = { balance: 1000, grantedAt: 0 }

const market = (over: Partial<PredictionMarket> = {}): PredictionMarket => ({
  id: "m1",
  title: "Test market",
  kind: "debate",
  status: "open",
  closesAt: Date.now() / 1000 + 3600,
  description: "",
  createdAt: 0,
  creator: null,
  resolvedAt: null,
  preset: null,
  volume: 0,
  liquidity: 100,
  outcomes: [{ id: "o1", label: "Aff", price: 0.5, shares: 0 }],
  positions: [],
  canResolve: false,
  resolvedOutcome: null,
  payout: null,
  resolutionNote: null,
  source: { type: "manual" },
  ...over,
})

const section = ({ title, icon, description, action, children }: any) => (
  <div>
    <h2>{title}</h2>
    {children}
  </div>
)

describe("FeaturedMarkets", () => {
  afterEach(cleanup)

  it("renders the division picker with all divisions", () => {
    mount(
      <FeaturedMarkets
        markets={[]}
        wallet={wallet}
        now={Date.now() / 1000}
        division="hspf"
        onDivisionChange={vi.fn()}
        onChanged={vi.fn()}
        section={section}
      />,
    )
    expect(bodyText()).toContain("Top 5 teams")
    expect(bodyText()).toContain("No Public Forum rankings to open these from yet.")
  })

  it("calls onDivisionChange when a division is clicked", () => {
    const onDivisionChange = vi.fn()
    mount(
      <FeaturedMarkets
        markets={[]}
        wallet={wallet}
        now={Date.now() / 1000}
        division="hspf"
        onDivisionChange={onDivisionChange}
        onChanged={vi.fn()}
        section={section}
      />,
    )
    button("Policy").click()
    expect(onDivisionChange).toHaveBeenCalledWith("hscx")
  })

  it("sorts top-teams by price descending", () => {
    const markets = [
      market({ id: "m1", preset: { group: "top-teams", dataset: "hspf", tournament: null }, outcomes: [{ id: "o1", label: "A", price: 0.3, shares: 0 }] }),
      market({ id: "m2", preset: { group: "top-teams", dataset: "hspf", tournament: null }, outcomes: [{ id: "o2", label: "B", price: 0.7, shares: 0 }] }),
    ]
    mount(
      <FeaturedMarkets
        markets={markets}
        wallet={wallet}
        now={Date.now() / 1000}
        division="hspf"
        onDivisionChange={vi.fn()}
        onChanged={vi.fn()}
        section={section}
      />,
    )
    const cards = document.querySelectorAll("article")
    expect(cards[0].textContent).toContain("B")
    expect(cards[1].textContent).toContain("A")
  })

  it("sorts majors by close time then tournament order", () => {
    const markets = [
      market({
        id: "m1",
        title: "m1",
        preset: { group: "majors", dataset: "hspf", tournament: "toc" },
        closesAt: Date.now() / 1000 + 7200,
      }),
      market({
        id: "m2",
        title: "m2",
        preset: { group: "majors", dataset: "hspf", tournament: "harvard" },
        closesAt: Date.now() / 1000 + 3600,
      }),
    ]
    mount(
      <FeaturedMarkets
        markets={markets}
        wallet={wallet}
        now={Date.now() / 1000}
        division="hspf"
        onDivisionChange={vi.fn()}
        onChanged={vi.fn()}
        section={section}
      />,
    )
    const cards = document.querySelectorAll("article")
    expect(cards[0].textContent).toContain("m2")
    expect(cards[1].textContent).toContain("m1")
  })

  it("shows empty state for majors when none", () => {
    mount(
      <FeaturedMarkets
        markets={[]}
        wallet={wallet}
        now={Date.now() / 1000}
        division="hspf"
        onDivisionChange={vi.fn()}
        onChanged={vi.fn()}
        section={section}
      />,
    )
    expect(bodyText()).toContain("No Public Forum majors left this season.")
  })
})