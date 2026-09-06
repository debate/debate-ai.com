export { LecturesPage } from "./panels/LecturesPage";
export { DebateVideosPage } from "./panels/DebateVideosPanel";
export { LeaderboardPanel } from "./panels/leaderboard/RankingsLeaderboardPanel";
export { PersistentVideoPlayer } from "./components/video-player/PersistentVideoPlayer";
export { ToolNavTree } from "./components/category-gallery/ToolNavTree";
export {
  SIDEBAR_TOOL_SECTIONS,
  APP_DOCK_LINKS,
  TOOLS_ROOT_HREF,
  type SidebarToolLink,
  type SidebarToolSection,
} from "./components/category-gallery/sidebar-tool-sections";
export {
  TOOL_SIDEBAR_HREFS,
  matchesToolSidebarHref,
  hasEmbeddedDock,
  isGenericToolSidebarRoute,
} from "./components/category-gallery/sidebar-routes";
export { Footer as ToolSidebarFooter } from "./ui/layout/footer";
export {
  CategoryDockProvider,
  useCategoryDock,
  useCategoryDockState,
} from "./context/category-dock-context";
export { useVideoPlayerStore, sendYouTubeCommand, videoPlayerIframeRef } from "./state/videoPlayerStore";
export * from "./types/videos";
