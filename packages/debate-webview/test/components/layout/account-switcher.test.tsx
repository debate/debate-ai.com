/**
 * @vitest-environment jsdom
 *
 * @fileoverview The account menu's Switch account rows (better-auth
 * multiSession): which accounts they list, that picking one switches and
 * reloads, that the X signs out just that account, that signing out of the
 * active one reloads into the next, and the five-account limit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useEffect } from "react"

const multiSession = vi.hoisted(() => ({
  listDeviceSessions: vi.fn(),
  setActive: vi.fn(),
  revoke: vi.fn(),
}))
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
const resetUser = vi.hoisted(() => vi.fn())

vi.mock("../../../src/lib/auth/client", () => ({ authClient: { multiSession } }))
vi.mock("sonner", () => ({ toast }))
vi.mock("../../../src/lib/analytics/mixpanel", () => ({ resetUser }))

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../../../src/ui/primitives/dropdown-menu"
import {
  AccountSwitcherItems,
  MAX_SIGNED_IN_ACCOUNTS,
  useDeviceAccounts,
  type DeviceAccount,
} from "../../../src/components/layout/app-sidebar/account-switcher"
import { reloadPage } from "../../../src/lib/auth/use-close-on-new-account"
import { bodyText, byText, cleanup, flush, installDomShims, mount } from "../../helpers/dom"

const account = (n: number): DeviceAccount => ({
  sessionToken: `tok-${n}`,
  userId: `user-${n}`,
  name: `Debater ${n}`,
  email: `d${n}@example.com`,
  image: null,
})

function renderItems(props: Partial<Parameters<typeof AccountSwitcherItems>[0]> = {}) {
  const onChanged = vi.fn()
  const onAddAccount = vi.fn()
  mount(
    <DropdownMenu open>
      <DropdownMenuTrigger>menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <AccountSwitcherItems
          itemClassName=""
          currentUserId="user-1"
          accounts={[account(1), account(2)]}
          onChanged={onChanged}
          onAddAccount={onAddAccount}
          {...props}
        />
      </DropdownMenuContent>
    </DropdownMenu>,
  )
  return { onChanged, onAddAccount }
}

/** Radix menu items select on click in jsdom. */
const item = (text: string) => byText(text, "[role=menuitem]")

let reload: ReturnType<typeof vi.fn>

beforeEach(() => {
  installDomShims()
  reload = vi.fn()
  reloadPage.current = reload as unknown as () => void
  for (const fn of [...Object.values(multiSession), toast.error, toast.success, resetUser]) fn.mockReset()
})

afterEach(cleanup)

