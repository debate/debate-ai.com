import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { userSettings } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import {
  applyFavoriteToolOp,
  applyOutlineFilterPresetOp,
  applyWordLimitPresetOp,
  buildOutlineFilterPresetFailureMessage,
  buildWordLimitPresetFailureMessage,
  DEFAULT_FAVORITE_TOOLS,
  DEFAULT_OUTLINE_FILTER_PRESETS,
  DEFAULT_THEME_SETTINGS,
  DEFAULT_USER_SETTINGS,
  DEFAULT_WORD_LIMIT_PRESETS,
  normalizeFavoriteToolOpPatch,
  normalizeFavoriteToolsPatch,
  normalizeOutlineFilterPresetOpPatch,
  normalizeOutlineFilterPresetsPatch,
  normalizeThemeSettingsPatch,
  normalizeUserSettingsPatch,
  normalizeWordLimitPresetOpPatch,
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
  applyNewsLikedOp,
  applyNewsReadOp,
  applyQuestStreakFreezeOp,
  applyQuestStreakReminderOp,
  DEFAULT_NEWS_SYNC,
  DEFAULT_QUEST_STREAK_SYNC,
  normalizeNewsLikedOpPatch,
  normalizeNewsReadOpPatch,
  normalizeNewsSyncPatch,
  normalizeQuestStreakFreezeOpPatch,
  normalizeQuestStreakReminderOpPatch,
  normalizeQuestStreakSyncPatch,
  parseNewsIdList,
  parseQuestStreakSync,
  serializeNewsIdList,
  serializeQuestStreakSync,
  type QuestStreakSyncPayload,
} from "debate-community"
import {
  DEFAULT_BRAINSTORM_SESSION_TIMER_SYNC,
  DEFAULT_RESEARCH_PROGRESS_GOAL_SYNC,
  normalizeBrainstormSessionTimerPatch,
  normalizeResearchProgressGoalPatch,
  parseBrainstormSessionTimer,
  parseResearchProgressGoal,
  serializeBrainstormSessionTimer,
  serializeResearchProgressGoal,
  type BrainstormSessionTimerSyncPayload,
  type ResearchProgressGoalSyncPayload,
} from "debate-team-collaboration"
import {
  applySavedArgumentCollectionOp,
  buildSavedArgumentCollectionFailureMessage,
  DEFAULT_SAVED_ARGUMENT_COLLECTIONS,
  normalizeSavedArgumentCollectionOpPatch,
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
import { applyRecentToolOp, normalizeRecentToolOpPatch, parseRecentTools, serializeRecentTools } from "@/lib/recentTools"
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
 *   recordRecentTool?, wordLimitPresets?, addWordLimitPreset?,
 *   updateWordLimitPreset?, removeWordLimitPreset?, outlineFilterPresets?,
 *   addOutlineFilterPreset?, removeOutlineFilterPreset?,
 *   newsRead?, newsLiked?, recordNewsRead?, addNewsLiked?, removeNewsLiked?,
 *   savedArgumentCollections?,
 *   addSavedArgumentCollection?, removeSavedArgumentCollection?,
 *   renameSavedArgumentCollection?, updateSavedArgumentCollectionTags?,
 *   researchProgressGoal?, questStreakSync?, qualificationPointsTable?,
 *   qualificationCutoff?, brainstormSessionTimer? } — validates and
 *   upserts the given fields (validated by `debate-round`'s
 *   `normalizeUserSettingsPatch`/`normalizeThemeSettingsPatch`/
 *   `normalizeFavoriteToolsPatch`/`normalizeFavoriteToolOpPatch`/
 *   `normalizeWordLimitPresetsPatch`/`normalizeWordLimitPresetOpPatch`/
 *   `normalizeOutlineFilterPresetsPatch`,
 *   `debate-card-search`'s
 *   `normalizeNewsSyncPatch`/`normalizeNewsReadOpPatch`/`normalizeNewsLikedOpPatch`/
 *   `normalizeSavedArgumentCollectionsPatch`/
 *   `normalizeSavedArgumentCollectionOpPatch`/
 *   `normalizeResearchProgressGoalPatch`/`normalizeQuestStreakSyncPatch`,
 *   and `debate-data-sync`'s
 *   `normalizeQualificationPointsTablePatch`/`normalizeQualificationCutoffPatch`
 *   (the Standings tab's custom point weights/cutoff — see
 *   `packages/debate-help-docs/content/docs/features/team-rankings.mdx`'s Known gaps),
 *   and `debate-team-collaboration`'s `normalizeBrainstormSessionTimerPatch`
 *   (Team Brainstorm Assist's session timer — see
 *   `packages/debate-help-docs/content/docs/features/brainstorm-board.mdx`'s
 *   Known gaps), the same option
 *   lists/shape the picker, favorite-star,
 *   word-limit-preset-manager, News Stream, Common Argument Library "saved
 *   collections", Research Progress "My research goal", Quest Streaks
 *   reminder/freeze, and Team Brainstorm Assist session-timer UIs themselves
 *   use), returning the resulting full
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
 *   one that did, now sends `removeFavoriteTools` instead. `recordRecentTool`
 *   is the same op-based approach for the "Recent" tools list, validated by
 *   this app's own `lib/recentTools.ts#normalizeRecentToolOpPatch` (that
 *   field's app-specific rationale is in that file's header) and resolved
 *   against the row's current `recentTools` value the same way.
 *   `addSavedArgumentCollection`/`removeSavedArgumentCollection`/
 *   `renameSavedArgumentCollection`/`updateSavedArgumentCollectionTags` are
 *   the same op-based fix for the equivalent "two tabs/devices edit saved
 *   Argument Library collections at once" race a plain
 *   `savedArgumentCollections` whole-list replace is exposed to — see
 *   `argument-library-collections.ts#applySavedArgumentCollectionOp`'s
 *   docstring and
 *   `packages/debate-help-docs/content/docs/features/argument-library-collections.mdx`'s
 *   Known gaps. Unlike the favorites ops, a collection op can fail a business
 *   rule (duplicate name, at capacity, unknown collection, …), in which case
 *   this route returns 400 with that failure's message instead of writing.
 *   `savedArgumentCollections` itself is still accepted for a caller that
 *   genuinely needs a whole-list replace, but `useSavedArgumentCollections.ts`
 *   no longer sends one.
 *   `addWordLimitPreset`/`updateWordLimitPreset`/`removeWordLimitPreset` are
 *   the same op-based fix for the equivalent "two tabs/devices edit
 *   word-limit presets at once" race a plain `wordLimitPresets` whole-list
 *   replace is exposed to — see
 *   `state/wordLimitPresets.ts#applyWordLimitPresetOp`'s docstring and
 *   `packages/debate-help-docs/content/docs/features/user-settings.mdx`'s
 *   Known gaps. Like the collection ops, an add/update op can fail a
 *   business rule (duplicate name, at capacity, unknown preset), in which
 *   case this route returns 400 with that failure's message instead of
 *   writing. `wordLimitPresets` itself is still accepted for a caller that
 *   genuinely needs a whole-list replace, but `useWordLimitPresets.ts` no
 *   longer sends one.
 *   `addOutlineFilterPreset`/`removeOutlineFilterPreset` are the same
 *   op-based fix for the equivalent "two tabs/devices edit Outline filter
 *   presets at once" race a plain `outlineFilterPresets` whole-list replace
 *   is exposed to — see
 *   `state/outlineFilterPresets.ts#applyOutlineFilterPresetOp`'s docstring
 *   and `packages/debate-help-docs/content/docs/features/user-settings.mdx`'s
 *   Known gaps. Like the word-limit-preset ops, an add op
 *   can fail a business rule (duplicate name, at capacity, invalid filter),
 *   in which case this route returns 400 with that failure's message
 *   instead of writing. `outlineFilterPresets` itself is still accepted for
 *   a caller that genuinely needs a whole-list replace, but
 *   `useOutlineFilterPresets.ts` no longer sends one.
 *   `recordNewsRead` is the same op-based fix, mirroring `recordRecentTool`,
 *   for the equivalent "two tabs/devices mark different News Stream items
 *   read at once" race a plain `newsRead` whole-list replace is exposed to —
 *   see `news-stream-sync.ts#applyNewsReadOp`'s docstring and
 *   `packages/debate-help-docs/content/docs/internals/news-stream.mdx`'s
 *   Known gaps. `addNewsLiked`/`removeNewsLiked` are the same fix for
 *   `newsLiked`, mirroring the favorite-tools add/remove ops. `newsRead`/
 *   `newsLiked` themselves are still accepted for a caller that genuinely
 *   needs a whole-list replace, but `useNewsStreamSync.ts` no longer sends
 *   one.
 *   `recordStreakFreezeDayKey`/`setLapseReminderEnabled` are the same
 *   op-based fix for the equivalent "two tabs/devices spend a streak freeze,
 *   or toggle the lapse reminder, at once" race a plain `questStreakSync`
 *   whole-value replace is exposed to — see
 *   `quest-streak-sync.ts#applyQuestStreakFreezeOp`/`applyQuestStreakReminderOp`'s
 *   docstrings. `questStreakSync` itself is still accepted for a caller that
 *   genuinely needs a whole-value replace, but `useQuestStreakSync.ts` no
 *   longer sends one.
 */

