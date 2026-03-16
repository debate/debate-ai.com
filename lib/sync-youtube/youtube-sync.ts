import { promises as fs } from "fs";
import path from "path";
import {
  getChannelId,
  getVideosForChannel,
  getVideosByIds,
  fetchFullDescriptions,
} from "./youtube-api";
import {
  channelsToUpdate,
  channels,
  ROUNDS_FILES,
  publishedAfter,
} from "./channel-config";
import {
  parseDebateStyle,
  parseRoundLevel,
  parseTournament,
  parseTeams,
  parseWinner,
  parseJudgeDecision,
} from "./parsers/round-parsers";
import { classifyLecture } from "./parsers/lecture-classifier";
import { isRound } from "./parsers/video-classifier";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export async function syncMissingTopPicks() {
  if (!YOUTUBE_API_KEY) {
    throw new Error("YouTube API key not configured");
  }

  const missingFile = path.join(process.cwd(), "missing-top-picks.txt");
  const content = await fs.readFile(missingFile, "utf-8");
  const videoIds = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (videoIds.length === 0) {
    console.log("No missing video IDs found.");
    return;
  }

  console.log(`Fetching info for ${videoIds.length} missing top picks...`);

  const videos = await getVideosByIds(videoIds);

  const dataDir = path.join(process.cwd(), "lib", "debate-data");

  // Load all split files and collect existing IDs
  const roundsFiles: Record<number, { path: string; data: any }> = {};
  const existingIds = new Set<string>();
  for (const [style, filename] of Object.entries(ROUNDS_FILES)) {
    const filePath = path.join(dataDir, filename);
    const file = JSON.parse(await fs.readFile(filePath, "utf-8"));
    roundsFiles[Number(style)] = { path: filePath, data: file };
    for (const v of file.data) existingIds.add(v[0]);
  }

  const newVideos = videos.filter((v) => !existingIds.has(v[0]));

  // Add each video to the correct split file based on style (index 6)
  for (const video of newVideos) {
    const style = video[6] || 4; // default to college if unknown
    roundsFiles[style].data.data.push(video);
  }

  // Write back only files that changed
  for (const entry of Object.values(roundsFiles)) {
    await fs.writeFile(entry.path, JSON.stringify(entry.data, null, 2));
  }

  console.log(`Added ${newVideos.length} videos across split round files`);
  console.log(`Skipped ${videos.length - newVideos.length} already present`);

  const notFound = videoIds.filter((id) => !videos.some((v) => v[0] === id));
  if (notFound.length > 0) {
    console.log(
      `Could not find ${notFound.length} videos on YouTube:`,
      notFound,
    );
  }

  return { added: newVideos.length, notFound };
}

