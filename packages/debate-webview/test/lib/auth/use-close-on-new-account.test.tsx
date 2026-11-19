/**
 * @vitest-environment jsdom
 *
 * @fileoverview "Add another account" keeps the sign-in dialog open over the
 * current session and closes it, with a reload, only once a different
 * account signs in.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { reloadPage, useCloseOnNewAccount } from "../../../src/lib/auth/use-close-on-new-account"
import { cleanup, mount } from "../../helpers/dom"

type Props = { enabled?: boolean; open?: boolean; userId: string | null; onOpenChange: (open: boolean) => void }

function Probe({ enabled = true, open = true, userId, onOpenChange }: Props) {
  useCloseOnNewAccount({ enabled, open, userId, onOpenChange })
  return null
}

let reload: ReturnType<typeof vi.fn>

beforeEach(() => {
  reload = vi.fn()
  reloadPage.current = reload as unknown as () => void
})
afterEach(cleanup)

describe("useCloseOnNewAccount", () => {
  it("stays open while the same account is signed in", () => {
    const onOpenChange = vi.fn()
    const view = mount(<Probe userId="a" onOpenChange={onOpenChange} />)
    view.rerender(<Probe userId="a" onOpenChange={onOpenChange} />)
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it("closes and reloads once a different account lands", () => {
    const onOpenChange = vi.fn()
    const view = mount(<Probe userId="a" onOpenChange={onOpenChange} />)
    view.rerender(<Probe userId="b" onOpenChange={onOpenChange} />)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("waits for a session before remembering who opened it", () => {
    const onOpenChange = vi.fn()
    const view = mount(<Probe userId={null} onOpenChange={onOpenChange} />)
    view.rerender(<Probe userId="a" onOpenChange={onOpenChange} />)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("forgets the account when closed, so reopening as another one doesn't reload", () => {
    const onOpenChange = vi.fn()
    const view = mount(<Probe userId="a" onOpenChange={onOpenChange} />)
    view.rerender(<Probe open={false} userId="a" onOpenChange={onOpenChange} />)
    view.rerender(<Probe open={false} userId="b" onOpenChange={onOpenChange} />)
    view.rerender(<Probe userId="b" onOpenChange={onOpenChange} />)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("does nothing when not adding an account", () => {
    const onOpenChange = vi.fn()
    const view = mount(<Probe enabled={false} userId="a" onOpenChange={onOpenChange} />)
    view.rerender(<Probe enabled={false} userId="b" onOpenChange={onOpenChange} />)
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