describe("AccountSwitcherItems", () => {
  it("lists the active account first and the others after it", () => {
    renderItems({ accounts: [account(2), account(1)] })
    const text = bodyText()
    expect(text).toContain("Accounts signed in on this browser")
    expect(text.indexOf("Debater 1")).toBeLessThan(text.indexOf("Debater 2"))
    expect(text).toContain("Add another account")
    expect(text).toContain("Sign out of Debater 1")
  })

  it("shows a loading row before the list arrives", () => {
    renderItems({ accounts: null })
    expect(bodyText()).toContain("Loading…")
    expect(bodyText()).not.toContain("Sign out of")
  })

  it("switches to another account and reloads as it", async () => {
    multiSession.setActive.mockResolvedValue({ data: {}, error: null })
    renderItems()
    item("Debater 2").click()
    await flush()
    expect(multiSession.setActive).toHaveBeenCalledWith({ sessionToken: "tok-2" })
    expect(resetUser).toHaveBeenCalled()
    expect(reload).toHaveBeenCalled()
  })

  it("stays put and refreshes the list when a switch fails", async () => {
    multiSession.setActive.mockResolvedValue({ data: null, error: { message: "gone" } })
    const { onChanged } = renderItems()
    item("Debater 2").click()
    await flush()
    expect(reload).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith("Could not switch to Debater 2")
    expect(onChanged).toHaveBeenCalled()
  })

  it("signs out just an inactive account with its X, without reloading", async () => {
    multiSession.revoke.mockResolvedValue({ data: { status: true }, error: null })
    const { onChanged } = renderItems()
    ;(document.querySelector('[aria-label="Sign out of Debater 2"]') as HTMLButtonElement).click()
    await flush()
    expect(multiSession.revoke).toHaveBeenCalledWith({ sessionToken: "tok-2" })
    expect(multiSession.setActive).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith("Signed out of Debater 2")
    expect(onChanged).toHaveBeenCalled()
  })

  it("reports a failed sign-out of one account", async () => {
    multiSession.revoke.mockResolvedValue({ data: null, error: { message: "no" } })
    renderItems()
    ;(document.querySelector('[aria-label="Sign out of Debater 2"]') as HTMLButtonElement).click()
    await flush()
    expect(toast.error).toHaveBeenCalledWith("Could not sign out of Debater 2")
  })

  it("signing out of the active account reloads into the next one", async () => {
    multiSession.revoke.mockResolvedValue({ data: { status: true }, error: null })
    renderItems()
    item("Sign out of Debater 1").click()
    await flush()
    expect(multiSession.revoke).toHaveBeenCalledWith({ sessionToken: "tok-1" })
    expect(reload).toHaveBeenCalled()
  })

  it("offers Add another account below the limit", () => {
    const { onAddAccount } = renderItems()
    item("Add another account").click()
    expect(onAddAccount).toHaveBeenCalled()
  })

  it("hides Add another account at the limit", () => {
    const accounts = Array.from({ length: MAX_SIGNED_IN_ACCOUNTS }, (_, i) => account(i + 1))
    renderItems({ accounts })
    expect(bodyText()).not.toContain("Add another account")
    expect(bodyText()).toContain(`Up to ${MAX_SIGNED_IN_ACCOUNTS} accounts at once`)
  })

  it("has no Sign out of <name> row with only one account", () => {
    renderItems({ accounts: [account(1)] })
    expect(bodyText()).not.toContain("Sign out of")
  })
})

describe("useDeviceAccounts", () => {
  function Probe({ enabled, onAccounts }: { enabled: boolean; onAccounts: (a: DeviceAccount[] | null) => void }) {
    const { accounts } = useDeviceAccounts(enabled)
    useEffect(() => onAccounts(accounts), [accounts, onAccounts])
    return null
  }

  it("fetches only while enabled and leaves out guest sessions", async () => {
    multiSession.listDeviceSessions.mockResolvedValue({
      data: [
        { session: { token: "a" }, user: { id: "u1", name: "Ana", email: "ana@example.com", image: "pic.png" } },
        { session: { token: "g" }, user: { id: "guest", name: "Anonymous", isAnonymous: true } },
        { session: { token: "b" }, user: { id: "u2", name: "", email: "bo@example.com" } },
      ],
      error: null,
    })
    const seen = vi.fn()
    const view = mount(<Probe enabled={false} onAccounts={seen} />)
    await flush()
    expect(multiSession.listDeviceSessions).not.toHaveBeenCalled()

    view.rerender(<Probe enabled onAccounts={seen} />)
    await flush()
    const accounts = seen.mock.calls.at(-1)![0] as DeviceAccount[]
    expect(accounts.map((a) => a.userId)).toEqual(["u1", "u2"])
    expect(accounts[0]).toMatchObject({ sessionToken: "a", name: "Ana", image: "pic.png" })
    expect(accounts[1]!.email).toBe("bo@example.com")
    expect(accounts[1]!.name).not.toBe("")
  })

  it("keeps the last list when the lookup fails", async () => {
    multiSession.listDeviceSessions.mockResolvedValue({ data: null, error: { message: "down" } })
    const seen = vi.fn()
    mount(<Probe enabled onAccounts={seen} />)
    await flush()
    expect(seen.mock.calls.at(-1)![0]).toBeNull()
  })
})