export async function syncYouTubeVideos() {
  if (!YOUTUBE_API_KEY) {
    throw new Error("YouTube API key not configured");
  }

  console.log("Starting video sync...");

  const allVideos: any[] = [];

  for (const channelName of channelsToUpdate.length
    ? channelsToUpdate
    : channels) {
    const channelId = await getChannelId(channelName);
    if (channelId) {
      const videos = await getVideosForChannel(
        channelId,
        channelName,
        publishedAfter,
      );
      allVideos.push(...videos);
      console.log(`Fetched ${videos.length} videos from ${channelName}`);
    } else {
      console.log(`Could not find channel ID for ${channelName}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("🔍 FETCHING FULL DESCRIPTIONS");
  console.log("=".repeat(60) + "\n");

  // Find videos with truncated descriptions and fetch full ones
  const truncatedIds = allVideos
    .filter((v) => v[5]?.endsWith("..."))
    .map((v) => v[0]);

  if (truncatedIds.length > 0) {
    console.log(
      `Found ${truncatedIds.length} videos with truncated descriptions`,
    );
    const fullDescriptions = await fetchFullDescriptions(truncatedIds);

    let updated = 0;
    for (const video of allVideos) {
      if (
        fullDescriptions[video[0]] !== undefined &&
        video[5]?.endsWith("...")
      ) {
        video[5] = fullDescriptions[video[0]];
        updated++;
      }
    }
    console.log(`Updated ${updated} descriptions with full text\n`);
  } else {
    console.log("No truncated descriptions found\n");
  }

  console.log("=".repeat(60));
  console.log("📋 CLASSIFYING VIDEOS INTO ROUNDS AND LECTURES");
  console.log("=".repeat(60) + "\n");

  // Split into rounds and lectures
  const rounds: any[] = [];
  const lectures: any[] = [];

  for (const video of allVideos) {
    const [id, title, date, channel, views, desc] = video;

    if (isRound(title, desc)) {
      // Parse round data
      const style = parseDebateStyle(title, channel);
      const tournament = parseTournament(title);
      const roundLevel = parseRoundLevel(title);
      const { aff, neg } = parseTeams(title);
      const winner = parseWinner(desc);
      const judgeDecision = parseJudgeDecision(desc);

      rounds.push([
        id,
        title,
        date,
        channel,
        views,
        desc,
        style,
        tournament,
        roundLevel,
        aff,
        neg,
        winner,
        judgeDecision,
        null, // 1AC arg
        null, // 2NR arg
        false, // isTopPick
        null, // speech docs URL
      ]);
    } else {
      // Classify lecture
      const category = classifyLecture(title, desc);
      lectures.push([...video, category]);
    }
  }

  console.log(
    `Classified ${rounds.length} rounds and ${lectures.length} lectures\n`,
  );

  // Show lecture category distribution
  const lectureCats: Record<string, number> = {};
  lectures.forEach((v) => {
    const cat = v[6];
    lectureCats[cat] = (lectureCats[cat] || 0) + 1;
  });
  console.log("Lecture categories:", lectureCats);

  console.log("\n" + "=".repeat(60));
  console.log("💾 MERGING AND SAVING SPLIT FILES");
  console.log("=".repeat(60) + "\n");

  const dataDir = path.join(
    process.cwd(),
    "lib",
    "debate-data",
    "debate-videos",
  );

  // Split rounds by style
  const roundsByStyle: Record<number, any[]> = {
    1: [], // Policy
    2: [], // PF
    3: [], // LD
    4: [], // College
  };

  for (const round of rounds) {
    const style = round[6]; // style is at index 6
    if (roundsByStyle[style]) {
      roundsByStyle[style].push(round);
    }
  }

  const styleNames: Record<number, string> = {
    1: "policy",
    2: "pf",
    3: "ld",
    4: "college",
  };

  const mergedStats: Record<string, any> = {};

  // Process each style
  for (const [styleNum, styleName] of Object.entries(styleNames)) {
    const style = Number(styleNum);
    const newStyleRounds = roundsByStyle[style];

    if (newStyleRounds.length === 0) {
      console.log(`Skipping ${styleName.toUpperCase()}: no new rounds`);
      continue;
    }

    const roundsPath = path.join(dataDir, `new-rounds-${styleName}.json`);

    // Load existing data if file exists
    let existingRounds: any[] = [];
    try {
      const roundsData = await fs.readFile(roundsPath, "utf-8");
      existingRounds = JSON.parse(roundsData);
      console.log(`Found ${existingRounds.length} existing ${styleName.toUpperCase()} rounds`);
    } catch (err) {
      console.log(`No existing ${styleName.toUpperCase()} rounds file found, creating new one`);
    }

    // Merge: deduplicate by video ID (index 0)
    const existingRoundIds = new Set(existingRounds.map((v) => v[0]));
    const newRounds = newStyleRounds.filter((v) => !existingRoundIds.has(v[0]));
    const mergedRounds = [...existingRounds, ...newRounds];

    // Sort by date (index 2) descending (newest first)
    mergedRounds.sort((a, b) => b[2].localeCompare(a[2]));

    await fs.writeFile(roundsPath, JSON.stringify(mergedRounds, null, 2));

    console.log(
      `\n💾 Saved ${mergedRounds.length} total ${styleName.toUpperCase()} rounds to: ${roundsPath}`,
    );
    console.log(`   - ${existingRounds.length} existing`);
    console.log(`   - ${newRounds.length} newly added`);
    console.log(`   - ${newStyleRounds.length - newRounds.length} duplicates skipped`);

    mergedStats[styleName] = {
      total: mergedRounds.length,
      existing: existingRounds.length,
      new: newRounds.length,
      duplicates: newStyleRounds.length - newRounds.length,
    };
  }

  // Process lectures
  const lecturesPath = path.join(dataDir, "new-lectures.json");
  let existingLectures: any[] = [];

  try {
    const lecturesData = await fs.readFile(lecturesPath, "utf-8");
    existingLectures = JSON.parse(lecturesData);
    console.log(`\nFound ${existingLectures.length} existing lectures`);
  } catch (err) {
    console.log("\nNo existing lectures file found, creating new one");
  }

  // Merge: deduplicate by video ID (index 0)
  const existingLectureIds = new Set(existingLectures.map((v) => v[0]));
  const newLectures = lectures.filter((v) => !existingLectureIds.has(v[0]));
  const mergedLectures = [...existingLectures, ...newLectures];

  // Sort by date (index 2) descending (newest first)
  mergedLectures.sort((a, b) => b[2].localeCompare(a[2]));

  await fs.writeFile(lecturesPath, JSON.stringify(mergedLectures, null, 2));

  console.log(
    `\n💾 Saved ${mergedLectures.length} total lectures to: ${lecturesPath}`,
  );
  console.log(`   - ${existingLectures.length} existing`);
  console.log(`   - ${newLectures.length} newly added`);
  console.log(
    `   - ${lectures.length - newLectures.length} duplicates skipped`,
  );

  const stats = {
    fetched: allVideos.length,
    classified: {
      rounds: rounds.length,
      roundsByStyle: {
        policy: roundsByStyle[1].length,
        pf: roundsByStyle[2].length,
        ld: roundsByStyle[3].length,
        college: roundsByStyle[4].length,
      },
      lectures: lectures.length,
    },
    merged: mergedStats,
    lectures: {
      total: mergedLectures.length,
      existing: existingLectures.length,
      new: newLectures.length,
      duplicates: lectures.length - newLectures.length,
    },
    truncatedFixed: truncatedIds.length,
    lectureCats,
    outputFiles: {
      rounds: Object.entries(styleNames)
        .filter(([style]) => roundsByStyle[Number(style)].length > 0)
        .map(([, name]) => path.join(dataDir, `new-rounds-${name}.json`)),
      lectures: lecturesPath,
    },
  };

  console.log("\n" + "=".repeat(60));
  console.log("✅ VIDEO SYNC COMPLETED");
  console.log("=".repeat(60));
  console.log(JSON.stringify(stats, null, 2));
  console.log("=".repeat(60) + "\n");

  return {
    success: true,
    message: "Videos synced successfully",
    stats,
  };
}
