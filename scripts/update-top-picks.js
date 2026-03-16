#!/usr/bin/env node

/**
 * Script to mark debates as "greatest of all time" (top picks)
 * Reads video IDs from debate-top-picks.json and sets index 15 to true
 * in the corresponding rounds JSON files.
 */

const fs = require('fs');
const path = require('path');

// Paths to the data files
const TOP_PICKS_PATH = path.join(__dirname, '../lib/debate-data/debate-videos/debate-top-picks.json');
const ROUNDS_FILES = [
  path.join(__dirname, '../lib/debate-data/debate-videos/rounds-policy.json'),
  path.join(__dirname, '../lib/debate-data/debate-videos/rounds-pf.json'),
  path.join(__dirname, '../lib/debate-data/debate-videos/rounds-ld.json'),
  path.join(__dirname, '../lib/debate-data/debate-videos/rounds-college.json'),
];

function main() {
  console.log('🎯 Updating top picks in rounds files...\n');

  // Read the top picks file
  const topPicksData = JSON.parse(fs.readFileSync(TOP_PICKS_PATH, 'utf8'));
  const topPickIds = new Set(topPicksData.data);

  console.log(`📋 Found ${topPickIds.size} top pick IDs to mark\n`);

  let totalUpdated = 0;
  let totalVideos = 0;

  // Process each rounds file
  ROUNDS_FILES.forEach((filePath) => {
    const fileName = path.basename(filePath);
    console.log(`📁 Processing ${fileName}...`);

    // Read the rounds file
    const roundsData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let updatedInFile = 0;
    let clearedInFile = 0;

    // Update each video entry
    roundsData.data = roundsData.data.map((video) => {
      const videoId = video[0];
      const currentlyMarked = video[15] === true;
      const shouldBeMarked = topPickIds.has(videoId);

      if (shouldBeMarked && !currentlyMarked) {
        // Need to mark this video
        video[15] = true;
        updatedInFile++;
        console.log(`  ✅ Marked: ${videoId} - ${video[1]}`);
      } else if (!shouldBeMarked && currentlyMarked) {
        // Need to clear this video (it's no longer in top picks)
        video[15] = false;
        clearedInFile++;
        console.log(`  ❌ Cleared: ${videoId} - ${video[1]}`);
      }

      return video;
    });

    totalVideos += roundsData.data.length;
    totalUpdated += updatedInFile;

    // Write back to file with proper formatting
    fs.writeFileSync(
      filePath,
      JSON.stringify(roundsData, null, 2) + '\n',
      'utf8'
    );

    console.log(`  ℹ️  Updated: ${updatedInFile}, Cleared: ${clearedInFile}, Total videos: ${roundsData.data.length}\n`);
  });

  // Verify all top picks were found
  const allVideoIds = new Set();
  ROUNDS_FILES.forEach((filePath) => {
    const roundsData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    roundsData.data.forEach((video) => {
      allVideoIds.add(video[0]);
      if (video[15] === true && !topPickIds.has(video[0])) {
        console.warn(`⚠️  Warning: Video ${video[0]} is marked as top pick but not in top-picks.json`);
      }
    });
  });

  const missingIds = [...topPickIds].filter(id => !allVideoIds.has(id));
  if (missingIds.length > 0) {
    console.warn(`\n⚠️  Warning: ${missingIds.length} IDs from top-picks.json not found in any rounds file:`);
    missingIds.forEach(id => console.warn(`  - ${id}`));
  }

  console.log(`\n✨ Done! Updated ${totalUpdated} videos across ${totalVideos} total entries.`);
}

main();
