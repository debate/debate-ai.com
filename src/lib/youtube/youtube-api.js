require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

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
    console.error(`Error getting channel ID for ${channelName}:`, error);
    return null;
  }
}

async function getLatestVideos(channelId, maxResults = 50) {
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        channelId: channelId,
        order: 'date',
        type: 'video',
        maxResults: maxResults,
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

    return response.data.items.map(item => ({
      ...item,
      statistics: videoStatistics[item.id.videoId]
    }));
  } catch (error) {
    console.error(`Error getting videos for channel ${channelId}:`, error);
    return [];
  }
}


async function getPlaylistVideos(playlistId, maxResults = 50) {
  try {
    const videos = [];
    let nextPageToken = '';
    
    do {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
        params: {
          part: 'snippet,contentDetails',
          playlistId: playlistId,
          maxResults: Math.min(maxResults - videos.length, 50),
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

      videos.push(...response.data.items.map(item => ({
        ...item,
        statistics: videoStatistics[item.contentDetails.videoId]
      })));

      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken && videos.length < maxResults);

    // Sort videos by publishedAt date, most recent first
    videos.sort((a, b) => new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt));

    return videos;
  } catch (error) {
    console.error(`Error getting videos for playlist ${playlistId}:`, error);
    return [];
  }
}

app.get('/latest-videos', async (req, res) => {
  const channelNames = req.query.channels ? req.query.channels.split(',') : [];
  if (channelNames.length === 0) {
    return res.status(400).json({ error: 'At least one channel name is required' });
  }

  try {
    const allVideos = [];

    for (const channelName of channelNames) {
      const channelId = await getChannelId(channelName);
      if (channelId) {
        const videos = await getLatestVideos(channelId);
        allVideos.push(...videos.map(video => ({...video, channelName})));
      } else {
        console.error(`Channel not found: ${channelName}`);
      }
    }

    // Sort all videos by publishedAt date, most recent first
    allVideos.sort((a, b) => new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt));

    res.json(allVideos);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'An error occurred while fetching videos' });
  }
});

app.get('/playlist-videos', async (req, res) => {
  const playlistId = req.query.playlistId;
  if (!playlistId) {
    return res.status(400).json({ error: 'Playlist ID is required' });
  }

  const videos = await getPlaylistVideos(playlistId);
  res.json(videos);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});