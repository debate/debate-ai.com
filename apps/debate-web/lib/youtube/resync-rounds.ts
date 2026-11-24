import { and, eq } from "drizzle-orm";
import {
  getChannelId,
  getVideosForChannel,
  fetchFullDescriptions,
  setYouTubeApiKey,
} from "@debate-ai/videos-admin/src/sync/youtube/youtube-api";
import { PARLI_CHANNELS, publishedAfter } from "@debate-ai/videos-admin/src/sync/youtube/channel-config";
import {
  parseDebateStyle,
  parseRoundLevel,
  parseTournament,
  parseTeams,
  parseWinner,
  parseJudgeDecision,
} from "@debate-ai/videos-admin/src/sync/youtube/parsers/round-parsers";
import { isRound } from "@debate-ai/videos-admin/src/sync/youtube/parsers/video-classifier";
import { classifyLecture } from "@debate-ai/videos/src/data/lecture-classifier";
import { getDBFromContext } from "../database/context";
import { describeError, retryD1Transient } from "../database/errors";
import { chunkStatements } from "../database/query-budget";
import { findPublishedVideoIds } from "../videos/publish-round-video";
import { ensureTableColumns } from "../database/ensure-columns";
import { youtubeChannels, youtubeRoundVideos, youtubeSyncRuns, youtubeVideoExclusions } from "../database/schema";
import { getEnv } from "../env";
import { listAdminChannels } from "./admin-channels";
import { ensureVideoExclusionsTable } from "./video-exclusions";
import { ensureRoundVideosTable, isStaleRoundVideosTableError, resetEnsuredRoundVideosTable } from "./round-videos-table";

/**
 * Which subscribed channels a scan walks. The daily cron scans `"active"`
 * ones (and `"all"` on Mondays), the channels tab's "Check defunct channels"
 * button scans `"defunct"` ones (see `isChannelDefunct` in
 * admin-channels.ts), the admin page's "Resync videos" button scans `"all"`,
 * and a row's "Check" button scans just that channel by row id — paused or
 * not, since an admin asked for it by name.
 */
export type ChannelScanScope = "all" | "active" | "defunct" | { channelId: number };

/** Newest `YYYY-MM-DD` upload date among a channel's fetched video tuples. */
function newestUploadDate(videos: any[]): string | null {
  let newest: string | null = null;
  for (const video of videos) {
    const date = video?.[2];
    if (typeof date === "string" && date && (!newest || date > newest)) newest = date;
  }
  return newest;
}

/**
 * Writes the per-channel bookkeeping a scan collected, batched, retrying
 * transient D1 faults. Best-effort: a batch that still fails is logged and
 * skipped, because these columns only steer the next scan and the channels
 * tab — losing them must not throw away the videos the scan just fetched.
 */
async function writeChannelUpdates(db: any, updates: { id: number; set: Record<string, unknown> }[]) {
  const statements = updates.map(({ id, set }) =>
    db.update(youtubeChannels).set(set).where(eq(youtubeChannels.id, id)),
  );
  for (const batch of chunkStatements(statements, 50)) {
    try {
      await retryD1Transient(() => db.batch(batch));
    } catch (error) {
      console.error("Failed to record YouTube channel check results:", describeError(error));
    }
  }
}

/**
 * Refetches every subscribed YouTube channel (see `youtube_channels` in
 * `lib/database/schema.ts` — the admin-managed list), classifies which videos
 * are debate rounds, and upserts them into the `youtube_round_videos` SQL
 * table so the admin page can page through up-to-date results without hitting
 * the YouTube API on every read.
 *
 * Runs synchronously within the request, matching the existing
 * `/api/admin/youtube/resync` endpoint's behavior — there is no background job
 * queue in this app, so the caller (the admin resync button) waits for it.
 *
 * A channel's YouTube id is resolved from its name here and written back, so
 * the admin never has to type an id — and a renamed channel keeps working
 * until the next scan re-resolves it.
 *
 * @param triggeredBy - Admin email, or the "cron" sentinel from
 *   `weekly-sync.ts` when the daily scan cron started the run.
 * @param publishedAfterDate - Optional `YYYY-MM-DD` floor. When omitted (the
 *   daily cron path) the module-level default from `channel-config.ts` is
 *   used; the admin page's date chooser passes its own value so a manual
 *   resync can reach further back or narrow the window without a redeploy.
 * @param scope - Which channels to walk. See {@link ChannelScanScope}.
 */
