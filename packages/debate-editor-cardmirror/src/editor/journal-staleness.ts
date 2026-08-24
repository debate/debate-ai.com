/**
 * Is a crash-recovery journal older than the file it would overwrite?
 *
 * Journals are keyed by session doc-uid, not by file path, so an old
 * journal from a crashed session lingers in the store even as later
 * sessions open, edit, and save the SAME file under fresh uids. On the next
 * launch that stale journal shows up in the recovery sidebar, and its Save
 * writes the old journal bytes straight over the newer file — destroying the
 * work done since the crash.
 *
 * A legitimate recovery journal is NEWER than the last on-disk save (it holds
 * unsaved edits), so `savedAt > fileMtime` and this returns false. Only a
 * journal that predates the file's last modification — the stale case — trips
 * it, which the recovery Save turns into a hard confirmation before writing.
 */

/** Small grace window so filesystem timestamp resolution, clock skew, or a
 *  sync service touching mtime doesn't flag an essentially-contemporaneous
 *  journal. A genuinely stale journal predates the file by minutes-to-days,
 *  far beyond this. */
export const STALE_JOURNAL_TOLERANCE_MS = 5_000;

/** True when the file on disk (`fileMtimeMs`) is meaningfully newer than the
 *  journal (`savedAtIso`), i.e. saving the journal would overwrite newer
 *  work. False when the timestamp is unparseable (fail open — never block a
 *  recovery on a bad clock). */
export function journalPredatesFile(
  savedAtIso: string,
  fileMtimeMs: number,
  toleranceMs: number = STALE_JOURNAL_TOLERANCE_MS,
): boolean {
  const journalMs = Date.parse(savedAtIso);
  if (!Number.isFinite(journalMs)) return false;
  return fileMtimeMs > journalMs + toleranceMs;
}

/** The timestamp the staleness check must compare against the file's mtime:
 *  the ORIGINAL recovered-from `savedAt` when the journal descends from a
 *  recovered draft (edits re-journal with `savedAt` = now, which would launder
 *  the staleness across a crash or mode switch), else the journal's own
 *  `savedAt`. */
export function journalStalenessBaseline(entry: {
  savedAt: string;
  recoveredFromSavedAt?: string;
}): string {
  return entry.recoveredFromSavedAt ?? entry.savedAt;
}

/** Journal `savedAt` (ISO) for each recovered-but-not-yet-saved doc, keyed by
 *  session uid. A doc opened from the recovery sidebar is marked here so that
 *  (a) its FIRST normal in-place save runs the stale-overwrite guard, and
 *  (b) autosave holds off entirely — the guard lives only on the manual save
 *  path, and both layouts' autosaves write via `saveExisting` directly (three-
 *  pane even re-arms autosave from the per-path preference the moment the
 *  draft opens). The mark clears once the doc survives one manual save, in
 *  place or Save-As. Keyed by uid so single-doc and three-pane share it. */
const recoveredDraftMarks = new Map<string, string>();

export function markRecoveredDraft(uid: string, savedAtIso: string): void {
  recoveredDraftMarks.set(uid, savedAtIso);
}

/** The journal `savedAt` the doc was recovered from, or undefined once it has
 *  been manually saved (or was never a recovered draft). */
export function recoveredDraftJournalSavedAt(uid: string): string | undefined {
  return recoveredDraftMarks.get(uid);
}

export function clearRecoveredDraftMark(uid: string): void {
  recoveredDraftMarks.delete(uid);
}

/** Whether autosave must skip this doc: a recovered draft may only be written
 *  by a MANUAL save until its first one lands, because only the manual path
 *  runs the stale-overwrite confirmation. */
export function autosaveBlockedForRecoveredDraft(uid: string): boolean {
  return recoveredDraftMarks.has(uid);
}
