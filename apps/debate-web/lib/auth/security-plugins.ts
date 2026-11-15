/**
 * @fileoverview Passkeys and two-factor authentication for Settings → Debate
 * Account (packages/debate-webview's AccountSecuritySection).
 *
 * - **Passkeys** (`@better-auth/passkey`). A WebAuthn relying party is one
 *   domain, but this Worker answers on several (debate-ai.com, ebate.app,
 *   preview hosts, localhost — ./hosts). The plugin's own default, when
 *   `baseURL` is the per-request `{ allowedHosts }` object ./index uses, is
 *   `rpID: "localhost"`, which no deployed page can satisfy. So the relying
 *   party is derived from the request instead — {@link relyingPartyFor} — and
 *   ./index builds one auth instance per allowlisted origin for the passkey
 *   routes (`getAuthForRequest`).
 * - **Two-factor** (`better-auth/plugins` `twoFactor`): TOTP from an
 *   authenticator app plus one-time backup codes. The app has no passwords
 *   (Google/Discord/LinkedIn, magic link, One Tap), so the plugin runs
 *   `allowPasswordless`, and because its own sign-in check only covers the
 *   password sign-in routes, {@link passwordlessTwoFactorGate} applies the
 *   same check to the routes this app actually signs people in through.
 *   Passkey sign-in is not gated: a passkey is already a second factor
 *   (the device, plus its biometric or PIN).
 */
import { passkey } from "@better-auth/passkey"
import { twoFactor } from "better-auth/plugins"
import { createAuthMiddleware, freshSessionMiddleware } from "better-auth/api"
import { deleteSessionCookie, expireCookie } from "better-auth/cookies"
import { generateRandomString } from "better-auth/crypto"
import type { BetterAuthPlugin } from "better-auth"

/** Where a sign-in that still needs its second factor is sent (packages/debate-webview routes/login/two-factor). */
export const TWO_FACTOR_PAGE = "/login/two-factor"

/** better-auth's cookie names for the pending second factor and a remembered device (two-factor/constant). */
const TWO_FACTOR_COOKIE_NAME = "two_factor"
const TRUST_DEVICE_COOKIE_NAME = "trust_device"
/** How long a "trust this device" tick skips the code: 30 days, the plugin's default. */
export const TRUST_DEVICE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
/** How long the code page has before the pending sign-in expires. */
const TWO_FACTOR_COOKIE_MAX_AGE_SECONDS = 10 * 60

/**
 * The routes this app signs people in through, which the two-factor plugin's
 * own after-hook (password sign-in only) does not cover.
 */
export const PASSWORDLESS_SIGN_IN_PATHS: ReadonlySet<string> = new Set([
  "/callback/:id",
  "/oauth2/callback/:providerId",
  "/magic-link/verify",
  "/one-tap/callback",
])

/** Settings actions that change the second factor itself; they need a recent sign-in. */
export const TWO_FACTOR_CHANGE_PATHS: ReadonlySet<string> = new Set([
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/generate-backup-codes",
])

export interface RelyingParty {
  /** The WebAuthn relying party id: the request's hostname, without a leading `www.`. */
  rpID: string
  /** The exact origin ceremonies must come from. */
  origin: string
}

/**
 * The relying party for a page served at `url`. `www.` is dropped so a passkey
 * made on www.debate-ai.com also works on debate-ai.com (an rpID may be any
 * registrable suffix of the page's host). The origin stays exact: the request
 * host is allowlisted before this is called, and the Host header — not
 * `x-forwarded-host` (./index sets `trustedProxyHeaders: false`) — is what
 * Cloudflare routed on.
 */
export function relyingPartyFor(url: string | URL): RelyingParty {
  const parsed = typeof url === "string" ? new URL(url) : url
  return {
    rpID: parsed.hostname.replace(/^www\./i, ""),
    origin: parsed.origin,
  }
}

/** The Location of a redirect the endpoint answered with, if it did. */
export function redirectLocation(returned: unknown): string | null {
  const headers = (returned as { headers?: unknown } | null | undefined)?.headers
  if (!headers) return null
  if (typeof (headers as Headers).get === "function") return (headers as Headers).get("location")
  const record = headers as Record<string, string | undefined>
  return record.location ?? record.Location ?? null
}

/**
 * `TWO_FACTOR_PAGE` carrying where the sign-in was headed. Only a same-site
 * path is kept, so the code page cannot be turned into an open redirect.
 */
export function twoFactorPageURL(location: string | null, baseURL: string): string {
  let callbackURL = "/"
  if (location) {
    try {
      const base = new URL(baseURL)
      const target = new URL(location, base)
      if (target.origin === base.origin) callbackURL = `${target.pathname}${target.search}${target.hash}`
    } catch {
      // Unparseable: fall back to the home page.
    }
  }
  if (!callbackURL.startsWith("/") || callbackURL.startsWith("//")) callbackURL = "/"
  return `${TWO_FACTOR_PAGE}?callbackURL=${encodeURIComponent(callbackURL)}`
}

