/**
 * @fileoverview The rankings UI: the leaderboard, team and school profile
 * pages, the matchup simulator, team labels, follows and "my ranked teams".
 * A separate entry point from the package root, which stays free of React so
 * the Worker can import the rating helpers without pulling UI code in.
 *
 * Profile pages show a Videos section only when the host wraps them in
 * {@link ProfileVideosProvider} with `ProfileVideos` from `@debate-ai/videos`.
 * @module debate-rankings/leaderboard
 */

export { LeaderboardPanel } from "./RankingsLeaderboardPanel";
export { TeamProfilePage, SchoolProfilePage, ProfileHandlePage } from "./profile/RankingProfiles";
export {
  TEAM_SIDE_CLASS,
  TEAM_SIDE_SURFACE_CLASS,
  TeamCodeLabel,
  TeamRankBadge,
  teamRankStats,
  TeamLabel,
  type TeamCodeLabelProps,
  type TeamLabelProps,
  type TeamSide,
} from "./team-label/TeamLabel";
export { MatchupSimulator, type MatchupSimulatorProps } from "./profile/MatchupSimulator";
export { MyRankedTeamsSettings } from "./profile/MyRankedTeamsSettings";
export {
  EMPTY_MY_RANKED_TEAMS,
  MY_TEAM_ROLES,
  getMyRankedTeams,
  normalizeMyRankedTeamsPatch,
  parseMyRankedTeams,
  serializeMyRankedTeams,
  validateMyRankedTeams,
  type MyRankedTeams,
  type MyTeamRole,
} from "./my-ranked-teams/my-ranked-teams";
export { useMyRankedTeams } from "./my-ranked-teams/useMyRankedTeams";
export { FollowButton, type FollowButtonProps } from "./profile/FollowButton";
export type { FollowKind, FollowState, ProfileFollow } from "./follows/profile-follows";
export type { DebateHistory, YearData } from "./leaderboardTypes";
export {
  ProfileVideos,
  ProfileVideosProvider,
  type ProfileVideosProps,
} from "./profile/ProfileVideosSlot";
export { formatCount } from "../format-count";
