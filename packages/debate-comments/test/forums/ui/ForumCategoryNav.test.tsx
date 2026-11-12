// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `ForumCategoryNav`: category pills and sort
 * buttons call their handlers with the right values.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { ForumCategoryNav } from "../../../src/forums/ui/ForumCategoryNav"
import { FORUM_CATEGORIES } from "../../../src/forums/types"
import { cleanup, mount } from "../../helpers/mount"

describe("ForumCategoryNav", () => {
  afterEach(cleanup)

  it("renders all categories plus All", async () => {
    const { container } = await mount(
      <ForumCategoryNav
        category={null}
        sort="active"
        onCategoryChange={vi.fn()}
        onSortChange={vi.fn()}
      />,
    )
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("nav button"))
    expect(buttons.map((b) => b.textContent)).toEqual(["All", ...FORUM_CATEGORIES.map((entry) => entry.label)])
  })

  it("highlights the active category", async () => {
    const { container } = await mount(
      <ForumCategoryNav
        category="policy"
        sort="active"
        onCategoryChange={vi.fn()}
        onSortChange={vi.fn()}
      />,
    )
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("nav button"))
    expect(buttons[0].getAttribute("aria-pressed")).toBe("false")
    const policy = buttons.find((b) => b.textContent === "Policy")!
    expect(policy.getAttribute("aria-pressed")).toBe("true")
  })

  it("calls onCategoryChange with null for All", async () => {
    const onCategoryChange = vi.fn()
    const { container } = await mount(
      <ForumCategoryNav
        category="policy"
        sort="active"
        onCategoryChange={onCategoryChange}
        onSortChange={vi.fn()}
      />,
    )
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("nav button"))
    buttons[0].click()
    expect(onCategoryChange).toHaveBeenCalledWith(null)
  })

  it("calls onCategoryChange with the category id", async () => {
    const onCategoryChange = vi.fn()
    const { container } = await mount(
      <ForumCategoryNav
        category={null}
        sort="active"
        onCategoryChange={onCategoryChange}
        onSortChange={vi.fn()}
      />,
    )
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("nav button"))
    buttons[1].click()
    expect(onCategoryChange).toHaveBeenCalledWith(FORUM_CATEGORIES[0].id)
  })

  it("renders sort options", async () => {
    const { container } = await mount(
      <ForumCategoryNav
        category={null}
        sort="active"
        onCategoryChange={vi.fn()}
        onSortChange={vi.fn()}
      />,
    )
    const sortButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="group"] button'))
    expect(sortButtons.map((b) => b.textContent)).toEqual(["Recent activity", "New", "Top"])
  })

  it("calls onSortChange with the selected sort", async () => {
    const onSortChange = vi.fn()
    const { container } = await mount(
      <ForumCategoryNav
        category={null}
        sort="active"
        onCategoryChange={vi.fn()}
        onSortChange={onSortChange}
      />,
    )
    const sortButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="group"] button'))
    sortButtons[1].click()
    expect(onSortChange).toHaveBeenCalledWith("new")
  })
})