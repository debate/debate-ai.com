/**
 * @fileoverview Public surface of the openCaselist sync.
 *
 * Import from here rather than from a file inside the folder, so the split
 * between discovery, parsing and unpacking stays an implementation detail.
 *
 * @module caselist
 */
export {
  CASELIST_FAMILIES,
  CASELIST_FILES_ORIGIN,
  CASELIST_ORIGIN,
  CURRENT_SEASON,
  archiveUrl,
  caselistFor,
  caselistsForSeason,
  downloadsPageUrl,
  parseCaselistSlug,
  seasonLabel,
} from "./caselist-config";
export type {
  Caselist,
  CaselistArchiveKind,
  CaselistEvent,
  CaselistFamily,
  CaselistLevel,
} from "./caselist-config";

export {
  archiveFromUrl,
  buildDownloads,
  listArchives,
  parseArchiveFileName,
  parseDownloadsHtml,
  parseDownloadsPayload,
} from "./downloads-page-parser";
export type {
  ArchiveFileNameParts,
  CaselistArchive,
  CaselistDownloads,
} from "./downloads-page-parser";

export {
  archiveExists,
  downloadArchive,
  fetchCaselistDownloads,
  markSynced,
  probeArchives,
  recentArchiveDates,
  selectPendingArchives,
  syncCaselists,
} from "./caselist-sync";
export type {
  CaselistDownloadsResult,
  CaselistSyncState,
  DownloadedArchive,
  DownloadsSource,
  FetchOptions,
} from "./caselist-sync";

export { describeCaselistEntry, loadCaselistArchive } from "./caselist-archive";
export type {
  CaselistArchiveLoad,
  CaselistDocument,
  CaselistDocumentFailure,
  CaselistEntryInfo,
  CaselistSide,
  LoadArchiveOptions,
} from "./caselist-archive";
