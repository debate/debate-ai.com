/**
 * Hand-written SDK layer over the types generated from debate-openapi.yml
 * (src/generated/types.gen.ts). Every function sends its request through
 * grab-url (src/client.ts) instead of raw fetch/axios, so caching, retries,
 * rate limiting, and dedupe apply per the client's grab defaults.
 *
 * Regenerate this file's companion types with `npm run generate`; this file
 * itself is hand-written (not overwritten by codegen) — see openapi-ts.config.ts.
 */
import { client as defaultClient, type Client, type RequestOptions } from "./client.js"
import type * as T from "./generated/types.gen.js"

export interface CallOptions {
  /** Use a specific client instance instead of the shared default. */
  client?: Client
  headers?: Record<string, string>
  /** Per-call grab-url option overrides (cache, retryAttempts, rateLimit, etc). */
  grab?: RequestOptions["grab"]
}

function call<TResponse>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  data: { path?: unknown; query?: unknown; body?: unknown },
  options?: CallOptions,
) {
  const c = options?.client ?? defaultClient
  return c.request<TResponse>({
    url,
    method,
    path: data.path as RequestOptions["path"],
    query: data.query as Record<string, unknown> | undefined,
    body: data.body,
    headers: options?.headers,
    grab: options?.grab,
  })
}

/** AI-powered debate card analysis — POST /analyze */
export function analyzeContent(data: Omit<T.AnalyzeContentData, "url">, options?: CallOptions) {
  return call<T.AnalyzeContentResponse>("POST", "/analyze", data, options)
}

/** Check whether a source URL has already been cut as a card — GET /evidence-reuse-check */
export function checkEvidenceReuse(data: Omit<T.CheckEvidenceReuseData, "url">, options?: CallOptions) {
  return call<T.CheckEvidenceReuseResponse>("GET", "/evidence-reuse-check", data, options)
}

/** Create a REASON editor document — POST /doc/documents */
export function createDocument(data: Omit<T.CreateDocumentData, "url">, options?: CallOptions) {
  return call<T.CreateDocumentResponse>("POST", "/doc/documents", data, options)
}

/** Delete every synced word-count round for the current user — DELETE /word-count-rounds */
export function deleteAllWordCountRounds(data: Omit<T.DeleteAllWordCountRoundsData, "url">, options?: CallOptions) {
  return call<T.DeleteAllWordCountRoundsResponse>("DELETE", "/word-count-rounds", data, options)
}

/** Delete one synced coach material — DELETE /coach-materials/{materialId} */
export function deleteCoachMaterial(data: Omit<T.DeleteCoachMaterialData, "url">, options?: CallOptions) {
  return call<T.DeleteCoachMaterialResponse>("DELETE", "/coach-materials/{materialId}", data, options)
}

/** Delete one synced coach-material version snapshot — DELETE /coach-material-versions/{versionId} */
export function deleteCoachMaterialVersion(data: Omit<T.DeleteCoachMaterialVersionData, "url">, options?: CallOptions) {
  return call<T.DeleteCoachMaterialVersionResponse>("DELETE", "/coach-material-versions/{versionId}", data, options)
}

/** Delete one synced counsel-panel assessment — DELETE /counsel-panel-assessments/{assessmentId} */
export function deleteCounselPanelAssessment(data: Omit<T.DeleteCounselPanelAssessmentData, "url">, options?: CallOptions) {
  return call<T.DeleteCounselPanelAssessmentResponse>("DELETE", "/counsel-panel-assessments/{assessmentId}", data, options)
}

/** Delete one synced Daily Best Card comment — DELETE /daily-best-card-comments/{commentId} */
export function deleteDailyBestCardComment(data: Omit<T.DeleteDailyBestCardCommentData, "url">, options?: CallOptions) {
  return call<T.DeleteDailyBestCardCommentResponse>("DELETE", "/daily-best-card-comments/{commentId}", data, options)
}

/** Delete a document — DELETE /doc/documents/{id} */
export function deleteDocument(data: Omit<T.DeleteDocumentData, "url">, options?: CallOptions) {
  return call<T.DeleteDocumentResponse>("DELETE", "/doc/documents/{id}", data, options)
}

