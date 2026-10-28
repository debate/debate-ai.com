/**
 * @fileoverview Video library admin UI: every panel of the admin page's video
 * sections (round queue, video library, reports, YouTube sync, speech AI) and
 * the dialogs they open. The `/api/admin/videos` and `/api/admin/youtube`
 * handlers are under `./api`; the YouTube ingest scripts and SQL builders are
 * server-only and imported by path from `src/sync/`.
 * @module debate-videos-admin
 */

export { ReclassifyVideosPanel } from "./components/ReclassifyVideosPanel";
export { RoundQueuePanel } from "./components/RoundQueuePanel";
export { SpeechAnalysisPanel } from "./components/SpeechAnalysisPanel";
export { SpeechAudioSplitter, type SpeechAudioSplit } from "./components/SpeechAudioSplitter";
export { TranscriptScraperPanel } from "./components/TranscriptScraperPanel";
export { VideoContentDialog, type ContentDialogVideo } from "./components/VideoContentDialog";
export {
  VideoEditDialog,
  changedFields,
  emptyLibraryVideo,
  toForm,
  type EditForm,
  type LibraryVideo,
} from "./components/VideoEditDialog";
export { VideoLibraryTable } from "./components/VideoLibraryTable";
export { VideoReportsPanel } from "./components/VideoReportsPanel";
export { YoutubeChannelsPanel } from "./components/YoutubeChannelsPanel";
export { YoutubeSyncPanel } from "./components/YoutubeSyncPanel";
export {
  formatRecomputeStacksResult,
  type RecomputeStacksCounts,
} from "./lib/format-recompute-stacks-result";
export {
  formatSeedVideosResult,
  formatSeedVideosStatus,
  type SeedVideosRunResult,
  type SeedVideosStatus,
} from "./lib/format-seed-videos-result";