/** HMAC-SHA256 as unpadded base64url — what better-auth signs trust-device tokens with. */
async function hmacBase64Url(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ])
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)))
  let binary = ""
  for (const byte of signature) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * Applies the two-factor plugin's sign-in check to OAuth callbacks, magic
 * links and One Tap: when the new session's user has 2FA on and this browser
 * isn't a trusted device, the session is dropped and replaced by the plugin's
 * own pending-2FA cookie, so `twoFactor.verifyTotp` / `verifyBackupCode` on the
 * code page finish the sign-in exactly as they would after a password.
 * Redirecting routes are sent to {@link TWO_FACTOR_PAGE}; JSON routes (One
 * Tap) answer `{ twoFactorRedirect: true }`, which `twoFactorClient`'s
 * `onTwoFactorRedirect` acts on.
 */
export function passwordlessTwoFactorGate(): BetterAuthPlugin {
  return {
    id: "passwordless-two-factor-gate",
    hooks: {
      before: [
        {
          matcher: (context) => TWO_FACTOR_CHANGE_PATHS.has(context.path ?? ""),
          // Turning 2FA off (or reading new backup codes) from a session that
          // was left signed in on a shared computer days ago is exactly what
          // 2FA should stop, and there is no password to ask for instead.
          handler: createAuthMiddleware(async (ctx) => {
            await freshSessionMiddleware(ctx as never)
          }),
        },
      ],
      after: [
        {
          matcher: (context) => PASSWORDLESS_SIGN_IN_PATHS.has(context.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const data = ctx.context.newSession as
              | { user: { id: string; twoFactorEnabled?: boolean | null }; session: { token: string } }
              | null
            if (!data?.user.twoFactorEnabled) return

            const trustCookie = ctx.context.createAuthCookie(TRUST_DEVICE_COOKIE_NAME, {
              maxAge: TRUST_DEVICE_MAX_AGE_SECONDS,
            })
            const trusted = await ctx.getSignedCookie(trustCookie.name, ctx.context.secret)
            if (trusted) {
              const [token, identifier] = trusted.split("!")
              if (token && identifier && token === (await hmacBase64Url(ctx.context.secret, `${data.user.id}!${identifier}`))) {
                const record = await ctx.context.internalAdapter.findVerificationValue(identifier)
                if (record && record.value === data.user.id && record.expiresAt > new Date()) return
              }
              expireCookie(ctx, trustCookie)
            }

            // Same steps as the plugin's own password sign-in hook.
            deleteSessionCookie(ctx, true)
            await ctx.context.internalAdapter.deleteSession(data.session.token)
            ctx.context.setNewSession(null)
            const pendingCookie = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE_NAME, {
              maxAge: TWO_FACTOR_COOKIE_MAX_AGE_SECONDS,
            })
            const identifier = `2fa-${generateRandomString(20)}`
            const expiresAt = new Date(Date.now() + TWO_FACTOR_COOKIE_MAX_AGE_SECONDS * 1000)
            await ctx.context.internalAdapter.createVerificationValue({ value: data.user.id, identifier, expiresAt })
            await ctx.context.internalAdapter.createVerificationValue({
              value: "0",
              identifier: `2fa-attempts-${identifier}`,
              expiresAt,
            })
            await ctx.setSignedCookie(pendingCookie.name, identifier, ctx.context.secret, pendingCookie.attributes)

            const location = redirectLocation(ctx.context.returned)
            if (location !== null) throw ctx.redirect(twoFactorPageURL(location, ctx.context.baseURL))
            return ctx.json({ twoFactorRedirect: true, twoFactorMethods: ["totp"] })
          }),
        },
      ],
    },
  }
}

/** The passkey, two-factor and gate plugins, for one relying party. */
export function securityPlugins(relyingParty: RelyingParty, appName: string) {
  return [
    passkey({
      rpID: relyingParty.rpID,
      rpName: appName,
      origin: relyingParty.origin,
      // Unset `authenticatorAttachment` keeps both platform passkeys (Touch
      // ID, Windows Hello, a phone) and external security keys available.
    }),
    twoFactor({
      issuer: appName,
      allowPasswordless: true,
      trustDeviceMaxAge: TRUST_DEVICE_MAX_AGE_SECONDS,
      twoFactorCookieMaxAge: TWO_FACTOR_COOKIE_MAX_AGE_SECONDS,
    }),
    passwordlessTwoFactorGate(),
  ] as const
}
