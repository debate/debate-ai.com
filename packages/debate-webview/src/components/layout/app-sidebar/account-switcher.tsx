"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Loader2, LogOut, UserPlus, Users, X } from "lucide-react"
import { toast } from "sonner"

import { authClient } from "../../../lib/auth/client"
import { reloadPage } from "../../../lib/auth/use-close-on-new-account"
import { resetUser } from "../../../lib/analytics/mixpanel"
import { accountLabel } from "../../../lib/nav/account-label"
import { Avatar, AvatarFallback, AvatarImage } from "../../../ui/primitives/avatar"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "../../../ui/primitives/dropdown-menu"
import { cn } from "../../../ui/lib/utils"

/**
 * How many accounts one browser can hold. Mirrors `MAXIMUM_SESSIONS` in
 * apps/debate-web/lib/auth/multi-session.ts; past it the server signs the new
 * account in but leaves it out of the switcher, so "Add another account" is
 * hidden instead.
 */
export const MAX_SIGNED_IN_ACCOUNTS = 5

export interface DeviceAccount {
  sessionToken: string
  userId: string
  name: string
  email: string | null
  image: string | null
}

type DeviceSessionRow = {
  session: { token: string }
  user: { id: string; name?: string | null; email?: string | null; image?: string | null; isAnonymous?: boolean | null }
}

/**
 * The accounts signed in on this browser (better-auth's multiSession plugin),
 * fetched while `enabled` — the account menu passes whether it is open, so the
 * list is fresh each time it opens and never fetched otherwise. Guest
 * (anonymous) sessions are left out: they are not accounts anyone switches to.
 */
export function useDeviceAccounts(enabled: boolean) {
  const [accounts, setAccounts] = useState<DeviceAccount[] | null>(null)

  const refresh = useCallback(async () => {
    const { data, error } = await authClient.multiSession.listDeviceSessions()
    if (error || !Array.isArray(data)) return
    setAccounts(
      (data as DeviceSessionRow[])
        .filter((row) => !row.user.isAnonymous)
        .map((row) => ({
          sessionToken: row.session.token,
          userId: row.user.id,
          name: accountLabel({ name: row.user.name, email: row.user.email }),
          email: row.user.email ?? null,
          image: row.user.image ?? null,
        })),
    )
  }, [])

  useEffect(() => {
    if (enabled) void refresh()
  }, [enabled, refresh])

  return { accounts, refresh }
}

/**
 * Every client store (organizations, My Files, contacts, analytics identity)
 * is keyed to the account that loaded it, so a switch reloads the page rather
 * than chasing each one — switching is rare and a reload can't leave the
 * previous account's data on screen.
 */
function reloadAsNewAccount() {
  resetUser()
  reloadPage.current()
}