export async function resyncYouTubeRounds(
  triggeredBy: string | null,
  publishedAfterDate?: string,
  scope: ChannelScanScope = "all",
) {
  const apiKey = getEnv("YOUTUBE_API_KEY");
  if (!apiKey) {
    throw new Error("YouTube API key not configured");
  }
  // The API client is shared with the sync CLI, which reads the key from
  // `process.env` at import. That is empty inside the Worker, where the key
  // arrives on the request's `env` binding — so hand it over before the
  // first request rather than letting every batch go out unauthenticated.
  setYouTubeApiKey(apiKey);

  // Fall back to the module-level default floor (`publishedAfter` from
  // channel-config.ts) when the caller — the daily scan cron — did not pass an
  // explicit cutoff. The admin page supplies one from its date chooser so a
  // manual resync can reach further back *or* narrow the window without
  // touching deployed code.
  const cutoff = publishedAfterDate ?? publishedAfter;

  const db = await getDBFromContext();
  // `youtube_channels.title` postdates the table; add it before the select()
  // below names it. See lib/database/ensure-columns.ts.
  await ensureTableColumns(db, youtubeChannels);
  // Videos staff deleted from the queue are read below and skipped; make sure
  // the table exists so a fresh database does not fail the whole scan.
  await ensureVideoExclusionsTable(db);
  // Lectures share the queue: `category` and a nullable `style` postdate the
  // table, so bring an older database up to the schema before the upserts.
  await ensureRoundVideosTable(db);
  // Subscribe the parliamentary channels the Parli shelf draws on. A row that
  // already exists (paused or renamed by an admin) is left alone.
  if (PARLI_CHANNELS.length > 0) {
    await db
      .insert(youtubeChannels)
      .values(PARLI_CHANNELS.map((name) => ({ name, addedBy: "parli-seed" })))
      .onConflictDoNothing({ target: youtubeChannels.name });
  }

  const [run] = await db
    .insert(youtubeSyncRuns)
    .values({ status: "running", triggeredBy })
    .returning();

  try {
    // Read before the channel loop, not after it. Every video fetched below is
    // filtered against this set, so a database that cannot answer the query is
    // fatal either way — and asking first means the run fails in milliseconds
    // instead of after ~35 channels' worth of YouTube API calls. (It read
    // *after* the loop until a missing `youtube_video_exclusions` table turned
    // every resync into a 30-second request that ended in a 500.)
    const excludedIds = new Set(
      (await db.select({ videoId: youtubeVideoExclusions.videoId }).from(youtubeVideoExclusions))
        .map((row: { videoId: string }) => row.videoId),
    );

    const allVideos: any[] = [];
    let channelsSynced = 0;

    // Scan every enabled channel, resolving each one's YouTube id from its
    // name and writing it back so the next scan skips the lookup. A channel
    // the API does not know about is skipped rather than failing the run —
    // the channels tab is where a typo gets noticed.
    let subscribed = await db
      .select()
      .from(youtubeChannels)
      .where(
        typeof scope === "object"
          ? eq(youtubeChannels.id, scope.channelId)
          : eq(youtubeChannels.enabled, true),
      );
    if (typeof scope !== "object") {
      const listed = new Map((await listAdminChannels(db)).channels.map((channel) => [channel.id, channel]));
      if (scope !== "all") {
        const wantDefunct = scope === "defunct";
        subscribed = subscribed.filter(
          (channelRow: { id: number }) => listed.get(channelRow.id)?.defunct === wantDefunct,
        );
      }
      // Channels with no videos stored yet go first, so a run that dies part
      // way (a timeout, a spent API quota) has still tried the ones that most
      // need it. The sort is stable, so the rest keep their order.
      const hasVideos = (channelRow: { id: number }) => ((listed.get(channelRow.id)?.videoCount ?? 0) > 0 ? 1 : 0);
      subscribed = [...subscribed].sort((a: { id: number }, b: { id: number }) => hasVideos(a) - hasVideos(b));
    }


    // Each channel's bookkeeping (resolved id, display title, newest upload,
    // last-checked time) is collected here and written in a few batched
    // statements once the walk ends, rather than up to three writes per
    // channel inside it. A dropped D1 connection on one of those writes
    // ("Network connection lost") used to fail the whole scan after every
    // channel's YouTube calls had already been spent.
    const channelUpdates: { id: number; set: Record<string, unknown> }[] = [];

    try {
      for (const channelRow of subscribed) {
        const set: Record<string, unknown> = {};
        const channelId = await getChannelId(channelRow.name);
        if (channelId && channelId !== channelRow.channelId) {
          set.channelId = channelId;
          set.updatedAt = new Date();
        }
        if (!channelId) {
          if (Object.keys(set).length > 0) channelUpdates.push({ id: channelRow.id, set });
          continue;
        }
        const videos = await getVideosForChannel(channelId, channelRow.name, cutoff);
        // Video rows carry the channel's display title, not its handle; keep it
        // on the channel row so the admin list can count each channel's videos.
        const title = videos[0]?.[3];
        if (typeof title === "string" && title && title !== channelRow.title) {
          set.title = title;
        }
        // Record the newest upload, round or not, so the channels tab can tell
        // an active channel from a defunct one — and a defunct channel that
        // uploads again moves back to active on this very scan.
        const newestUpload = newestUploadDate(videos);
        if (newestUpload && (!channelRow.lastUploadAt || newestUpload > channelRow.lastUploadAt)) {
          set.lastUploadAt = newestUpload;
        }
        set.lastCheckedAt = new Date();
        channelUpdates.push({ id: channelRow.id, set });
        allVideos.push(...videos);
        channelsSynced++;
      }
    } finally {
      // Runs even when a YouTube call threw part way, so the channels that
      // were checked still record it.
      await writeChannelUpdates(db, channelUpdates);
    }

    const truncatedIds = allVideos.filter((v) => v[5]?.endsWith("...")).map((v) => v[0]);
    if (truncatedIds.length > 0) {
      const fullDescriptions = await fetchFullDescriptions(truncatedIds);
      for (const video of allVideos) {
        if (fullDescriptions[video[0]] !== undefined && video[5]?.endsWith("...")) {
          video[5] = fullDescriptions[video[0]];
        }
      }
    }

    let videosUpserted = 0;
    let roundsUpserted = 0;
    let lecturesUpserted = 0;

    // A channel can surface a video more than once. Deduplicate before the
    // upsert, and honour admin removals across every future resync.
    const uniqueVideos = new Map<string, any>();
    for (const video of allVideos) {
      if (typeof video[0] === "string" && !excludedIds.has(video[0])) uniqueVideos.set(video[0], video);
    }

    const uniqueVideoIds = Array.from(uniqueVideos.keys()).filter((id): id is string => typeof id === "string");
    const alreadyPublished = await findPublishedVideoIds(db, uniqueVideoIds);

    const upserts: any[] = [];
    for (const video of uniqueVideos.values()) {
      const [id, title, date, channel, views, desc] = video;
      if (alreadyPublished.has(id)) continue;

      if (isRound(title, desc)) {
        const style = parseDebateStyle(title, channel);
        const tournament = parseTournament(title);
        const roundLevel = parseRoundLevel(title);
        const { aff, neg } = parseTeams(title);
        const winner = parseWinner(desc);
        const judgeDecision = parseJudgeDecision(desc);

        const values = {
          id,
          title,
          publishedAt: date,
          channel,
          views,
          description: desc,
          style,
          category: null,
          tournament,
          roundLevel,
          aff,
          neg,
          winner,
          judgeDecision,
        };

        // On conflict (the video was already in the queue from a prior scan),
        // only refresh `views` — a live count that genuinely drifts — and bump
        // `updatedAt`. Every other column (title, description, and the parsed
        // fields like aff/neg/tournament/style) is left as-is so a re-scan that
        // re-walks the channel can never silently overwrite existing data,
        // whether parser-derived or admin-corrected.
        upserts.push(
          db
            .insert(youtubeRoundVideos)
            .values(values)
            .onConflictDoUpdate({
              target: youtubeRoundVideos.id,
              set: { views: values.views, updatedAt: new Date() },
            }),
        );
        roundsUpserted++;
      } else {
        const category = classifyLecture(title, desc, channel);
        const values = {
          id,
          title,
          publishedAt: date,
          channel,
          views,
          description: desc,
          style: null,
          category,
          tournament: null,
          roundLevel: null,
          aff: null,
          neg: null,
          winner: null,
          judgeDecision: null,
        };

        upserts.push(
          db
            .insert(youtubeRoundVideos)
            .values(values)
            .onConflictDoUpdate({
              target: youtubeRoundVideos.id,
              set: { views: values.views, updatedAt: new Date() },
            }),
        );
        lecturesUpserted++;
      }
    }

    // One `db.batch()` per hundred upserts instead of one round trip each: a
    // full "all channels" scan surfaces thousands of rounds, which used to be
    // thousands of sequential writes against D1's per-invocation query budget.
    // A batch is a single transaction of upserts, so replaying it after a
    // dropped connection is safe.
    for (const batch of chunkStatements(upserts)) {
      try {
        await retryD1Transient(() => db.batch(batch as [any, ...any[]]));
      } catch (error) {
        // The table check above is memoized per isolate; if the table is still
        // out of date (another isolate's check, a lagging replica), upgrade it
        // again for real and replay this batch once. A batch is one
        // transaction, so the failed attempt wrote nothing.
        if (!isStaleRoundVideosTableError(error)) throw error;
        resetEnsuredRoundVideosTable();
        await ensureRoundVideosTable(db);
        await retryD1Transient(() => db.batch(batch as [any, ...any[]]));
      }
      videosUpserted += batch.length;
    }

    await db
      .update(youtubeSyncRuns)
      .set({
        status: "success",
        finishedAt: new Date(),
        channelsSynced,
        videosFetched: allVideos.length,
        videosUpserted,
      })
      .where(eq(youtubeSyncRuns.id, run.id));

    return {
      success: true,
      runId: run.id,
      channelsSynced,
      videosFetched: allVideos.length,
      videosUpserted,
      roundsUpserted,
      lecturesUpserted,
    };
  } catch (error) {
    try {
      await db
        .update(youtubeSyncRuns)
        .set({
          status: "error",
          finishedAt: new Date(),
          // `describeError` keeps the driver's own complaint (e.g. "no such
          // table: …"), which Drizzle hides behind its "Failed query: …"
          // wrapper.
          error: describeError(error).slice(0, 1000),
        })
        .where(eq(youtubeSyncRuns.id, run.id));
    } catch (bookkeepingError) {
      // Recording the failure must never replace it: whatever broke the run is
      // the error the caller needs to see, not our inability to write it down.
      console.error("Failed to record YouTube resync failure:", describeError(bookkeepingError));
    }

    throw error;
  }
}
