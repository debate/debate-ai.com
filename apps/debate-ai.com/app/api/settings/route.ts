import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { userSettings } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import {
  DEFAULT_FAVORITE_TOOLS,
  DEFAULT_THEME_SETTINGS,
  DEFAULT_USER_SETTINGS,
  normalizeFavoriteToolsPatch,
  normalizeThemeSettingsPatch,
  normalizeUserSettingsPatch,
  parseFavoriteTools,
  serializeFavoriteTools,
  type ThemeMode,
  type UserSettingsPayload,
} from "debate-round"
import {
  DEFAULT_NEWS_SYNC,
  normalizeNewsSyncPatch,
  parseNewsIdList,
  serializeNewsIdList,
} from "debate-card-search"
import {
  mergeEditorPreferences,
  normalizeEditorPreferencesPatch,
  parseEditorPreferences,
  serializeEditorPreferences,
  type EditorPreferencesPayload,
} from "@/lib/editor-preferences"

/**
 * Account-linked app preferences — TODO.md idea #17 ("User Settings —
 * account-linked debate preferences"), first slice, follow-up (2) (the
 * `colorTheme`/`themeMode` fields), plus the "integrate tools into user
 * settings" follow-up (`favoriteTools`). One `user_settings` row per
 * signed-in user, mirroring `debate-round`'s local-only `settings`
 * singleton, `components/theme-dropdown.tsx`'s local-storage/cookie theme
 * state, and `lib/hooks/useFavoriteTools.ts`'s local-storage favorites list
 * so a user's preferences follow them across devices. Unlike
 * `app/api/doc/documents/route.ts`, there is no anonymous/signed-out mode
 * here — settings are account data, so both handlers require a session and
 * return 401 without one; the clients (`UserSettingsPanel`,
 * `useThemeState`, `useFavoriteTools`) fall back to their local-only stores
 * when signed out instead of calling this route.
 *
 * GET  — the current user's saved settings, or the matching `DEFAULT_*`
 *   value for any field with no saved row/value yet.
 * PUT  { debateStyle?, fontSize?, colorTheme?, themeMode?, favoriteTools?,
 *   newsRead?, newsLiked? } — validates and upserts the given fields
 *   (validated by `debate-round`'s `normalizeUserSettingsPatch`/
 *   `normalizeThemeSettingsPatch`/`normalizeFavoriteToolsPatch` and
 *   `debate-card-search`'s `normalizeNewsSyncPatch`, the same option
 *   lists/shape the picker, favorite-star, and News Stream UIs themselves
 *   use), returning the resulting full settings row.
 */

type SettingsRow = {
  debateStyle: number | null
  fontSize: number | null
  colorTheme: string | null
  themeMode: string | null
  favoriteTools: string | null
  editorPreferences: string | null
  newsRead: string | null
  newsLiked: string | null
}

type SettingsPayload = UserSettingsPayload & {
  colorTheme: string
  themeMode: ThemeMode
  favoriteTools: string[]
  editorPreferences: EditorPreferencesPayload
  newsRead: string[]
  newsLiked: string[]
}

function toPayload(row: SettingsRow | undefined): SettingsPayload {
  return {
    debateStyle: row?.debateStyle ?? DEFAULT_USER_SETTINGS.debateStyle,
    fontSize: row?.fontSize ?? DEFAULT_USER_SETTINGS.fontSize,
    colorTheme: row?.colorTheme ?? DEFAULT_THEME_SETTINGS.colorTheme,
    themeMode: (row?.themeMode as ThemeMode | null) ?? DEFAULT_THEME_SETTINGS.themeMode,
    favoriteTools: row?.favoriteTools ? parseFavoriteTools(row.favoriteTools) : DEFAULT_FAVORITE_TOOLS.favoriteTools,
    editorPreferences: parseEditorPreferences(row?.editorPreferences),
    newsRead: row?.newsRead ? parseNewsIdList(row.newsRead) : DEFAULT_NEWS_SYNC.newsRead,
    newsLiked: row?.newsLiked ? parseNewsIdList(row.newsLiked) : DEFAULT_NEWS_SYNC.newsLiked,
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
  const favoriteToolsResult = normalizeFavoriteToolsPatch(body)
  const newsSyncResult = normalizeNewsSyncPatch(body)
  const editorPreferencesResult = normalizeEditorPreferencesPatch(
    (body as { editorPreferences?: unknown } | null)?.editorPreferences,
  )
  const valid = { ...userSettingsResult.valid, ...themeSettingsResult.valid }
  const errors = [
    ...userSettingsResult.errors,
    ...themeSettingsResult.errors,
    ...favoriteToolsResult.errors,
    ...newsSyncResult.errors,
    ...editorPreferencesResult.errors,
  ]

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 })
  }
  if (
    Object.keys(valid).length === 0 &&
    favoriteToolsResult.valid.favoriteTools === undefined &&
    Object.keys(newsSyncResult.valid).length === 0 &&
    Object.keys(editorPreferencesResult.valid).length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "Provide at least one of debateStyle, fontSize, colorTheme, themeMode, favoriteTools, newsRead, newsLiked, or editorPreferences.",
      },
      { status: 400 },
    )
  }

  const db = await getDBFromContext()
  const now = new Date()

  // `favoriteTools`/`newsRead`/`newsLiked` are stored as JSON-serialized
  // columns, so they're kept out of `valid` (the picker-style fields written
  // as-is) and merged in here.
  const dbPatch: typeof valid & {
    favoriteTools?: string | null
    editorPreferences?: string | null
    newsRead?: string | null
    newsLiked?: string | null
  } = { ...valid }
  if (favoriteToolsResult.valid.favoriteTools !== undefined) {
    dbPatch.favoriteTools = serializeFavoriteTools(favoriteToolsResult.valid.favoriteTools)
  }
  if (newsSyncResult.valid.newsRead !== undefined) {
    dbPatch.newsRead = serializeNewsIdList(newsSyncResult.valid.newsRead)
  }
  if (newsSyncResult.valid.newsLiked !== undefined) {
    dbPatch.newsLiked = serializeNewsIdList(newsSyncResult.valid.newsLiked)
  }
  // `editorPreferences` is a key→value map updated one control at a time, so
  // a PUT merges onto the existing stored map rather than replacing it.
  if (Object.keys(editorPreferencesResult.valid).length > 0) {
    const [existing] = await db
      .select({ editorPreferences: userSettings.editorPreferences })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
    const merged = mergeEditorPreferences(parseEditorPreferences(existing?.editorPreferences), editorPreferencesResult.valid)
    dbPatch.editorPreferences = serializeEditorPreferences(merged)
  }

  await db
    .insert(userSettings)
    .values({ userId, ...dbPatch, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: userSettings.userId, set: { ...dbPatch, updatedAt: now } })

  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1)

  return NextResponse.json(toPayload(row))
}