type SettingsRow = {
  debateStyle: number | null
  fontSize: number | null
  colorTheme: string | null
  themeMode: string | null
  favoriteTools: string | null
  recentTools: string | null
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
  brainstormSessionTimer: string | null
}

type SettingsPayload = UserSettingsPayload & {
  colorTheme: string
  themeMode: ThemeMode
  favoriteTools: string[]
  recentTools: string[]
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
  brainstormSessionTimer: BrainstormSessionTimerSyncPayload | null
}

function toPayload(row: SettingsRow | undefined): SettingsPayload {
  return {
    debateStyle: row?.debateStyle ?? DEFAULT_USER_SETTINGS.debateStyle,
    fontSize: row?.fontSize ?? DEFAULT_USER_SETTINGS.fontSize,
    colorTheme: row?.colorTheme ?? DEFAULT_THEME_SETTINGS.colorTheme,
    themeMode: (row?.themeMode as ThemeMode | null) ?? DEFAULT_THEME_SETTINGS.themeMode,
    favoriteTools: row?.favoriteTools ? parseFavoriteTools(row.favoriteTools) : DEFAULT_FAVORITE_TOOLS.favoriteTools,
    recentTools: row?.recentTools ? parseRecentTools(row.recentTools) : [],
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
    brainstormSessionTimer: row?.brainstormSessionTimer
      ? parseBrainstormSessionTimer(row.brainstormSessionTimer)
      : DEFAULT_BRAINSTORM_SESSION_TIMER_SYNC.brainstormSessionTimer,
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
  const recentToolOpResult = normalizeRecentToolOpPatch(body)
  const wordLimitPresetsResult = normalizeWordLimitPresetsPatch(body)
  const wordLimitPresetOpResult = normalizeWordLimitPresetOpPatch(body)
  const outlineFilterPresetsResult = normalizeOutlineFilterPresetsPatch(body)
  const outlineFilterPresetOpResult = normalizeOutlineFilterPresetOpPatch(body)
  const savedArgumentCollectionsResult = normalizeSavedArgumentCollectionsPatch(body)
  const savedArgumentCollectionOpResult = normalizeSavedArgumentCollectionOpPatch(body)
  const researchProgressGoalResult = normalizeResearchProgressGoalPatch(body)
  const questStreakSyncResult = normalizeQuestStreakSyncPatch(body)
  const questStreakFreezeOpResult = normalizeQuestStreakFreezeOpPatch(body)
  const questStreakReminderOpResult = normalizeQuestStreakReminderOpPatch(body)
  const newsSyncResult = normalizeNewsSyncPatch(body)
  const newsReadOpResult = normalizeNewsReadOpPatch(body)
  const newsLikedOpResult = normalizeNewsLikedOpPatch(body)
  const qualificationPointsTableResult = normalizeQualificationPointsTablePatch(body)
  const qualificationCutoffResult = normalizeQualificationCutoffPatch(body)
  const brainstormSessionTimerResult = normalizeBrainstormSessionTimerPatch(body)
  const editorPreferencesResult = normalizeEditorPreferencesPatch(
    (body as { editorPreferences?: unknown } | null)?.editorPreferences,
  )
  const valid = { ...userSettingsResult.valid, ...themeSettingsResult.valid }
  const errors = [
    ...userSettingsResult.errors,
    ...themeSettingsResult.errors,
    ...favoriteToolsResult.errors,
    ...favoriteToolOpResult.errors,
    ...recentToolOpResult.errors,
    ...wordLimitPresetsResult.errors,
    ...wordLimitPresetOpResult.errors,
    ...outlineFilterPresetsResult.errors,
    ...outlineFilterPresetOpResult.errors,
    ...savedArgumentCollectionsResult.errors,
    ...savedArgumentCollectionOpResult.errors,
    ...researchProgressGoalResult.errors,
    ...questStreakSyncResult.errors,
    ...questStreakFreezeOpResult.errors,
    ...questStreakReminderOpResult.errors,
    ...newsSyncResult.errors,
    ...newsReadOpResult.errors,
    ...newsLikedOpResult.errors,
    ...qualificationPointsTableResult.errors,
    ...qualificationCutoffResult.errors,
    ...brainstormSessionTimerResult.errors,
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
    recentToolOpResult.valid.recordRecentTool === undefined &&
    wordLimitPresetsResult.valid.wordLimitPresets === undefined &&
    wordLimitPresetOpResult.valid.addWordLimitPreset === undefined &&
    wordLimitPresetOpResult.valid.updateWordLimitPreset === undefined &&
    wordLimitPresetOpResult.valid.removeWordLimitPreset === undefined &&
    outlineFilterPresetsResult.valid.outlineFilterPresets === undefined &&
    outlineFilterPresetOpResult.valid.addOutlineFilterPreset === undefined &&
    outlineFilterPresetOpResult.valid.removeOutlineFilterPreset === undefined &&
    savedArgumentCollectionsResult.valid.savedArgumentCollections === undefined &&
    savedArgumentCollectionOpResult.valid.addSavedArgumentCollection === undefined &&
    savedArgumentCollectionOpResult.valid.removeSavedArgumentCollection === undefined &&
    savedArgumentCollectionOpResult.valid.renameSavedArgumentCollection === undefined &&
    savedArgumentCollectionOpResult.valid.updateSavedArgumentCollectionTags === undefined &&
    researchProgressGoalResult.valid.researchProgressGoal === undefined &&
    questStreakSyncResult.valid.questStreakSync === undefined &&
    questStreakFreezeOpResult.valid.recordStreakFreezeDayKey === undefined &&
    questStreakReminderOpResult.valid.setLapseReminderEnabled === undefined &&
    qualificationPointsTableResult.valid.qualificationPointsTable === undefined &&
    qualificationCutoffResult.valid.qualificationCutoff === undefined &&
    brainstormSessionTimerResult.valid.brainstormSessionTimer === undefined &&
    Object.keys(newsSyncResult.valid).length === 0 &&
    newsReadOpResult.valid.recordNewsRead === undefined &&
    newsLikedOpResult.valid.addNewsLiked === undefined &&
    newsLikedOpResult.valid.removeNewsLiked === undefined &&
    Object.keys(editorPreferencesResult.valid).length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "Provide at least one of debateStyle, fontSize, colorTheme, themeMode, favoriteTools, addFavoriteTool, removeFavoriteTool, removeFavoriteTools, recordRecentTool, wordLimitPresets, addWordLimitPreset, updateWordLimitPreset, removeWordLimitPreset, outlineFilterPresets, addOutlineFilterPreset, removeOutlineFilterPreset, savedArgumentCollections, addSavedArgumentCollection, removeSavedArgumentCollection, renameSavedArgumentCollection, updateSavedArgumentCollectionTags, researchProgressGoal, questStreakSync, recordStreakFreezeDayKey, setLapseReminderEnabled, qualificationPointsTable, qualificationCutoff, brainstormSessionTimer, newsRead, newsLiked, recordNewsRead, addNewsLiked, removeNewsLiked, or editorPreferences.",
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
    recentTools?: string | null
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
    brainstormSessionTimer?: string | null
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
  if (recentToolOpResult.valid.recordRecentTool !== undefined) {
    // Same read-then-write shape as the favoriteTools op above, resolved
    // against the row's current `recentTools` value rather than the
    // caller's own (possibly stale) copy.
    const [existing] = await db
      .select({ recentTools: userSettings.recentTools })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
    const current = existing?.recentTools ? parseRecentTools(existing.recentTools) : []
    dbPatch.recentTools = serializeRecentTools(
      applyRecentToolOp(current, { recordRecentTool: recentToolOpResult.valid.recordRecentTool }),
    )
  }
  if (
    outlineFilterPresetOpResult.valid.addOutlineFilterPreset !== undefined ||
    outlineFilterPresetOpResult.valid.removeOutlineFilterPreset !== undefined
  ) {
    // An add/remove op is resolved against the row's *current* stored list
    // rather than the caller's own copy — see this route's docstring and
    // `state/outlineFilterPresets.ts#applyOutlineFilterPresetOp`. This
    // closes the same lost-update race a plain `outlineFilterPresets`
    // whole-list replace is exposed to that `wordLimitPresets`'s op-based
    // patch above already fixed.
    const [existing] = await db
      .select({ outlineFilterPresets: userSettings.outlineFilterPresets })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
    const current = existing?.outlineFilterPresets
      ? parseOutlineFilterPresets(existing.outlineFilterPresets)
      : DEFAULT_OUTLINE_FILTER_PRESETS.outlineFilterPresets
    const opName =
      outlineFilterPresetOpResult.valid.addOutlineFilterPreset?.name ??
      outlineFilterPresetOpResult.valid.removeOutlineFilterPreset ??
      ""
    const result = applyOutlineFilterPresetOp(current, outlineFilterPresetOpResult.valid)
    if (result.failure) {
      return NextResponse.json({ error: buildOutlineFilterPresetFailureMessage(result.failure, opName) }, { status: 400 })
    }
    dbPatch.outlineFilterPresets = serializeOutlineFilterPresets(result.next)
  } else if (outlineFilterPresetsResult.valid.outlineFilterPresets !== undefined) {
    dbPatch.outlineFilterPresets = serializeOutlineFilterPresets(outlineFilterPresetsResult.valid.outlineFilterPresets)
  }
  if (
    savedArgumentCollectionOpResult.valid.addSavedArgumentCollection !== undefined ||
    savedArgumentCollectionOpResult.valid.removeSavedArgumentCollection !== undefined ||
    savedArgumentCollectionOpResult.valid.renameSavedArgumentCollection !== undefined ||
    savedArgumentCollectionOpResult.valid.updateSavedArgumentCollectionTags !== undefined
  ) {
    // An add/remove/rename/tags-update op is resolved against the row's
    // *current* stored list rather than the caller's own copy — see this
    // route's docstring and
    // `argument-library-collections.ts#applySavedArgumentCollectionOp`. This
    // closes the same lost-update race a plain `savedArgumentCollections`
    // whole-list replace is exposed to that `favoriteTools`'s op-based patch
    // above already fixed.
    const [existing] = await db
      .select({ savedArgumentCollections: userSettings.savedArgumentCollections })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
    const current = existing?.savedArgumentCollections
      ? parseSavedArgumentCollections(existing.savedArgumentCollections)
      : DEFAULT_SAVED_ARGUMENT_COLLECTIONS.savedArgumentCollections
    const opName =
      savedArgumentCollectionOpResult.valid.addSavedArgumentCollection?.name ??
      savedArgumentCollectionOpResult.valid.removeSavedArgumentCollection ??
      savedArgumentCollectionOpResult.valid.renameSavedArgumentCollection?.newName ??
      savedArgumentCollectionOpResult.valid.updateSavedArgumentCollectionTags?.name ??
      ""
    const result = applySavedArgumentCollectionOp(current, savedArgumentCollectionOpResult.valid)
    if (result.failure) {
      return NextResponse.json(
        { error: buildSavedArgumentCollectionFailureMessage(result.failure, opName) },
        { status: 400 },
      )
    }
    dbPatch.savedArgumentCollections = serializeSavedArgumentCollections(result.next)
  } else if (savedArgumentCollectionsResult.valid.savedArgumentCollections !== undefined) {
    dbPatch.savedArgumentCollections = serializeSavedArgumentCollections(
      savedArgumentCollectionsResult.valid.savedArgumentCollections,
    )
  }
  if (
    wordLimitPresetOpResult.valid.addWordLimitPreset !== undefined ||
    wordLimitPresetOpResult.valid.updateWordLimitPreset !== undefined ||
    wordLimitPresetOpResult.valid.removeWordLimitPreset !== undefined
  ) {
    // An add/update/remove op is resolved against the row's *current* stored
    // list rather than the caller's own copy — see this route's docstring
    // and `state/wordLimitPresets.ts#applyWordLimitPresetOp`. This closes
    // the same lost-update race a plain `wordLimitPresets` whole-list
    // replace is exposed to that `favoriteTools`'s op-based patch above
    // already fixed.
    const [existing] = await db
      .select({ wordLimitPresets: userSettings.wordLimitPresets })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
    const current = existing?.wordLimitPresets
      ? parseWordLimitPresets(existing.wordLimitPresets)
      : DEFAULT_WORD_LIMIT_PRESETS.wordLimitPresets
    const opName =
      wordLimitPresetOpResult.valid.addWordLimitPreset?.name ??
      wordLimitPresetOpResult.valid.updateWordLimitPreset?.name ??
      wordLimitPresetOpResult.valid.removeWordLimitPreset ??
      ""
    const result = applyWordLimitPresetOp(current, wordLimitPresetOpResult.valid)
    if (result.failure) {
      return NextResponse.json({ error: buildWordLimitPresetFailureMessage(result.failure, opName) }, { status: 400 })
    }
    dbPatch.wordLimitPresets = serializeWordLimitPresets(result.next)
  } else if (wordLimitPresetsResult.valid.wordLimitPresets !== undefined) {
    dbPatch.wordLimitPresets = serializeWordLimitPresets(wordLimitPresetsResult.valid.wordLimitPresets)
  }
  if (researchProgressGoalResult.valid.researchProgressGoal !== undefined) {
    dbPatch.researchProgressGoal = serializeResearchProgressGoal(researchProgressGoalResult.valid.researchProgressGoal)
  }
  if (questStreakFreezeOpResult.valid.recordStreakFreezeDayKey !== undefined) {
    // A single "spend a freeze on this day" op is resolved against the row's
    // *current* stored `questStreakSync` value rather than the caller's own
    // copy — see this route's docstring and
    // `quest-streak-sync.ts#applyQuestStreakFreezeOp`. This closes the same
    // lost-update race a plain `questStreakSync` whole-value replace is
    // exposed to that `favoriteTools`'s op-based patch above already fixed.
    const [existing] = await db
      .select({ questStreakSync: userSettings.questStreakSync })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
    const current = existing?.questStreakSync
      ? parseQuestStreakSync(existing.questStreakSync)
      : DEFAULT_QUEST_STREAK_SYNC.questStreakSync
    dbPatch.questStreakSync = serializeQuestStreakSync(
      applyQuestStreakFreezeOp(current, {
        recordStreakFreezeDayKey: questStreakFreezeOpResult.valid.recordStreakFreezeDayKey,
      }),
    )
  } else if (questStreakReminderOpResult.valid.setLapseReminderEnabled !== undefined) {
    // Same read-then-write shape as the freeze op above, resolved against
    // the row's current `questStreakSync` value rather than the caller's own
    // (possibly stale) copy, so a reminder toggle can never revert a freeze
    // spent moments earlier on another device.
    const [existing] = await db
      .select({ questStreakSync: userSettings.questStreakSync })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
    const current = existing?.questStreakSync
      ? parseQuestStreakSync(existing.questStreakSync)
      : DEFAULT_QUEST_STREAK_SYNC.questStreakSync
    dbPatch.questStreakSync = serializeQuestStreakSync(
      applyQuestStreakReminderOp(current, {
        setLapseReminderEnabled: questStreakReminderOpResult.valid.setLapseReminderEnabled,
      }),
    )
  } else if (questStreakSyncResult.valid.questStreakSync !== undefined) {
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
  if (brainstormSessionTimerResult.valid.brainstormSessionTimer !== undefined) {
    dbPatch.brainstormSessionTimer = serializeBrainstormSessionTimer(
      brainstormSessionTimerResult.valid.brainstormSessionTimer,
    )
  }
  if (newsReadOpResult.valid.recordNewsRead !== undefined) {
    // A single mark-read op is resolved against the row's *current* stored
    // list rather than the caller's own copy — see this route's docstring
    // and `news-stream-sync.ts#applyNewsReadOp`. This closes the same
    // lost-update race a plain `newsRead` whole-list replace is exposed to
    // that `favoriteTools`'s op-based patch above already fixed.
    const [existing] = await db
      .select({ newsRead: userSettings.newsRead })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
    const current = existing?.newsRead ? parseNewsIdList(existing.newsRead) : DEFAULT_NEWS_SYNC.newsRead
    dbPatch.newsRead = serializeNewsIdList(
      applyNewsReadOp(current, { recordNewsRead: newsReadOpResult.valid.recordNewsRead }),
    )
  } else if (newsSyncResult.valid.newsRead !== undefined) {
    dbPatch.newsRead = serializeNewsIdList(newsSyncResult.valid.newsRead)
  }
  if (newsLikedOpResult.valid.addNewsLiked !== undefined || newsLikedOpResult.valid.removeNewsLiked !== undefined) {
    // Same read-then-write shape as the newsRead op above, resolved against
    // the row's current `newsLiked` value rather than the caller's own
    // (possibly stale) copy.
    const [existing] = await db
      .select({ newsLiked: userSettings.newsLiked })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
    const current = existing?.newsLiked ? parseNewsIdList(existing.newsLiked) : DEFAULT_NEWS_SYNC.newsLiked
    dbPatch.newsLiked = serializeNewsIdList(applyNewsLikedOp(current, newsLikedOpResult.valid))
  } else if (newsSyncResult.valid.newsLiked !== undefined) {
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
