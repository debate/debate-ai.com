import { promises as fs } from "fs";
import path from "path";

/**
 * Calculate total YouTube video views by channel, debate style, and year
 * @returns Object containing view statistics organized by channel, debate style, and year
 */
export async function calculateYouTubeViewStats() {
  const dataDir = path.join(process.cwd(), "lib", "debate-data");

  // Load debate rounds videos (format: [videoId, title, date, channel, views, description, debateStyle, ...])
  const roundsPath = path.join(dataDir, "debate-rounds-videos.json");
  const roundsData = JSON.parse(await fs.readFile(roundsPath, "utf-8"));

  // Load debate lectures (format: [videoId, title, date, channel, views, description, debateStyle])
  const lecturesPath = path.join(dataDir, "debate-lectures.json");
  const lecturesData = JSON.parse(await fs.readFile(lecturesPath, "utf-8"));

  // Initialize statistics objects
  const statsByChannel: Record<string, {
    totalViews: number;
    videoCount: number;
  }> = {};

  const statsByDebateStyle: Record<string, {
    totalViews: number;
    videoCount: number;
    byChannel: Record<string, { views: number; count: number }>;
  }> = {};

  const statsByYear: Record<string, {
    totalViews: number;
    videoCount: number;
  }> = {};

  const statsByElimRound: Record<string, {
    totalViews: number;
    videoCount: number;
  }> = {};

  // Helper function to normalize elimination round names
  const normalizeElimRound = (roundName: string): string | null => {
    const lower = roundName.toLowerCase();

    if (lower.includes('final') && !lower.includes('semi')) return 'Finals';
    if (lower.includes('semi')) return 'Semifinals';
    if (lower.includes('quarter')) return 'Quarterfinals';
    if (lower.includes('octa') || lower.includes('octo')) return 'Octafinals';
    if (lower.includes('double')) return 'Double Octafinals';

    return null; // Not an elim round
  };

  // Helper function to process video data
  const processVideos = (videos: any[], hasDebateStyle: boolean) => {
    for (const video of videos) {
      const channel = video[3]; // channel name
      const views = Number(video[4]) || 0; // view count
      const debateStyle = hasDebateStyle ? (video[6] || "unknown") : "unknown";
      const date = video[2]; // date in YYYY-MM-DD format
      const year = date ? date.split("-")[0] : "unknown";
      const roundName = video[8]; // round name (e.g., "Finals", "Semis", "Quarters")

      // Initialize channel stats if needed
      if (!statsByChannel[channel]) {
        statsByChannel[channel] = {
          totalViews: 0,
          videoCount: 0,
        };
      }

      // Initialize debate style stats if needed
      if (!statsByDebateStyle[debateStyle]) {
        statsByDebateStyle[debateStyle] = {
          totalViews: 0,
          videoCount: 0,
          byChannel: {},
        };
      }

      // Initialize year stats if needed
      if (!statsByYear[year]) {
        statsByYear[year] = {
          totalViews: 0,
          videoCount: 0,
        };
      }

      // Process elimination rounds
      if (roundName) {
        const normalizedRound = normalizeElimRound(roundName);
        if (normalizedRound) {
          if (!statsByElimRound[normalizedRound]) {
            statsByElimRound[normalizedRound] = {
              totalViews: 0,
              videoCount: 0,
            };
          }
          statsByElimRound[normalizedRound].totalViews += views;
          statsByElimRound[normalizedRound].videoCount += 1;
        }
      }

      // Update channel statistics
      statsByChannel[channel].totalViews += views;
      statsByChannel[channel].videoCount += 1;

      // Update debate style statistics
      statsByDebateStyle[debateStyle].totalViews += views;
      statsByDebateStyle[debateStyle].videoCount += 1;

      if (!statsByDebateStyle[debateStyle].byChannel[channel]) {
        statsByDebateStyle[debateStyle].byChannel[channel] = { views: 0, count: 0 };
      }
      statsByDebateStyle[debateStyle].byChannel[channel].views += views;
      statsByDebateStyle[debateStyle].byChannel[channel].count += 1;

      // Update year statistics
      statsByYear[year].totalViews += views;
      statsByYear[year].videoCount += 1;
    }
  };

  // Process both rounds and lectures
  processVideos(roundsData.data, true);
  processVideos(lecturesData.data, true);

  // Calculate totals
  const totalViews = Object.values(statsByChannel).reduce(
    (sum, channel) => sum + channel.totalViews,
    0
  );
  const totalVideos = Object.values(statsByChannel).reduce(
    (sum, channel) => sum + channel.videoCount,
    0
  );

  // Sort channels by total views (descending)
  const channelsSorted = Object.entries(statsByChannel)
    .sort(([, a], [, b]) => b.totalViews - a.totalViews)
    .map(([channel, stats]) => ({
      channel,
      ...stats,
      avgViewsPerVideo: Math.round(stats.totalViews / stats.videoCount),
    }));

  // Sort debate styles by total views (descending)
  const debateStylesSorted = Object.entries(statsByDebateStyle)
    .sort(([, a], [, b]) => b.totalViews - a.totalViews)
    .map(([debateStyle, stats]) => ({
      debateStyle,
      ...stats,
      avgViewsPerVideo: Math.round(stats.totalViews / stats.videoCount),
    }));

  // Sort years (chronologically)
  const yearsSorted = Object.entries(statsByYear)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, stats]) => ({
      year,
      ...stats,
      avgViewsPerVideo: Math.round(stats.totalViews / stats.videoCount),
    }));

  // Sort elimination rounds by typical tournament order
  const elimRoundOrder = ['Finals', 'Semifinals', 'Quarterfinals', 'Octafinals', 'Double Octafinals'];
  const elimRoundsSorted = elimRoundOrder
    .filter(round => statsByElimRound[round])
    .map((round) => ({
      round,
      ...statsByElimRound[round],
      avgViewsPerVideo: Math.round(statsByElimRound[round].totalViews / statsByElimRound[round].videoCount),
    }));

  // Console log views and averages by year
  console.log("\n=== YouTube Video Statistics by Year ===");
  console.log(`Total Videos: ${totalVideos.toLocaleString()}`);
  console.log(`Total Views: ${totalViews.toLocaleString()}`);
  console.log("\nYearly Breakdown:");
  yearsSorted.forEach(({ year, totalViews, videoCount, avgViewsPerVideo }) => {
    console.log(
      `  ${year}: ${totalViews.toLocaleString()} views | ` +
      `${videoCount} videos | ` +
      `${avgViewsPerVideo.toLocaleString()} avg views/video`
    );
  });
  console.log("========================================\n");

  // Console log elimination round statistics
  if (elimRoundsSorted.length > 0) {
    console.log("\n=== Elimination Round Statistics ===");
    elimRoundsSorted.forEach(({ round, totalViews, videoCount, avgViewsPerVideo }) => {
      console.log(
        `  ${round}: ${totalViews.toLocaleString()} views | ` +
        `${videoCount} videos | ` +
        `${avgViewsPerVideo.toLocaleString()} avg views/video`
      );
    });
    console.log("====================================\n");
  }

  return {
    summary: {
      totalViews,
      totalVideos,
      totalChannels: channelsSorted.length,
      totalDebateStyles: debateStylesSorted.length,
    },
    byChannel: channelsSorted,
    byDebateStyle: debateStylesSorted,
    byYear: yearsSorted,
    byElimRound: elimRoundsSorted,
    rawData: {
      statsByChannel,
      statsByDebateStyle,
      statsByYear,
      statsByElimRound,
    },
  };
}