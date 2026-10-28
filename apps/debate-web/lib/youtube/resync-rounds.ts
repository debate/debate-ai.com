import { and, eq } from "drizzle-orm";
import {
  getChannelId,
  getVideosForChannel,
  fetchFullDescriptions,
  setYouTubeApiKey,
} from "@debate-ai/videos-admin/src/sync/youtube/youtube-api";
import { publishedAfter } from "@debate-ai/videos-admin/src/sync/youtube/channel-config";
import {
  parseDebateStyle,
  parseRoundLevel,
  parseTournament,
  parseTeams,
  parseWinner,
  parseJudgeDecision,
} from "@debate-ai/videos-admin/src/sync/youtube/parsers/round-parsers";
import { isRound } from "@debate-ai/videos-admin/src/sync/youtube/parsers/video-classifier";
import { getDBFromContext } from "../database/context";
import { describeError } from "../database/errors";
import { findPublishedVideoIds } from "../videos/publish-round-video";
import { ensureTableColumns } from "../database/ensure-columns";
import { youtubeChannels, youtubeRoundVideos, youtubeSyncRuns, youtubeVideoExclusions } from "../database/schema";
import { getEnv } from "../env";
import { listAdminChannels } from "./admin-channels";

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


    for (const channelRow of subscribed) {
      const channelId = await getChannelId(channelRow.name);
      if (channelId && channelId !== channelRow.channelId) {
        await db
          .update(youtubeChannels)
          .set({ channelId, updatedAt: new Date() })
          .where(eq(youtubeChannels.id, channelRow.id));
      }
      if (!channelId) continue;
      const videos = await getVideosForChannel(channelId, channelRow.name, cutoff);
      // Video rows carry the channel's display title, not its handle; keep it
      // on the channel row so the admin list can count each channel's videos.
      const title = videos[0]?.[3];
      if (typeof title === "string" && title && title !== channelRow.title) {
        await db.update(youtubeChannels).set({ title }).where(eq(youtubeChannels.id, channelRow.id));
      }
      // Record the newest upload, round or not, so the channels tab can tell
      // an active channel from a defunct one — and a defunct channel that
      // uploads again moves back to active on this very scan.
      const newestUpload = newestUploadDate(videos);
      const activity: Record<string, unknown> = {};
      if (newestUpload && (!channelRow.lastUploadAt || newestUpload > channelRow.lastUploadAt)) {
        activity.lastUploadAt = newestUpload;
      }
      activity.lastCheckedAt = new Date();
      await db.update(youtubeChannels).set(activity).where(eq(youtubeChannels.id, channelRow.id));
      allVideos.push(...videos);
      channelsSynced++;
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

    // A channel can surface a video more than once. Deduplicate before the
    // upsert, and honour admin removals across every future resync.
    const uniqueVideos = new Map<string, any>();
    for (const video of allVideos) {
      if (typeof video[0] === "string" && !excludedIds.has(video[0])) uniqueVideos.set(video[0], video);
    }

    const uniqueVideoIds = Array.from(uniqueVideos.keys()).filter((id): id is string => typeof id === "string");
    const alreadyPublished = await findPublishedVideoIds(db, uniqueVideoIds);

    for (const video of uniqueVideos.values()) {
      const [id, title, date, channel, views, desc] = video;
      if (alreadyPublished.has(id)) continue;
      if (!isRound(title, desc)) continue;

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
      await db
        .insert(youtubeRoundVideos)
        .values(values)
        .onConflictDoUpdate({
          target: youtubeRoundVideos.id,
          set: { views: values.views, updatedAt: new Date() },
        });

      videosUpserted++;
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
