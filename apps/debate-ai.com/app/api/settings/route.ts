import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { userSettings } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import {
  DEFAULT_THEME_SETTINGS,
  DEFAULT_USER_SETTINGS,
  normalizeThemeSettingsPatch,
  normalizeUserSettingsPatch,
  type ThemeMode,
  type UserSettingsPayload,
} from "debate-round"

/**
 * Account-linked app preferences — TODO.md idea #17 ("User Settings —
 * account-linked debate preferences"), first slice, plus follow-up (2)
 * (the `colorTheme`/`themeMode` fields). One `user_settings` row per
 * signed-in user, mirroring `debate-round`'s local-only `settings`
 * singleton and `components/theme-dropdown.tsx`'s local-storage/cookie
 * theme state so a user's preferences follow them across devices. Unlike
 * `app/api/doc/documents/route.ts`, there is no anonymous/signed-out mode
 * here — settings are account data, so both handlers require a session and
 * return 401 without one; the clients (`UserSettingsPanel`,
 * `useThemeState`) fall back to their local-only stores when signed out
 * instead of calling this route.
 *
 * GET  — the current user's saved settings, or the matching `DEFAULT_*`
 *   value for any field with no saved row/value yet.
 * PUT  { debateStyle?, fontSize?, colorTheme?, themeMode? } — validates and
 *   upserts the given fields (validated by `debate-round`'s
 *   `normalizeUserSettingsPatch`/`normalizeThemeSettingsPatch`, the same
 *   option lists the picker UIs themselves use), returning the resulting
 *   full settings row.
 */

type SettingsRow = {
  debateStyle: number | null
  fontSize: number | null
  colorTheme: string | null
  themeMode: string | null
}

type SettingsPayload = UserSettingsPayload & { colorTheme: string; themeMode: ThemeMode }

function toPayload(row: SettingsRow | undefined): SettingsPayload {
  return {
    debateStyle: row?.debateStyle ?? DEFAULT_USER_SETTINGS.debateStyle,
    fontSize: row?.fontSize ?? DEFAULT_USER_SETTINGS.fontSize,
    colorTheme: row?.colorTheme ?? DEFAULT_THEME_SETTINGS.colorTheme,
    themeMode: (row?.themeMode as ThemeMode | null) ?? DEFAULT_THEME_SETTINGS.themeMode,
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to load your account settings." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1)

  return NextResponse.json(toPayload(row))
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to save your account settings." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const userSettingsResult = normalizeUserSettingsPatch(body)
  const themeSettingsResult = normalizeThemeSettingsPatch(body)
  const valid = { ...userSettingsResult.valid, ...themeSettingsResult.valid }
  const errors = [...userSettingsResult.errors, ...themeSettingsResult.errors]

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 })
  }
  if (Object.keys(valid).length === 0) {
    return NextResponse.json(
      { error: "Provide at least one of debateStyle, fontSize, colorTheme, or themeMode." },
      { status: 400 },
    )
  }

  const db = await getDBFromContext()
  const now = new Date()

  await db
    .insert(userSettings)
    .values({ userId, ...valid, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: userSettings.userId, set: { ...valid, updatedAt: now } })

  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1)

  return NextResponse.json(toPayload(row))
}
