/** @vitest-environment jsdom */
/**
 * @fileoverview A videos page registers its category state into the shared
 * dock; the dock reads it back, follows changes, and clears it on unmount.
 */

import { describe, expect, it, vi } from "vitest"
import { CategoryDockProvider, useCategoryDock, useCategoryDockState } from "../src/context/category-dock-context"
import type { CategoryType } from "../src/types/videos"
import { mount } from "./helpers/mount"

let dockState: ReturnType<typeof useCategoryDockState> = null

function Dock() {
  dockState = useCategoryDockState()
  return <span>{dockState?.currentCategory ?? "none"}</span>
}

function Page({ category, onChange }: { category: CategoryType; onChange: (c: CategoryType) => void }) {
  useCategoryDock(category, onChange)
  return null
}

describe("category dock", () => {
  it("is empty until a page registers, and outside a provider", async () => {
    const outside = await mount(<Dock />)
    expect(dockState).toBeNull()
    await outside.unmount()
  })

  it("shows the registered category, follows changes, and clears on unmount", async () => {
    const onChange = vi.fn()
    const mounted = await mount(
      <CategoryDockProvider>
        <Dock />
        <Page category={"rounds" as CategoryType} onChange={onChange} />
      </CategoryDockProvider>,
    )
    expect(mounted.container.textContent).toBe("rounds")
    dockState?.onCategoryChange("lectures" as CategoryType)
    expect(onChange).toHaveBeenCalledWith("lectures")

    await mounted.rerender(
      <CategoryDockProvider>
        <Dock />
        <Page category={"lectures" as CategoryType} onChange={onChange} />
      </CategoryDockProvider>,
    )
    expect(mounted.container.textContent).toBe("lectures")

    await mounted.rerender(
      <CategoryDockProvider>
        <Dock />
      </CategoryDockProvider>,
    )
    expect(mounted.container.textContent).toBe("none")
    await mounted.unmount()
  })

  it("makes register a no-op without a provider", async () => {
    const mounted = await mount(<Page category={"rounds" as CategoryType} onChange={() => {}} />)
    await mounted.unmount()
  })
})