function AccountAvatar({ image, name }: { image: string | null; name: string }) {
  return (
    <Avatar className="size-6 rounded-md">
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback className="rounded-md text-[10px]">{(name[0] ?? "?").toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

/**
 * The account menu's Switch account submenu: each account signed in on this
 * browser, the active one checked. Picking another makes it active; the X
 * beside an inactive one signs just that account out. Below them, "Add
 * another account" (the sign-in dialog, opened by `NavUser` so it outlives the
 * dropdown) and, with more than one account, "Sign out of <name>" for the
 * active one, which hands the browser to the next account instead of signing
 * everyone out.
 */
export function AccountSwitcherSubmenu(props: AccountSwitcherProps) {
  const { itemClassName, accounts } = props
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={itemClassName}>
        <Users />
        Switch account
        {accounts && accounts.length > 1 ? (
          <span className="ml-auto text-xs text-muted-foreground">{accounts.length}</span>
        ) : null}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-[min(28rem,var(--radix-dropdown-menu-content-available-height))] w-72 overflow-y-auto rounded-lg">
        <AccountSwitcherItems {...props} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

export interface AccountSwitcherProps {
  itemClassName: string
  currentUserId: string
  accounts: DeviceAccount[] | null
  onChanged: () => void
  onAddAccount: () => void
}

/** The submenu's rows, on their own so they can render inside any open menu. */
export function AccountSwitcherItems({
  itemClassName,
  currentUserId,
  accounts,
  onChanged,
  onAddAccount,
}: AccountSwitcherProps) {
  const [busy, setBusy] = useState<string | null>(null)
  const current = accounts?.find((account) => account.userId === currentUserId) ?? null
  const others = accounts?.filter((account) => account.userId !== currentUserId) ?? []
  const canAdd = !accounts || accounts.length < MAX_SIGNED_IN_ACCOUNTS

  async function switchTo(account: DeviceAccount) {
    setBusy(account.sessionToken)
    const { error } = await authClient.multiSession.setActive({ sessionToken: account.sessionToken })
    if (error) {
      setBusy(null)
      toast.error(`Could not switch to ${account.name}`)
      onChanged()
      return
    }
    reloadAsNewAccount()
  }

  async function signOutOf(account: DeviceAccount, isCurrent: boolean) {
    setBusy(account.sessionToken)
    const { error } = await authClient.multiSession.revoke({ sessionToken: account.sessionToken })
    if (error) {
      setBusy(null)
      toast.error(`Could not sign out of ${account.name}`)
      return
    }
    // Ending the active account makes the next one active on the server.
    if (isCurrent) return reloadAsNewAccount()
    setBusy(null)
    toast.success(`Signed out of ${account.name}`)
    onChanged()
  }

  return (
    <>
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Accounts signed in on this browser
        </DropdownMenuLabel>
        {!accounts ? (
          <DropdownMenuItem className={itemClassName} disabled>
            <Loader2 className="animate-spin" />
            Loading…
          </DropdownMenuItem>
        ) : null}
        {current ? (
          <DropdownMenuItem className={cn(itemClassName, "bg-accent/60")} onSelect={(e) => e.preventDefault()}>
            <AccountAvatar image={current.image} name={current.name} />
            <AccountText account={current} />
            <Check className="ml-auto !text-foreground" />
          </DropdownMenuItem>
        ) : null}
        {others.map((account) => (
          <DropdownMenuItem
            key={account.sessionToken}
            className={itemClassName}
            disabled={busy !== null}
            onSelect={(e) => {
              e.preventDefault()
              void switchTo(account)
            }}
          >
            <AccountAvatar image={account.image} name={account.name} />
            <AccountText account={account} />
            {busy === account.sessionToken ? (
              <Loader2 className="ml-auto animate-spin" />
            ) : (
              <button
                type="button"
                aria-label={`Sign out of ${account.name}`}
                title="Sign out of this account"
                className="ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  void signOutOf(account, false)
                }}
              >
                <X className="size-3.5" />
              </button>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {canAdd ? (
          <DropdownMenuItem className={itemClassName} onSelect={onAddAccount}>
            <UserPlus />
            Add another account
          </DropdownMenuItem>
        ) : (
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {`Up to ${MAX_SIGNED_IN_ACCOUNTS} accounts at once. Sign one out to add another.`}
          </DropdownMenuLabel>
        )}
        {current && others.length > 0 ? (
          <DropdownMenuItem
            className={itemClassName}
            disabled={busy !== null}
            onSelect={(e) => {
              e.preventDefault()
              void signOutOf(current, true)
            }}
          >
            {busy === current.sessionToken ? <Loader2 className="animate-spin" /> : <LogOut />}
            <span className="truncate">Sign out of {current.name}</span>
          </DropdownMenuItem>
        ) : null}
    </>
  )
}

function AccountText({ account }: { account: DeviceAccount }) {
  return (
    <span className="grid min-w-0 flex-1 leading-tight">
      <span className="truncate text-sm">{account.name}</span>
      {account.email ? <span className="truncate text-xs text-muted-foreground">{account.email}</span> : null}
    </span>
  )
}
