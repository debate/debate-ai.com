// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `ForumLikeButton`: optimistic toggling, the
 * signed-out state, error rollback and the `onChange` callback.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { ForumLikeButton } from "../../src/forums/ui/ForumLikeButton"
import { cleanup, click, mount } from "../helpers/mount"

const mockToggle = vi.fn()

vi.mock("../../src/forums/client", () => ({
  toggleForumThreadLike: () => mockToggle(),
}))

describe("ForumLikeButton", () => {
  afterEach(() => {
    cleanup()
    mockToggle.mockReset()
  })

  it("renders the count and starts unlike-pressed", async () => {
    const { container } = await mount(
      <ForumLikeButton threadId="t1" likeCount={5} viewerHasLiked={true} canLike={true} />,
    )
    const button = container.querySelector("button")!
    expect(button.getAttribute("aria-pressed")).toBe("true")
    expect(button.textContent).toContain("5")
  })

  it("toggles optimisticly on click", async () => {
    mockToggle.mockResolvedValueOnce({ liked: false, likeCount: 4 })
    const onChange = vi.fn()
    const { container } = await mount(
      <ForumLikeButton
        threadId="t1"
        likeCount={5}
        viewerHasLiked={true}
        canLike={true}
        onChange={onChange}
      />,
    )
    await click(container.querySelector("button")!)
    expect(container.querySelector("button")!.getAttribute("aria-pressed")).toBe("false")
    expect(container.querySelector("button")!.textContent).toContain("4")
    expect(onChange).toHaveBeenCalledWith({ liked: false, likeCount: 4 })
  })

  it("rolls back on error", async () => {
    mockToggle.mockRejectedValueOnce(new Error("Network error"))
    const { container } = await mount(
      <ForumLikeButton threadId="t1" likeCount={5} viewerHasLiked={true} canLike={true} />,
    )
    await click(container.querySelector("button")!)
    expect(container.querySelector("button")!.getAttribute("aria-pressed")).toBe("true")
    expect(container.querySelector("button")!.textContent).toContain("5")
    expect(container.querySelector("button")!.getAttribute("title")).toBe("Network error")
  })

  it("shows a sign-in message when signed out", async () => {
    const { container } = await mount(
      <ForumLikeButton threadId="t1" likeCount={5} viewerHasLiked={false} canLike={false} />,
    )
    await click(container.querySelector("button")!)
    expect(container.querySelector("button")!.getAttribute("title")).toBe("Sign in to like threads.")
    expect(mockToggle).not.toHaveBeenCalled()
  })
})