/** Delete one saved flow — DELETE /flows/{clientId} */
export function deleteFlow(data: Omit<T.DeleteFlowData, "url">, options?: CallOptions) {
  return call<T.DeleteFlowResponse>("DELETE", "/flows/{clientId}", data, options)
}

/** Delete one synced judge decision — DELETE /judge-decisions/{decisionId} */
export function deleteJudgeDecision(data: Omit<T.DeleteJudgeDecisionData, "url">, options?: CallOptions) {
  return call<T.DeleteJudgeDecisionResponse>("DELETE", "/judge-decisions/{decisionId}", data, options)
}

/** Delete one saved round — DELETE /rounds/{clientId} */
export function deleteRound(data: Omit<T.DeleteRoundData, "url">, options?: CallOptions) {
  return call<T.DeleteRoundResponse>("DELETE", "/rounds/{clientId}", data, options)
}

/** Delete one synced round pairing — DELETE /round-pairings/{pairingId} */
export function deleteRoundPairing(data: Omit<T.DeleteRoundPairingData, "url">, options?: CallOptions) {
  return call<T.DeleteRoundPairingResponse>("DELETE", "/round-pairings/{pairingId}", data, options)
}

/** Delete one synced speech-document send-log entry — DELETE /speech-send-log/{entryId} */
export function deleteSpeechSendLogEntry(data: Omit<T.DeleteSpeechSendLogEntryData, "url">, options?: CallOptions) {
  return call<T.DeleteSpeechSendLogEntryResponse>("DELETE", "/speech-send-log/{entryId}", data, options)
}

/** Delete one synced strategy recommendation — DELETE /strategy-recommendations/{recommendationId} */
export function deleteStrategyRecommendation(data: Omit<T.DeleteStrategyRecommendationData, "url">, options?: CallOptions) {
  return call<T.DeleteStrategyRecommendationResponse>("DELETE", "/strategy-recommendations/{recommendationId}", data, options)
}

/** Delete one synced word-count round — DELETE /word-count-rounds/{roundId} */
export function deleteWordCountRound(data: Omit<T.DeleteWordCountRoundData, "url">, options?: CallOptions) {
  return call<T.DeleteWordCountRoundResponse>("DELETE", "/word-count-rounds/{roundId}", data, options)
}

/** List configured OAuth sign-in providers — GET /auth/providers */
export function getAuthProviders(data: Omit<T.GetAuthProvidersData, "url">, options?: CallOptions) {
  return call<T.GetAuthProvidersResponse>("GET", "/auth/providers", data, options)
}

/** Get historical debate topics and champions — GET /history */
export function getDebateHistory(data: Omit<T.GetDebateHistoryData, "url">, options?: CallOptions) {
  return call<T.GetDebateHistoryResponse>("GET", "/history", data, options)
}

/** Get the debate terminology dictionary — GET /dictionary */
export function getDictionary(data: Omit<T.GetDictionaryData, "url">, options?: CallOptions) {
  return call<T.GetDictionaryResponse>("GET", "/dictionary", data, options)
}

/** Get a single document — GET /doc/documents/{id} */
export function getDocument(data: Omit<T.GetDocumentData, "url">, options?: CallOptions) {
  return call<T.GetDocumentResponse>("GET", "/doc/documents/{id}", data, options)
}

/** Get one saved flow in full — GET /flows/{clientId} */
export function getFlow(data: Omit<T.GetFlowData, "url">, options?: CallOptions) {
  return call<T.GetFlowResponse>("GET", "/flows/{clientId}", data, options)
}

/** Get debate team rankings and leaderboard — GET /leaderboard */
export function getLeaderboard(data: Omit<T.GetLeaderboardData, "url">, options?: CallOptions) {
  return call<T.GetLeaderboardResponse>("GET", "/leaderboard", data, options)
}

/** Get one saved round in full — GET /rounds/{clientId} */
export function getRound(data: Omit<T.GetRoundData, "url">, options?: CallOptions) {
  return call<T.GetRoundResponse>("GET", "/rounds/{clientId}", data, options)
}

/** Get the current user's account-linked settings — GET /settings */
export function getUserSettings(data: Omit<T.GetUserSettingsData, "url">, options?: CallOptions) {
  return call<T.GetUserSettingsResponse>("GET", "/settings", data, options)
}

/** Get video library metadata — GET /videos/meta */
export function getVideoMeta(data: Omit<T.GetVideoMetaData, "url">, options?: CallOptions) {
  return call<T.GetVideoMetaResponse>("GET", "/videos/meta", data, options)
}

