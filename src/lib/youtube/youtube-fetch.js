const axios = require('axios');
const fs = require('fs').promises;
require('dotenv').config();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// const categories = {
//   'rounds': [ 'pfvideos9234',
//     'PolicyDebateCentral-gv1nl', 'lasadebate', 'DebateStreamDB8', 'CEDADebate', 'KentuckyDebate', 'sailorferrets',
//     'wakedebate8636', 'exodusfiles3478', 'SolvencyAdvocate', 'northbrowardmr4523',
//     'TexasDebate', 'jacobwilkus8697', 'arvindshankar2481'
//   ],  'NDT-jl6oi'

//  'atrujillo9'   'vintagedebatevids' 'lectures': ['georgetowndebateseminar1234', 'barkleyforumvideos3220' , 'BillBatterman', "msudebate6544", 
//    'ProfessorGraham', 'ddidebate4071', 'michigandebate7440']
// };

const categories = {
    'lectures': [ 'UNTDebate' ]
    
  };




const TOP_PICKS_PLAYLIST_ID = 'PLHaG-zIzA-QFVlMUHD2LO30Lz1R2kt1hn';

async function getChannelId(channelName) {
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        type: 'channel',
        q: channelName,
        key: YOUTUBE_API_KEY
      }
    });

    if (response.data.items.length > 0) {
      return response.data.items[0].id.channelId;
    }
    return null;
  } catch (error) {
    console.error(`Error getting channel ID for ${channelName}:`, error.message);
    return null;
  }
}

function trimVideoData(video) {
  return {
    id: video.id.videoId,
    title: video.snippet.title,
    d: video.snippet.description,
    t: video.snippet.publishedAt.toString()?.split('T')[0],
    c: video.snippet.channelTitle,
    v: video.statistics?.viewCount || '0'
  };
}

async function getVideosForChannel(channelId, channelName) {
  let allVideos = [];
  let nextPageToken = null;

  do {
    try {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          channelId: channelId,
          order: 'date',
          type: 'video',
          maxResults: 50,
          pageToken: nextPageToken,
          key: YOUTUBE_API_KEY
        }
      });

      const videoIds = response.data.items.map(item => item.id.videoId).join(',');
      const statisticsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: {
          part: 'statistics',
          id: videoIds,
          key: YOUTUBE_API_KEY
        }
      });

      const videoStatistics = {};
      statisticsResponse.data.items.forEach(item => {
        videoStatistics[item.id] = item.statistics;
      });

      const videosWithStats = response.data.items.map(item => ({
        ...item,
        statistics: videoStatistics[item.id.videoId]
      }));

      allVideos = allVideos.concat(videosWithStats.map(video => trimVideoData(video)));
      nextPageToken = response.data.nextPageToken;

      console.log(`Fetched ${allVideos.length} videos for channel ${channelName}`);

    } catch (error) {
      console.error(`Error getting videos for channel ${channelName}:`, error.message);
      nextPageToken = null;
    }
  } while (nextPageToken);

  return allVideos;
}

async function getPlaylistVideos(playlistId) {
  let allVideos = [];
  let nextPageToken = null;

  do {
    try {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
        params: {
          part: 'snippet,contentDetails',
          playlistId: playlistId,
          maxResults: 50,
          pageToken: nextPageToken,
          key: YOUTUBE_API_KEY
        }
      });

      const videoIds = response.data.items.map(item => item.contentDetails.videoId).join(',');
      const statisticsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: {
          part: 'statistics',
          id: videoIds,
          key: YOUTUBE_API_KEY
        }
      });

      const videoStatistics = {};
      statisticsResponse.data.items.forEach(item => {
        videoStatistics[item.id] = item.statistics;
      });

      const videosWithStats = response.data.items.map(item => ({
        ...item,
        statistics: videoStatistics[item.contentDetails.videoId]
      }));

      allVideos = allVideos.concat(videosWithStats.map(video => ({
        id: video.contentDetails.videoId,
        title: video.snippet.title,
        d: video.snippet.d,
        t: video.snippet.t,
        c: 'Top Picks',
        v: video.statistics?.v || '0'
      })));
      nextPageToken = response.data.nextPageToken;

      console.log(`Fetched ${allVideos.length} videos for playlist ${playlistId}`);

    } catch (error) {
      console.error(`Error getting videos for playlist ${playlistId}:`, error.message);
      nextPageToken = null;
    }
  } while (nextPageToken);

  return allVideos;
}

async function fetchAllVideos() {
  const allVideos = {
    rounds: {},
    lectures: {},
    topPicks: []
  };

  // Fetch videos for each category
  for (const [category, channels] of Object.entries(categories)) {
    for (const channelName of channels) {
      const channelId = await getChannelId(channelName);
      if (channelId) {
        const videos = await getVideosForChannel(channelId, channelName);
        allVideos[category][channelName] = videos;
        console.log(`Fetched a total of ${videos.length} videos for ${channelName}`);
      } else {
        console.log(`Could not find channel ID for ${channelName}`);
      }
    }
  }

  // Fetch top picks playlist
//   const topPicksVideos = await getPlaylistVideos(TOP_PICKS_PLAYLIST_ID);
//   allVideos.topPicks = topPicksVideos;
//   console.log(`Fetched a total of ${topPicksVideos.length} videos for Top Picks playlist`);

  return allVideos;
}

async function main() {
  try {
    console.log('Fetching all videos...');
    const allVideos = await fetchAllVideos();
    
    console.log('Writing data to file...');
    await fs.writeFile('./debate-videos-by-channel.json', JSON.stringify(allVideos, null, 2));
    
    console.log('Data successfully written to debate_videos.json');
  } catch (error) {
    console.error('An error occurred:', error.message);
  }
}

main();