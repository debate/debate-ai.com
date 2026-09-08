import { beforeEach, describe, expect, it, vi } from "vitest"

const grabMock = vi.fn()

vi.mock("grab-url", () => ({
  default: (...args: unknown[]) => grabMock(...args),
}))

const { createClient, DEFAULT_BASE_URL } = await import("../src/client")
const sdk = (await import("../src/sdk")) as unknown as Record<
  string,
  (data: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>
>

/**
 * Every SDK function is one line: the method and the OpenAPI path it sends
 * under. That line is the only thing about it that can be wrong, and a
 * transposed pair between two neighbouring endpoints reads correctly at every
 * call site, so the whole table is checked rather than a sample of it.
 */
const ENDPOINTS: [name: string, method: string, url: string][] = [
["analyzeContent", "POST", "/analyze"],
    ["checkEvidenceReuse", "GET", "/evidence-reuse-check"],
    ["createDocument", "POST", "/doc/documents"],
    ["deleteAllWordCountRounds", "DELETE", "/word-count-rounds"],
    ["deleteCoachMaterial", "DELETE", "/coach-materials/{materialId}"],
    ["deleteCoachMaterialVersion", "DELETE", "/coach-material-versions/{versionId}"],
    ["deleteCounselPanelAssessment", "DELETE", "/counsel-panel-assessments/{assessmentId}"],
    ["deleteDailyBestCardComment", "DELETE", "/daily-best-card-comments/{commentId}"],
    ["deleteDocument", "DELETE", "/doc/documents/{id}"],
    ["deleteFlow", "DELETE", "/flows/{clientId}"],
    ["deleteJudgeDecision", "DELETE", "/judge-decisions/{decisionId}"],
    ["deleteRound", "DELETE", "/rounds/{clientId}"],
    ["deleteRoundPairing", "DELETE", "/round-pairings/{pairingId}"],
    ["deleteSpeechSendLogEntry", "DELETE", "/speech-send-log/{entryId}"],
    ["deleteStrategyRecommendation", "DELETE", "/strategy-recommendations/{recommendationId}"],
    ["deleteWordCountRound", "DELETE", "/word-count-rounds/{roundId}"],
    ["getAuthProviders", "GET", "/auth/providers"],
    ["getDebateHistory", "GET", "/history"],
    ["getDictionary", "GET", "/dictionary"],
    ["getDocument", "GET", "/doc/documents/{id}"],
    ["getFlow", "GET", "/flows/{clientId}"],
    ["getLeaderboard", "GET", "/leaderboard"],
    ["getRound", "GET", "/rounds/{clientId}"],
    ["getUserSettings", "GET", "/settings"],
    ["getVideoMeta", "GET", "/videos/meta"],
    ["getVideoSeedStatus", "GET", "/admin/videos/seed"],
    ["getVideoTranscript", "GET", "/transcript"],
    ["getYoutubeResyncRuns", "GET", "/admin/youtube/resync"],
    ["getYoutubeStats", "GET", "/youtube-stats"],
    ["listAdminYoutubeVideos", "GET", "/admin/youtube/videos"],
    ["listCoachMaterialVersions", "GET", "/coach-material-versions"],
    ["listCoachMaterials", "GET", "/coach-materials"],
    ["listCounselPanelAssessments", "GET", "/counsel-panel-assessments"],
    ["listDailyBestCardComments", "GET", "/daily-best-card-comments"],
    ["listDocuments", "GET", "/doc/documents"],
    ["listFlows", "GET", "/flows"],
    ["listJudgeDecisions", "GET", "/judge-decisions"],
    ["listNames", "GET", "/names"],
    ["listRoundPairings", "GET", "/round-pairings"],
    ["listRounds", "GET", "/rounds"],
    ["listSchools", "GET", "/schools"],
    ["listSpeechSendLog", "GET", "/speech-send-log"],
    ["listStrategyRecommendations", "GET", "/strategy-recommendations"],
    ["listTournaments", "GET", "/tournaments"],
    ["listVideoIssues", "GET", "/video-issues"],
    ["listVideos", "GET", "/videos"],
    ["listWordCountRounds", "GET", "/word-count-rounds"],
    ["pullFlowEdits", "GET", "/flow-sync"],
    ["pushFlowEdit", "POST", "/flow-sync"],
    ["reasonAiComplete", "POST", "/reason-ai"],
    ["registerEvidenceReuse", "POST", "/evidence-reuse-check"],
    ["reportVideoIssue", "POST", "/video-issues"],
    ["resyncYoutubeVideos", "POST", "/admin/youtube/resync"],
    ["searchCards", "GET", "/search"],
    ["seedVideos", "POST", "/admin/videos/seed"],
    ["syncCoachMaterial", "PUT", "/coach-materials/{materialId}"],
    ["syncCoachMaterialVersion", "PUT", "/coach-material-versions/{versionId}"],
    ["syncCounselPanelAssessment", "PUT", "/counsel-panel-assessments/{assessmentId}"],
    ["syncDailyBestCardComment", "PUT", "/daily-best-card-comments/{commentId}"],
    ["syncFlow", "PUT", "/flows/{clientId}"],
    ["syncJudgeDecision", "PUT", "/judge-decisions/{decisionId}"],
    ["syncRound", "PUT", "/rounds/{clientId}"],
    ["syncRoundPairing", "PUT", "/round-pairings/{pairingId}"],
    ["syncSpeechSendLogEntry", "PUT", "/speech-send-log/{entryId}"],
    ["syncStrategyRecommendation", "PUT", "/strategy-recommendations/{recommendationId}"],
    ["syncVideos", "GET", "/sync-videos"],
    ["syncWordCountRound", "PUT", "/word-count-rounds/{roundId}"],
    ["updateDocument", "PUT", "/doc/documents/{id}"],
    ["updateUserSettings", "PUT", "/settings"],
]

describe("the SDK surface", () => {
  beforeEach(() => {
    grabMock.mockReset()
    grabMock.mockResolvedValue({ data: null })
  })

  it("exports a function per endpoint and nothing extra", () => {
    const exported = Object.keys(sdk).filter((k) => typeof sdk[k] === "function")
    expect(exported.sort()).toEqual(ENDPOINTS.map(([name]) => name).sort())
  })

  it.each(ENDPOINTS)("%s sends %s to its own path", async (name, method, url) => {
    const client = createClient()
    await sdk[name]({}, { client })

    expect(grabMock).toHaveBeenCalledTimes(1)
    const [sentUrl, options] = grabMock.mock.calls[0]
    // A GET or DELETE with no query appends nothing, so the path is sent whole.
    expect(sentUrl).toBe(url)
    expect(options.method).toBe(method)
  })

  it("gives every endpoint a distinct method and path pair", () => {
    const pairs = ENDPOINTS.map(([, method, url]) => `${method} ${url}`)
    expect(new Set(pairs).size).toBe(pairs.length)
  })

  it("routes through the shared default client when no client is given", async () => {
    await sdk.analyzeContent({ body: { url: "https://example.com" } })
    expect(grabMock.mock.calls[0][1].baseURL).toBe(DEFAULT_BASE_URL)
  })

  it("passes path params, query and body through to the request", async () => {
    const client = createClient()
    await sdk.deleteCoachMaterial({ path: { materialId: "m1" } }, { client })
    expect(grabMock.mock.calls[0][0]).toBe("/coach-materials/m1")

    grabMock.mockClear()
    await sdk.checkEvidenceReuse({ query: { url: "https://example.com/a" } }, { client })
    expect(grabMock.mock.calls[0][0]).toBe(
      "/evidence-reuse-check?url=https%3A%2F%2Fexample.com%2Fa",
    )

    grabMock.mockClear()
    await sdk.analyzeContent({ body: { text: "a card" } }, { client })
    expect(grabMock.mock.calls[0][1].body).toBe(JSON.stringify({ text: "a card" }))
  })

  it("forwards per-call headers and grab overrides", async () => {
    const client = createClient({ headers: { "x-base": "1" } })
    await sdk.getUserSettings({}, { client, headers: { "x-call": "2" }, grab: { retryAttempts: 3 } })
    const options = grabMock.mock.calls[0][1]
    expect(options.headers).toEqual({ "x-base": "1", "x-call": "2" })
    expect(options.retryAttempts).toBe(3)
  })

  it("hands a grab error back rather than throwing", async () => {
    grabMock.mockResolvedValue({ error: "HTTP error: 500" })
    const client = createClient()
    await expect(sdk.getUserSettings({}, { client })).resolves.toEqual({
      error: "HTTP error: 500",
    })
  })
})
