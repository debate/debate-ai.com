"use client"

/**
 * @fileoverview Settings → Notifications: unsubscribe from all emails, and
 * enable OS/browser push via the native Tauri wrapper (or the Web Notification
 * API in a regular browser).
 *
 * @module components/settings/sections/NotificationsSettingsSection
 */

import { useCallback, useEffect, useState } from "react"
import { Bell, Mail } from "lucide-react"
import {
  enablePushNotifications,
  getPushNotificationPermission,
  isNativeWrapper,
  type PushPermission,
} from "../../../lib/native/tauri"

interface NotificationSettings {
  email: string
  emailUnsubscribed: boolean
  pushEnabled: boolean | null
}

const boxStyle = {
  marginBottom: 16,
  padding: 14,
  borderRadius: 10,
  border: "1px solid var(--pmd-border, rgba(127, 127, 127, 0.25))",
} as const
const headingStyle = { margin: "0 0 8px", fontSize: 14, fontWeight: 600 } as const
const hintStyle = { margin: "0 0 10px", fontSize: 12, opacity: 0.65 } as const
const buttonStyle = {
  padding: "6px 14px",
  borderRadius: 8,
  border: "none",
  background: "#24A0ED",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
} as const
const secondaryButtonStyle = {
  ...buttonStyle,
  background: "transparent",
  color: "inherit",
  border: "1px solid rgba(127, 127, 127, 0.35)",
} as const

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? `Request failed (${res.status})`
}

/**
 * Email opt-out and push enablement for Settings → Notifications.
 */
export function NotificationsSettingsSection({ signedIn }: { signedIn: boolean }) {
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [permission, setPermission] = useState<PushPermission>("unsupported")
  const [loading, setLoading] = useState(signedIn)
  const [busy, setBusy] = useState<"email" | "push" | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!signedIn) {
      setSettings(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/settings/notifications")
      if (!res.ok) throw new Error(await readError(res))
      const body = (await res.json()) as { notifications: NotificationSettings }
      setSettings(body.notifications)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notification settings.")
    } finally {
      setLoading(false)
    }
  }, [signedIn])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    void getPushNotificationPermission().then(setPermission)
  }, [])

  const save = async (patch: { emailUnsubscribed?: boolean; pushEnabled?: boolean }) => {
    setError(null)
    setMessage(null)
    const res = await fetch("/api/settings/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error(await readError(res))
    const body = (await res.json()) as { notifications: NotificationSettings }
    setSettings(body.notifications)
  }

  const toggleEmail = async (unsubscribe: boolean) => {
    setBusy("email")
    try {
      await save({ emailUnsubscribed: unsubscribe })
      setMessage(
        unsubscribe
          ? "Unsubscribed from all Debate AI emails."
          : "You will receive Debate AI emails again.",
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update email preference.")
    } finally {
      setBusy(null)
    }
  }

  const enablePush = async () => {
    setBusy("push")
    setError(null)
    setMessage(null)
    try {
      const result = await enablePushNotifications({
        title: "Debate AI notifications on",
        body: isNativeWrapper()
          ? "You will get alerts in the Debate AI app."
          : "You will get alerts in this browser when Debate AI sends them.",
      })
      setPermission(result.permission)
      if (result.permission !== "granted") {
        setError(
          result.permission === "denied"
            ? "Notification permission was denied. Allow it in your system or browser settings, then try again."
            : "Notifications are not available in this environment.",
        )
        await save({ pushEnabled: false }).catch(() => undefined)
        return
      }
      await save({ pushEnabled: true })
      setMessage(
        isNativeWrapper()
          ? "Push notifications enabled in the native app."
          : "Browser notifications enabled.",
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable push notifications.")
    } finally {
      setBusy(null)
    }
  }

  const disablePush = async () => {
    setBusy("push")
    try {
      await save({ pushEnabled: false })
      setMessage("Push notifications turned off for this account.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update push preference.")
    } finally {
      setBusy(null)
    }
  }

  if (!signedIn) {
    return (
      <p className="text-sm text-muted-foreground">
        Sign in to manage email unsubscribe and push notifications.
      </p>
    )
  }

  if (loading && !settings) {
    return <p className="text-sm text-muted-foreground">Loading notification settings…</p>
  }

  return (
    <div>
      <section style={boxStyle} aria-labelledby="settings-email-notifications-heading">
        <h4 id="settings-email-notifications-heading" style={headingStyle} className="flex items-center gap-2">
          <Mail className="h-4 w-4" aria-hidden />
          Email
        </h4>
        <p style={hintStyle}>
          Every Debate AI email includes an Unsubscribe link. Opting out stops all mail to{" "}
          <strong>{settings?.email ?? "your address"}</strong> (sign-in links still work).
        </p>
        {settings?.emailUnsubscribed ? (
          <button
            type="button"
            style={buttonStyle}
            disabled={busy === "email"}
            onClick={() => void toggleEmail(false)}
          >
            {busy === "email" ? "Saving…" : "Resubscribe to emails"}
          </button>
        ) : (
          <button
            type="button"
            style={secondaryButtonStyle}
            disabled={busy === "email"}
            onClick={() => void toggleEmail(true)}
          >
            {busy === "email" ? "Saving…" : "Unsubscribe from all emails"}
          </button>
        )}
      </section>

      <section style={boxStyle} aria-labelledby="settings-push-notifications-heading">
        <h4 id="settings-push-notifications-heading" style={headingStyle} className="flex items-center gap-2">
          <Bell className="h-4 w-4" aria-hidden />
          Push notifications
        </h4>
        <p style={hintStyle}>
          {isNativeWrapper()
            ? "Uses the native Debate AI (Tauri) notification system on this device."
            : "Uses this browser’s notification permission. In the Debate AI desktop or mobile app, the same button uses the native Tauri notification system."}
          {permission !== "unsupported" ? ` Permission: ${permission}.` : null}
        </p>
        {settings?.pushEnabled ? (
          <button
            type="button"
            style={secondaryButtonStyle}
            disabled={busy === "push"}
            onClick={() => void disablePush()}
          >
            {busy === "push" ? "Saving…" : "Turn off push notifications"}
          </button>
        ) : (
          <button type="button" style={buttonStyle} disabled={busy === "push"} onClick={() => void enablePush()}>
            {busy === "push" ? "Enabling…" : "Enable push notifications"}
          </button>
        )}
      </section>

      {message && <p className="mb-2 text-sm text-muted-foreground">{message}</p>}
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}
