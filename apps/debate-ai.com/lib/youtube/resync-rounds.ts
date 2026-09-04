import { eq } from "drizzle-orm";
import {
  getChannelId,
  getVideosForChannel,
  fetchFullDescriptions,
} from "debate-data-sync/src/youtube/youtube-api";
import { channels, publishedAfter } from "debate-data-sync/src/youtube/channel-config";
import {
  parseDebateStyle,
  parseRoundLevel,
  parseTournament,
  parseTeams,
  parseWinner,
  parseJudgeDecision,
} from "debate-data-sync/src/youtube/parsers/round-parsers";
import { isRound } from "debate-data-sync/src/youtube/parsers/video-classifier";
import { getDBFromContext } from "../database/context";
import { youtubeRoundVideos, youtubeSyncRuns, youtubeVideoExclusions } from "../database/schema";
import { getEnv } from "../env";

/**
 * Refetches every subscribed YouTube channel (see channel-config.ts),
 * classifies which videos are debate rounds, and upserts them into the
 * `youtube_round_videos` SQL table so the admin page can page through
 * up-to-date results without hitting the YouTube API on every read.
 *
 * Runs synchronously within the request, matching the existing
 * `/api/sync-videos` endpoint's behavior — there is no background job queue
 * in this app, so the caller (the admin resync button) waits for it.
 */
export async function resyncYouTubeRounds(triggeredBy: string | null) {
  if (!getEnv("YOUTUBE_API_KEY")) {
    throw new Error("YouTube API key not configured");
  }

  const db = await getDBFromContext();

  const [run] = await db
    .insert(youtubeSyncRuns)
    .values({ status: "running", triggeredBy })
    .returning();

  try {
    const allVideos: any[] = [];
    let channelsSynced = 0;

    for (const channelName of channels) {
      const channelId = await getChannelId(channelName);
      if (!channelId) continue;
      const videos = await getVideosForChannel(channelId, channelName, publishedAfter);
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
    const excludedIds = new Set(
      (await db.select({ videoId: youtubeVideoExclusions.videoId }).from(youtubeVideoExclusions))
        .map((row) => row.videoId),
    );

    // A channel can surface a video more than once. Deduplicate before the
    // upsert, and honour admin removals across every future resync.
    const uniqueVideos = new Map<string, any>();
    for (const video of allVideos) {
      if (typeof video[0] === "string" && !excludedIds.has(video[0])) uniqueVideos.set(video[0], video);
    }

    for (const video of uniqueVideos.values()) {
      const [id, title, date, channel, views, desc] = video;
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

      await db
        .insert(youtubeRoundVideos)
        .values(values)
        .onConflictDoUpdate({
          target: youtubeRoundVideos.id,
          set: { ...values, updatedAt: new Date() },
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
    await db
      .update(youtubeSyncRuns)
      .set({
        status: "error",
        finishedAt: new Date(),
        error: (error as Error).message,
      })
      .where(eq(youtubeSyncRuns.id, run.id));

    throw error;
  }
}
