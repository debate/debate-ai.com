export {
  VIDEO_FAVORITES_KEY,
  VIDEO_HIDDEN_KEY,
  VIDEO_REPORTS_KEY,
  clearVideoFavorites,
  hideVideo,
  listHiddenVideos,
  listVideoFavorites,
  listVideoReports,
  saveVideoReport,
  toggleVideoFavorite,
  unhideVideo,
  type HiddenVideo,
  type VideoFavorite,
  type VideoReport,
} from "./state/videoLibrary";
export {
  MOSTLY_WATCHED_PERCENT,
  PARTLY_WATCHED_PERCENT,
  VIDEO_WATCH_HISTORY_KEY,
  WATCHED_PERCENT,
  WATCH_STATUS_LABELS,
  clearWatchHistory,
  describeWatchProgress,
  forgetWatchedVideo,
  formatWatchClock,
  getWatchHistoryEntry,
  listWatchHistory,
  recordWatchProgress,
  subscribeToWatchHistory,
  watchHistoryById,
  watchPercent,
  watchStatus,
  type WatchHistoryEntry,
  type WatchStatus,
} from "./state/videoWatchHistory";
export {
  useWatchHistory,
  useWatchHistoryEntry,
  useWatchStatus,
} from "./hooks/useWatchHistory";
export {
  VIDEO_INDEX_MAX_AGE_MS,
  VIDEO_INDEX_STORAGE_KEY,
  clearVideoIndex,
  getVideoIndexRows,
  getVideoIndexState,
  hydrateVideoIndex,
  isVideoIndexReady,
  isVideoIndexStale,
  queryVideoIndex,
  queryVideoIndexMeta,
  queryVideoIndexStacks,
  refreshVideoIndex,
  scheduleVideoIndexRefresh,
  subscribeToVideoIndex,
  type LocalVideoPage,
  type VideoIndexState,
} from "./state/videoIndexCache";
export {
  VideoIndexPrefetcher,
  useVideoIndexPrefetch,
  useVideoIndexReady,
  useVideoIndexState,
} from "./hooks/useVideoIndex";
export {
  WatchProgressBadge,
  WatchProgressBar,
  type WatchProgressBadgeProps,
} from "./components/videos/card/WatchProgressBadge";
export {
  ResizableSidebarLayout,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH_KEY,
  type ResizableSidebarLayoutProps,
} from "./ui/layout/ResizableSidebarLayout";
export {
  SIDEBAR_COLLAPSED_KEY,
  setSidebarCollapsed,
  toggleSidebarCollapsed,
  useSidebarCollapsed,
} from "./ui/layout/sidebar-collapse";
export {
  ICON_HOVER_DURATIONS,
  ICON_HOVER_EFFECTS,
  SIDEBAR_ICON_ANIMATIONS_KEY,
  attachSidebarIconHover,
  readSidebarIconAnimations,
  setSidebarIconAnimations,
  subscribeSidebarIconAnimations,
  pickIconHoverDuration,
  pickIconHoverEffect,
  useSidebarIconHover,
} from "./ui/layout/sidebar-icon-hover";
export { LibrarySidebarTree } from "./components/navigation/sidebar-nav/LibrarySidebarTree";
export { LecturesPage } from "./panels/LecturesPage";
export { ProfileVideos } from "./panels/ProfileVideos";
export { useFollowingNews, type FollowingNews } from "./hooks/useFollowingNews";
export type { FollowNewsItem } from "./lib/follows/follow-feed";
export { VideoWatchPage, type VideoWatchPageProps } from "./panels/watch/VideoWatchPage";
export { VideoMiniPlayer, type VideoMiniPlayerProps } from "./panels/watch/VideoMiniPlayer";
export {
  MINI_PLAYER_ON_TOP_KEY,
  isDesktopApp,
  miniPlayerHref,
  openMiniPlayerWindow,
  parseMiniPlayerStart,
  returnToFullPage,
  setMiniPlayerOnTop,
} from "./lib/mini-player-window";
export {
  parseVideoWatchSlug,
  slugifyVideoTitle,
  videoWatchHref,
  videoWatchSlug,
} from "./lib/video-slug";
export {
  ARCHIVE_SEASON_SEGMENT,
  FORMAT_SEGMENTS,
  UNSORTED_EVENT_SEGMENT,
  eventSegment,
  formatSegment,
  parseFormatSegment,
  isCanonicalVideoRoute,
  legacyVideoRouteHref,
  previousVideoRouteHref,
  matchupSegment,
  parseRoundTitle,
  parseSeasonSegment,
  parseVideoRouteMatchup,
  seasonSegment,
  teamsSegment,
  untitledVideoRouteHref,
  videoRouteHref,
  videoRouteParts,
  videoRouteSegments,
  type SeasonSpelling,
  type VideoRouteParts,
  type VideoRouteSegments,
  type TitleRound,
} from "./lib/video-route";
export {
  DEFAULT_SPEECH_VIEW,
  SPEECH_PARAM,
  SPEECH_VIEW_PARAM,
  SPEECH_VIEW_WORDS,
  parseSpeechRouteSuffix,
  speechRouteSuffix,
} from "./lib/speech-url";
export { videoPageTitle, type VideoPageTitleRanks } from "./lib/video-page-title";
export { isRankedSeasonRound, loadVideoTeamRanks, pastCollegeSeason } from "./lib/video-team-ranks";
export {
  VIDEO_DOCUMENT_KINDS,
  VIDEO_DOCUMENT_LABELS,
  captionsToTranscriptMarkdown,
  countWords,
  formatTimecode,
  isVideoDocumentKind,
  orderDocuments,
  parseDocumentSections,
  parseTimecode,
  toParagraphs,
  type CaptionCue,
  type DocumentSection,
  type VideoDocument,
  type VideoDocumentKind,
} from "./lib/video-documents";
export {
  buildRoundSpeeches,
  identifySpeech,
  playingSpeechIndex,
  type RoundSpeech,
  type SpeechSide,
} from "./lib/round-speeches";
export { resolveRoundSpeeches, standardRoundSpeeches } from "./lib/round-formats";
export {
  SPEECH_SEGMENTATION_SYSTEM_PROMPT,
  buildSpeechSegmentationPrompt,
  parseSpeechSegmentationResponse,
  type SegmentationCaption,
  type SpeechSegmentation,
} from "./lib/speech-segmentation";
export { captionPauseSegmentation } from "./lib/caption-speech-split";
export {
  DEFAULT_SPEECH_ANALYSIS_INSTRUCTIONS,
  buildSpeechAnalysisPrompt,
  parseSpeechAnalysisResponse,
  speechAnalysisDocuments,
  speechAnalysisSystemPrompt,
  speechTranscripts,
  type SpeechAnalysis,
  type SpeechAnalysisDocuments,
} from "./lib/speech-analysis";
export { groupIntoSentences } from "./components/videos/transcript/transcriptUtils";
export {
  AUDIO_SPLIT_FORMATS,
  AUDIO_SPLIT_TEMPLATES,
  audioSplitFormatForStyle,
  audioSplitTranscriptMarkdown,
  splitSpeechesFromLoudness,
  type AudioSplitFormat,
  type AudioSplitTemplate,
  type SpeechSplit,
} from "./lib/audio-speech-split";
export {
  splitSpeechAudio,
  type SpeechClip,
  type SplitSpeechAudioResult,
} from "./lib/split-speech-audio";
export { parseYouTubeVideoId } from "./lib/youtube-video-id";
export {
  VIDEO_RELATION_KINDS,
  VIDEO_RELATION_LABELS,
  type VideoRelationKind,
} from "./lib/video-relations";
export { WatchAnalysisPanel, type LinkedVideo } from "./components/videos/watch/WatchAnalysisPanel";
export { WatchStackPlaylist, stackMemberLabel } from "./components/videos/watch/WatchStackPlaylist";
export { stackKeyOf } from "./components/videos/grid/video-stacks";
export { WatchSidePanel, type WatchSideTab } from "./components/videos/watch/WatchSidePanel";
export { WatchRoundPanel, type SpeechFocusRequest } from "./components/videos/watch/WatchRoundPanel";
export { WatchSpeechTimeline } from "./components/videos/watch/WatchSpeechTimeline";
export { WatchRoundPrediction, type WatchRoundPredictionProps } from "./components/videos/watch/WatchRoundPrediction";
export { PersistentVideoPlayer } from "./components/videos/player/PersistentVideoPlayer";
export { SlowSpreadButton, SLOW_SPREAD_RATE } from "./components/videos/player/SlowSpreadButton";
export { ToolNavTree } from "./components/navigation/sidebar-nav/ToolNavTree";
export { DocsNavTree, DOCS_TREE_URL, type DocsTreeNode } from "./components/navigation/sidebar-nav/DocsNavTree";
export { sidebarSectionForPath } from "./components/navigation/sidebar-nav/sidebar-active-section";
export { QuickLinksGrid } from "./components/navigation/category-gallery/QuickLinksGrid";
export {
  SIDEBAR_TOOL_SECTIONS,
  APP_DOCK_LINKS,
  RESEARCH_SECTION_ID,
  TOOLS_ROOT_HREF,
  type SidebarToolLink,
  type SidebarToolSection,
} from "./components/navigation/sidebar-nav/sidebar-tool-sections";
export {
  SIDEBAR_VIDEO_LINKS,
  SIDEBAR_VIDEO_LINKS_BY_ID,
  VIDEO_ALL_LINK,
  VIDEO_COLLEGE_LINK,
  VIDEO_FORMAT_LINKS,
  VIDEO_LIBRARY_LINKS,
  VIDEO_ALL_VIDEOS_FILTER_LINKS,
  VIDEO_COLLEGE_FILTER_LINKS,
  VIDEO_REFERENCE_LINKS,
  type SidebarVideoLink,
} from "./components/navigation/sidebar-nav/sidebar-video-links";
export {
  FOOTER_LINKS,
  type FooterLink,
} from "./ui/layout/footer-links";
export {
  TOOL_SIDEBAR_HREFS,
  OWN_LAYOUT_SIDEBAR_HREFS,
  OWN_SIDEBAR_DOCK_HREFS,
  matchesToolSidebarHref,
  isTopicStarterDocsPath,
  ownsItsLayout,
  hostsOwnSidebarDock,
  hasEmbeddedDock,
  isGenericToolSidebarRoute,
  isVideoLibraryPath,
  VIDEO_LIBRARY_HREFS,
} from "./components/navigation/sidebar-nav/sidebar-routes";
export { Footer as ToolSidebarFooter } from "./ui/layout/footer";
export {
  CategoryDockProvider,
  useCategoryDock,
  useCategoryDockState,
} from "./context/category-dock-context";
export { useVideoPlayerStore, sendYouTubeCommand, videoPlayerIframeRef } from "./state/videoPlayerStore";
export { TopPickBadge, type TopPickBadgeProps } from "./components/videos/card/TopPickBadge";
export {
  TOP_PICK_BADGES,
  getTopPickBadgeInfo,
  type TopPickBadgeInfo,
} from "./lib/topPickBadges";
export * from "./types/videos";