/** Report whether the videos table is seeded — GET /admin/videos/seed */
export function getVideoSeedStatus(data: Omit<T.GetVideoSeedStatusData, "url">, options?: CallOptions) {
  return call<T.GetVideoSeedStatusResponse>("GET", "/admin/videos/seed", data, options)
}

/** Get a YouTube video's transcript — GET /transcript */
export function getVideoTranscript(data: Omit<T.GetVideoTranscriptData, "url">, options?: CallOptions) {
  return call<T.GetVideoTranscriptResponse>("GET", "/transcript", data, options)
}

/** List recent YouTube resync runs (admin) — GET /admin/youtube/resync */
export function getYoutubeResyncRuns(data: Omit<T.GetYoutubeResyncRunsData, "url">, options?: CallOptions) {
  return call<T.GetYoutubeResyncRunsResponse>("GET", "/admin/youtube/resync", data, options)
}

/** Get bundled YouTube channel/video statistics — GET /youtube-stats */
export function getYoutubeStats(data: Omit<T.GetYoutubeStatsData, "url">, options?: CallOptions) {
  return call<T.GetYoutubeStatsResponse>("GET", "/youtube-stats", data, options)
}

/** Keyset-paginated list of stored round videos (admin) — GET /admin/youtube/videos */
export function listAdminYoutubeVideos(data: Omit<T.ListAdminYoutubeVideosData, "url">, options?: CallOptions) {
  return call<T.ListAdminYoutubeVideosResponse>("GET", "/admin/youtube/videos", data, options)
}

/** List the current user's synced coach-material version snapshots — GET /coach-material-versions */
export function listCoachMaterialVersions(data: Omit<T.ListCoachMaterialVersionsData, "url">, options?: CallOptions) {
  return call<T.ListCoachMaterialVersionsResponse>("GET", "/coach-material-versions", data, options)
}

/** List the current user's synced coach materials — GET /coach-materials */
export function listCoachMaterials(data: Omit<T.ListCoachMaterialsData, "url">, options?: CallOptions) {
  return call<T.ListCoachMaterialsResponse>("GET", "/coach-materials", data, options)
}

/** List the current user's synced counsel-panel assessments — GET /counsel-panel-assessments */
export function listCounselPanelAssessments(data: Omit<T.ListCounselPanelAssessmentsData, "url">, options?: CallOptions) {
  return call<T.ListCounselPanelAssessmentsResponse>("GET", "/counsel-panel-assessments", data, options)
}

/** List the current user's synced Daily Best Card comments — GET /daily-best-card-comments */
export function listDailyBestCardComments(data: Omit<T.ListDailyBestCardCommentsData, "url">, options?: CallOptions) {
  return call<T.ListDailyBestCardCommentsResponse>("GET", "/daily-best-card-comments", data, options)
}

/** List the current user's REASON editor documents — GET /doc/documents */
export function listDocuments(data: Omit<T.ListDocumentsData, "url">, options?: CallOptions) {
  return call<T.ListDocumentsResponse>("GET", "/doc/documents", data, options)
}

/** List the current user's saved flows (summaries) — GET /flows */
export function listFlows(data: Omit<T.ListFlowsData, "url">, options?: CallOptions) {
  return call<T.ListFlowsResponse>("GET", "/flows", data, options)
}

/** List the current user's synced judge decisions — GET /judge-decisions */
export function listJudgeDecisions(data: Omit<T.ListJudgeDecisionsData, "url">, options?: CallOptions) {
  return call<T.ListJudgeDecisionsResponse>("GET", "/judge-decisions", data, options)
}

/** Get the full list of human names — GET /names */
export function listNames(data: Omit<T.ListNamesData, "url">, options?: CallOptions) {
  return call<T.ListNamesResponse>("GET", "/names", data, options)
}

/** List the current user's synced round pairings — GET /round-pairings */
export function listRoundPairings(data: Omit<T.ListRoundPairingsData, "url">, options?: CallOptions) {
  return call<T.ListRoundPairingsResponse>("GET", "/round-pairings", data, options)
}

/** List the current user's saved rounds (summaries) — GET /rounds */
export function listRounds(data: Omit<T.ListRoundsData, "url">, options?: CallOptions) {
  return call<T.ListRoundsResponse>("GET", "/rounds", data, options)
}

