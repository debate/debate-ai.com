import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { userSettings } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import {
  applyFavoriteToolOp,
  DEFAULT_FAVORITE_TOOLS,
  DEFAULT_OUTLINE_FILTER_PRESETS,
  DEFAULT_THEME_SETTINGS,
  DEFAULT_USER_SETTINGS,
  DEFAULT_WORD_LIMIT_PRESETS,
  normalizeFavoriteToolOpPatch,
  normalizeFavoriteToolsPatch,
  normalizeOutlineFilterPresetsPatch,
  normalizeThemeSettingsPatch,
  normalizeUserSettingsPatch,
  normalizeWordLimitPresetsPatch,
  parseFavoriteTools,
  parseOutlineFilterPresets,
  parseWordLimitPresets,
  serializeFavoriteTools,
  serializeOutlineFilterPresets,
  serializeWordLimitPresets,
  type OutlineFilterPreset,
  type ThemeMode,
  type UserSettingsPayload,
} from "debate-round"
import {
  DEFAULT_NEWS_SYNC,
  DEFAULT_QUEST_STREAK_SYNC,
  normalizeNewsSyncPatch,
  normalizeQuestStreakSyncPatch,
  parseNewsIdList,
  parseQuestStreakSync,
  serializeNewsIdList,
  serializeQuestStreakSync,
  type QuestStreakSyncPayload,
} from "debate-community"
import {
  DEFAULT_RESEARCH_PROGRESS_GOAL_SYNC,
  normalizeResearchProgressGoalPatch,
  parseResearchProgressGoal,
  serializeResearchProgressGoal,
  type ResearchProgressGoalSyncPayload,
} from "debate-team-collaboration"
import {
  DEFAULT_SAVED_ARGUMENT_COLLECTIONS,
  normalizeSavedArgumentCollectionsPatch,
  parseSavedArgumentCollections,
  serializeSavedArgumentCollections,
  type SavedArgumentCollection,
} from "debate-research-evidence"
import {
  mergeEditorPreferences,
  normalizeEditorPreferencesPatch,
  parseEditorPreferences,
  serializeEditorPreferences,
  type EditorPreferencesPayload,
} from "@/lib/editor-preferences"
import {
  DEFAULT_QUALIFICATION_POINTS_TABLE_SYNC,
  normalizeQualificationPointsTablePatch,
  parseQualificationPointsTable,
  serializeQualificationPointsTable,
} from "debate-data-sync/src/state/qualificationPointsTable"
import {
  DEFAULT_QUALIFICATION_CUTOFF_SYNC,
  normalizeQualificationCutoffPatch,
  parseQualificationCutoff,
  serializeQualificationCutoff,
  type QualificationCutoffSettings,
} from "debate-data-sync/src/state/qualificationCutoff"
import type { QualificationPointsTable } from "debate-data-sync/src/rankings/ndca-standings"

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
 *   addFavoriteTool?, removeFavoriteTool?, removeFavoriteTools?,
 *   wordLimitPresets?, outlineFilterPresets?, newsRead?, newsLiked?,
 *   savedArgumentCollections?, researchProgressGoal?, questStreakSync?,
 *   qualificationPointsTable?, qualificationCutoff? } — validates and
 *   upserts the given fields (validated by `debate-round`'s
 *   `normalizeUserSettingsPatch`/`normalizeThemeSettingsPatch`/
 *   `normalizeFavoriteToolsPatch`/`normalizeFavoriteToolOpPatch`/
 *   `normalizeWordLimitPresetsPatch`/`normalizeOutlineFilterPresetsPatch`,
 *   `debate-card-search`'s
 *   `normalizeNewsSyncPatch`/`normalizeSavedArgumentCollectionsPatch`/
 *   `normalizeResearchProgressGoalPatch`/`normalizeQuestStreakSyncPatch`,
 *   and `debate-data-sync`'s
 *   `normalizeQualificationPointsTablePatch`/`normalizeQualificationCutoffPatch`
 *   (the Standings tab's custom point weights/cutoff — see
 *   `packages/debate-help-docs/content/docs/features/team-rankings.mdx`'s Known gaps), the same option
 *   lists/shape the picker, favorite-star,
 *   word-limit-preset-manager, News Stream, Common Argument Library "saved
 *   collections", Research Progress "My research goal", and Quest Streaks
 *   reminder/freeze UIs themselves use), returning the resulting full
 *   settings row. `addFavoriteTool`/`removeFavoriteTool`/`removeFavoriteTools`
 *   resolve a single star/unstar, or a batch prune, against the row's
 *   *current* stored `favoriteTools` value (read-then-write, like the
 *   `editorPreferences` merge below) instead of trusting the caller's own
 *   copy of the list, which two tabs editing favorites at once could
 *   otherwise race — see `state/favoriteTools.ts#applyFavoriteToolOp`'s
 *   docstring and `packages/debate-help-docs/content/docs/features/user-settings.mdx`'s
 *   Known gaps. A plain `favoriteTools` array is still accepted for a
 *   caller that genuinely needs a whole-list replace, but no code path in
 *   this app sends one anymore — `pruneUnknown`'s bulk cleanup, the last
 *   one that did, now sends `removeFavoriteTools` instead.
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
  wordLimitPresets: string | null
  outlineFilterPresets: string | null
  savedArgumentCollections: string | null
  researchProgressGoal: string | null
  questStreakSync: string | null
  qualificationPointsTable: string | null
  qualificationCutoff: string | null
}

