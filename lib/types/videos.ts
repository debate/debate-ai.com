/** Video data tuple: [videoId, title, date, channel, viewCount, description] */
export type VideoType = [string, string, string, string, number, string];

/** Structure of video data returned from the videos API endpoint. */
export type DebateVideosData = {
    rounds: VideoType[];
    lectures: VideoType[];
    topPicks: VideoType[];
};

/** Union of all valid video page category identifiers. */
export type CategoryType =
    | "rounds"
    | "lectures"
    | "topPicks"
    | "dictionary"
    | "leaderboard";