/** Retrieve the cached list of debate schools — GET /schools */
export function listSchools(data: Omit<T.ListSchoolsData, "url">, options?: CallOptions) {
  return call<T.ListSchoolsResponse>("GET", "/schools", data, options)
}

/** List the current user's synced speech-document send-log entries — GET /speech-send-log */
export function listSpeechSendLog(data: Omit<T.ListSpeechSendLogData, "url">, options?: CallOptions) {
  return call<T.ListSpeechSendLogResponse>("GET", "/speech-send-log", data, options)
}

/** List the current user's synced strategy recommendations — GET /strategy-recommendations */
export function listStrategyRecommendations(data: Omit<T.ListStrategyRecommendationsData, "url">, options?: CallOptions) {
  return call<T.ListStrategyRecommendationsResponse>("GET", "/strategy-recommendations", data, options)
}

/** Retrieve the cached list of tournament names — GET /tournaments */
export function listTournaments(data: Omit<T.ListTournamentsData, "url">, options?: CallOptions) {
  return call<T.ListTournamentsResponse>("GET", "/tournaments", data, options)
}

/** List reported video issues — GET /video-issues */
export function listVideoIssues(data: Omit<T.ListVideoIssuesData, "url">, options?: CallOptions) {
  return call<T.ListVideoIssuesResponse>("GET", "/video-issues", data, options)
}

/** Get a page of debate videos — GET /videos */
export function listVideos(data: Omit<T.ListVideosData, "url">, options?: CallOptions) {
  return call<T.ListVideosResponse>("GET", "/videos", data, options)
}

/** List the current user's synced word-count rounds — GET /word-count-rounds */
export function listWordCountRounds(data: Omit<T.ListWordCountRoundsData, "url">, options?: CallOptions) {
  return call<T.ListWordCountRoundsResponse>("GET", "/word-count-rounds", data, options)
}

/** Pull live flow edits newer than a timestamp — GET /flow-sync */
export function pullFlowEdits(data: Omit<T.PullFlowEditsData, "url">, options?: CallOptions) {
  return call<T.PullFlowEditsResponse>("GET", "/flow-sync", data, options)
}

/** Push one live flow edit — POST /flow-sync */
export function pushFlowEdit(data: Omit<T.PushFlowEditData, "url">, options?: CallOptions) {
  return call<T.PushFlowEditResponse>("POST", "/flow-sync", data, options)
}

/** Server-proxied Anthropic Messages completion — POST /reason-ai */
export function reasonAiComplete(data: Omit<T.ReasonAiCompleteData, "url">, options?: CallOptions) {
  return call<T.ReasonAiCompleteResponse>("POST", "/reason-ai", data, options)
}

/** Register a cut card's source URL in the shared reuse index — POST /evidence-reuse-check */
export function registerEvidenceReuse(data: Omit<T.RegisterEvidenceReuseData, "url">, options?: CallOptions) {
  return call<T.RegisterEvidenceReuseResponse>("POST", "/evidence-reuse-check", data, options)
}

/** Report an issue with a video — POST /video-issues */
export function reportVideoIssue(data: Omit<T.ReportVideoIssueData, "url">, options?: CallOptions) {
  return call<T.ReportVideoIssueResponse>("POST", "/video-issues", data, options)
}

/** Trigger a full resync of round videos (admin) — POST /admin/youtube/resync */
export function resyncYoutubeVideos(data: Omit<T.ResyncYoutubeVideosData, "url">, options?: CallOptions) {
  return call<T.ResyncYoutubeVideosResponse>("POST", "/admin/youtube/resync", data, options)
}

/** Search debate research cards — GET /search */
export function searchCards(data: Omit<T.SearchCardsData, "url">, options?: CallOptions) {
  return call<T.SearchCardsResponse>("GET", "/search", data, options)
}

/** Load the bundled video assets into the videos table — POST /admin/videos/seed */
export function seedVideos(data: Omit<T.SeedVideosData, "url">, options?: CallOptions) {
  return call<T.SeedVideosResponse>("POST", "/admin/videos/seed", data, options)
}

