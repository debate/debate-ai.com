const fs = require('fs');

import data from './debate-videos-by-channel.json';
const OUTPUT_PATH = "src/lib/youtube/debate-videos.json"

/**
 * DEARLY: Debate Educational Archive 
 * of Rounds and Lectures from Youtube 

 * mostly 2013 - July 2024 
 * 7 videos from 2002-2012
 * Unique Videos: 1845 
 * Top Rounds: 92
 * Lectures: 500+
 * Total views: 4.7 million
 * Styles: High School Policy TOC-NDCA, 
 *  College Policy NDT-CEDA, Public Forum, LD, etc
 * 
 * Fetching updates: via GitHub repo
 * License : CC BY-SA 4.0 - 
 * https://creativecommons.org/licenses/by-sa/4.0/ 
 * 
 */

// Function to parse ISO 8601 date string
function parseDate(dateString) {
  return new Date(dateString);
}

// Initialize variables
const rounds = [];
const lectures = [];
const topPicks = [];
let totalViews = 0;

// Helper function to process a video
function processVideo(video) {
    video.v = parseInt(video.v, 10);
    video.n = video.title;
    delete video.title;
  
    video.t = video.t.split('T')[0];
  
    if (video.d?.startsWith('Before opening the description and viewing ')) {
      delete video.d;
    }
  
    totalViews += video.v;
  
  
    return [video.id, video.n, video.t, video.c, video.v, video.d || ''];
  }
  
  // Process rounds
  for (const key in data.rounds) {
    for (const video of data.rounds[key]) {
      const videoArray = processVideo(video);
      rounds.push(videoArray);
    }
  }
  
  // Process lectures
    for (const key in data.lectures) {
        for (const video of data.lectures[key]) {

            const videoArray = processVideo(video);
            lectures.push(videoArray);
        }
    }

    // Process top
    for (const video of data.topPicks) {
            const videoArray = processVideo(video);
            topPicks.push(videoArray);
    }

// Sort  by date
rounds.sort(( b, a ) => a[2]?.localeCompare(b[2]));
topPicks.sort(( b, a ) => a[2]?.localeCompare(b[2]));
lectures.sort(( b, a ) => a[2]?.localeCompare(b[2]));


//deduplicate and count duplicates (in top 100)
const allVideos = rounds.concat(topPicks).concat(lectures);
var uniqueVideos = [...new Set(allVideos.map(v=>v[0]))]
var duplicates = allVideos.length - uniqueVideos.length;
console.log(`Unique videos: ${uniqueVideos.length} Duplicates: ${duplicates}`);

// Create the output object
const output = {rounds, topPicks, lectures}; // Add lectures


// Write the output to a new JSON file
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 0));
console.log(`topPicks: ${topPicks.length}`);
console.log(`Total views across all videos: ${totalViews}`);