type SettingsPayload = UserSettingsPayload & {
  colorTheme: string
  themeMode: ThemeMode
  favoriteTools: string[]
  editorPreferences: EditorPreferencesPayload
  newsRead: string[]
  newsLiked: string[]
  wordLimitPresets: { name: string; wordLimit: number }[]
  outlineFilterPresets: OutlineFilterPreset[]
  savedArgumentCollections: SavedArgumentCollection[]
  researchProgressGoal: ResearchProgressGoalSyncPayload | null
  questStreakSync: QuestStreakSyncPayload | null
  qualificationPointsTable: QualificationPointsTable | null
  qualificationCutoff: QualificationCutoffSettings | null
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
    wordLimitPresets: row?.wordLimitPresets
      ? parseWordLimitPresets(row.wordLimitPresets)
      : DEFAULT_WORD_LIMIT_PRESETS.wordLimitPresets,
    outlineFilterPresets: row?.outlineFilterPresets
      ? parseOutlineFilterPresets(row.outlineFilterPresets)
      : DEFAULT_OUTLINE_FILTER_PRESETS.outlineFilterPresets,
    savedArgumentCollections: row?.savedArgumentCollections
      ? parseSavedArgumentCollections(row.savedArgumentCollections)
      : DEFAULT_SAVED_ARGUMENT_COLLECTIONS.savedArgumentCollections,
    researchProgressGoal: row?.researchProgressGoal
      ? parseResearchProgressGoal(row.researchProgressGoal)
      : DEFAULT_RESEARCH_PROGRESS_GOAL_SYNC.researchProgressGoal,
    questStreakSync: row?.questStreakSync
      ? parseQuestStreakSync(row.questStreakSync)
      : DEFAULT_QUEST_STREAK_SYNC.questStreakSync,
    qualificationPointsTable: row?.qualificationPointsTable
      ? parseQualificationPointsTable(row.qualificationPointsTable)
      : DEFAULT_QUALIFICATION_POINTS_TABLE_SYNC.qualificationPointsTable,
    qualificationCutoff: row?.qualificationCutoff
      ? parseQualificationCutoff(row.qualificationCutoff)
      : DEFAULT_QUALIFICATION_CUTOFF_SYNC.qualificationCutoff,
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
  const favoriteToolOpResult = normalizeFavoriteToolOpPatch(body)
  const wordLimitPresetsResult = normalizeWordLimitPresetsPatch(body)
  const outlineFilterPresetsResult = normalizeOutlineFilterPresetsPatch(body)
  const savedArgumentCollectionsResult = normalizeSavedArgumentCollectionsPatch(body)
  const researchProgressGoalResult = normalizeResearchProgressGoalPatch(body)
  const questStreakSyncResult = normalizeQuestStreakSyncPatch(body)
  const newsSyncResult = normalizeNewsSyncPatch(body)
  const qualificationPointsTableResult = normalizeQualificationPointsTablePatch(body)
  const qualificationCutoffResult = normalizeQualificationCutoffPatch(body)
  const editorPreferencesResult = normalizeEditorPreferencesPatch(
    (body as { editorPreferences?: unknown } | null)?.editorPreferences,
  )
  const valid = { ...userSettingsResult.valid, ...themeSettingsResult.valid }
  const errors = [
    ...userSettingsResult.errors,
    ...themeSettingsResult.errors,
    ...favoriteToolsResult.errors,
    ...favoriteToolOpResult.errors,
    ...wordLimitPresetsResult.errors,
    ...outlineFilterPresetsResult.errors,
    ...savedArgumentCollectionsResult.errors,
    ...researchProgressGoalResult.errors,
    ...questStreakSyncResult.errors,
    ...newsSyncResult.errors,
    ...qualificationPointsTableResult.errors,
    ...qualificationCutoffResult.errors,
    ...editorPreferencesResult.errors,
  ]

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 })
  }
  if (
    Object.keys(valid).length === 0 &&
    favoriteToolsResult.valid.favoriteTools === undefined &&
    favoriteToolOpResult.valid.addFavoriteTool === undefined &&
    favoriteToolOpResult.valid.removeFavoriteTool === undefined &&
    favoriteToolOpResult.valid.removeFavoriteTools === undefined &&
    wordLimitPresetsResult.valid.wordLimitPresets === undefined &&
    outlineFilterPresetsResult.valid.outlineFilterPresets === undefined &&
    savedArgumentCollectionsResult.valid.savedArgumentCollections === undefined &&
    researchProgressGoalResult.valid.researchProgressGoal === undefined &&
    questStreakSyncResult.valid.questStreakSync === undefined &&
    qualificationPointsTableResult.valid.qualificationPointsTable === undefined &&
    qualificationCutoffResult.valid.qualificationCutoff === undefined &&
    Object.keys(newsSyncResult.valid).length === 0 &&
    Object.keys(editorPreferencesResult.valid).length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "Provide at least one of debateStyle, fontSize, colorTheme, themeMode, favoriteTools, addFavoriteTool, removeFavoriteTool, removeFavoriteTools, wordLimitPresets, outlineFilterPresets, savedArgumentCollections, researchProgressGoal, questStreakSync, qualificationPointsTable, qualificationCutoff, newsRead, newsLiked, or editorPreferences.",
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
    wordLimitPresets?: string | null
    outlineFilterPresets?: string | null
    savedArgumentCollections?: string | null
    researchProgressGoal?: string | null
    questStreakSync?: string | null
    qualificationPointsTable?: string | null
    qualificationCutoff?: string | null
  } = { ...valid }
  if (
    favoriteToolOpResult.valid.addFavoriteTool !== undefined ||
    favoriteToolOpResult.valid.removeFavoriteTool !== undefined ||
    favoriteToolOpResult.valid.removeFavoriteTools !== undefined
  ) {
    // A single star/unstar op, or a batch prune, is resolved against the
    // row's *current* stored list rather than the caller's own copy — see
    // this route's docstring and `state/favoriteTools.ts#applyFavoriteToolOp`.
    // This is what closes the lost-update race two tabs editing favorites at
    // once used to hit with a plain `favoriteTools` whole-list replace —
    // `removeFavoriteTools` is the batch form `pruneUnknown`'s bulk cleanup
    // now uses instead of that whole-list replace.
    const [existing] = await db
      .select({ favoriteTools: userSettings.favoriteTools })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
    const current = existing?.favoriteTools
      ? parseFavoriteTools(existing.favoriteTools)
      : DEFAULT_FAVORITE_TOOLS.favoriteTools
    dbPatch.favoriteTools = serializeFavoriteTools(applyFavoriteToolOp(current, favoriteToolOpResult.valid))
  } else if (favoriteToolsResult.valid.favoriteTools !== undefined) {
    dbPatch.favoriteTools = serializeFavoriteTools(favoriteToolsResult.valid.favoriteTools)
  }
  if (outlineFilterPresetsResult.valid.outlineFilterPresets !== undefined) {
    dbPatch.outlineFilterPresets = serializeOutlineFilterPresets(outlineFilterPresetsResult.valid.outlineFilterPresets)
  }
  if (savedArgumentCollectionsResult.valid.savedArgumentCollections !== undefined) {
    dbPatch.savedArgumentCollections = serializeSavedArgumentCollections(
      savedArgumentCollectionsResult.valid.savedArgumentCollections,
    )
  }
  if (wordLimitPresetsResult.valid.wordLimitPresets !== undefined) {
    dbPatch.wordLimitPresets = serializeWordLimitPresets(wordLimitPresetsResult.valid.wordLimitPresets)
  }
  if (researchProgressGoalResult.valid.researchProgressGoal !== undefined) {
    dbPatch.researchProgressGoal = serializeResearchProgressGoal(researchProgressGoalResult.valid.researchProgressGoal)
  }
  if (questStreakSyncResult.valid.questStreakSync !== undefined) {
    dbPatch.questStreakSync = serializeQuestStreakSync(questStreakSyncResult.valid.questStreakSync)
  }
  if (qualificationPointsTableResult.valid.qualificationPointsTable !== undefined) {
    dbPatch.qualificationPointsTable = serializeQualificationPointsTable(
      qualificationPointsTableResult.valid.qualificationPointsTable,
    )
  }
  if (qualificationCutoffResult.valid.qualificationCutoff !== undefined) {
    dbPatch.qualificationCutoff = serializeQualificationCutoff(qualificationCutoffResult.valid.qualificationCutoff)
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