/** Upsert one synced coach material — PUT /coach-materials/{materialId} */
export function syncCoachMaterial(data: Omit<T.SyncCoachMaterialData, "url">, options?: CallOptions) {
  return call<T.SyncCoachMaterialResponse>("PUT", "/coach-materials/{materialId}", data, options)
}

/** Upsert one synced coach-material version snapshot — PUT /coach-material-versions/{versionId} */
export function syncCoachMaterialVersion(data: Omit<T.SyncCoachMaterialVersionData, "url">, options?: CallOptions) {
  return call<T.SyncCoachMaterialVersionResponse>("PUT", "/coach-material-versions/{versionId}", data, options)
}

/** Upsert one synced counsel-panel assessment — PUT /counsel-panel-assessments/{assessmentId} */
export function syncCounselPanelAssessment(data: Omit<T.SyncCounselPanelAssessmentData, "url">, options?: CallOptions) {
  return call<T.SyncCounselPanelAssessmentResponse>("PUT", "/counsel-panel-assessments/{assessmentId}", data, options)
}

/** Upsert one synced Daily Best Card comment — PUT /daily-best-card-comments/{commentId} */
export function syncDailyBestCardComment(data: Omit<T.SyncDailyBestCardCommentData, "url">, options?: CallOptions) {
  return call<T.SyncDailyBestCardCommentResponse>("PUT", "/daily-best-card-comments/{commentId}", data, options)
}

/** Upsert one saved flow — PUT /flows/{clientId} */
export function syncFlow(data: Omit<T.SyncFlowData, "url">, options?: CallOptions) {
  return call<T.SyncFlowResponse>("PUT", "/flows/{clientId}", data, options)
}

/** Upsert one synced judge decision — PUT /judge-decisions/{decisionId} */
export function syncJudgeDecision(data: Omit<T.SyncJudgeDecisionData, "url">, options?: CallOptions) {
  return call<T.SyncJudgeDecisionResponse>("PUT", "/judge-decisions/{decisionId}", data, options)
}

/** Upsert one saved round — PUT /rounds/{clientId} */
export function syncRound(data: Omit<T.SyncRoundData, "url">, options?: CallOptions) {
  return call<T.SyncRoundResponse>("PUT", "/rounds/{clientId}", data, options)
}

/** Upsert one synced round pairing — PUT /round-pairings/{pairingId} */
export function syncRoundPairing(data: Omit<T.SyncRoundPairingData, "url">, options?: CallOptions) {
  return call<T.SyncRoundPairingResponse>("PUT", "/round-pairings/{pairingId}", data, options)
}

/** Upsert one synced speech-document send-log entry — PUT /speech-send-log/{entryId} */
export function syncSpeechSendLogEntry(data: Omit<T.SyncSpeechSendLogEntryData, "url">, options?: CallOptions) {
  return call<T.SyncSpeechSendLogEntryResponse>("PUT", "/speech-send-log/{entryId}", data, options)
}

/** Upsert one synced strategy recommendation — PUT /strategy-recommendations/{recommendationId} */
export function syncStrategyRecommendation(data: Omit<T.SyncStrategyRecommendationData, "url">, options?: CallOptions) {
  return call<T.SyncStrategyRecommendationResponse>("PUT", "/strategy-recommendations/{recommendationId}", data, options)
}

/** Sync debate videos from YouTube — GET /sync-videos */
export function syncVideos(data: Omit<T.SyncVideosData, "url">, options?: CallOptions) {
  return call<T.SyncVideosResponse>("GET", "/sync-videos", data, options)
}

/** Upsert one synced word-count round — PUT /word-count-rounds/{roundId} */
export function syncWordCountRound(data: Omit<T.SyncWordCountRoundData, "url">, options?: CallOptions) {
  return call<T.SyncWordCountRoundResponse>("PUT", "/word-count-rounds/{roundId}", data, options)
}

/** Update a document's title and/or content — PUT /doc/documents/{id} */
export function updateDocument(data: Omit<T.UpdateDocumentData, "url">, options?: CallOptions) {
  return call<T.UpdateDocumentResponse>("PUT", "/doc/documents/{id}", data, options)
}

/** Update one or more account-linked settings fields — PUT /settings */
export function updateUserSettings(data: Omit<T.UpdateUserSettingsData, "url">, options?: CallOptions) {
  return call<T.UpdateUserSettingsResponse>("PUT", "/settings", data, options)
}

