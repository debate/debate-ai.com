/**
 * Session Replay settings for `initAll` (see app/amplitude.tsx).
 *
 * Replay records the page as rrweb DOM snapshots, and Amplitude drops any
 * single event over its size limit. A Topic Starter or a personal document
 * open in the card editor is a ProseMirror tree of thousands of cards, so the
 * full snapshot of a `/docs/<topic>/…` or `/reason-editor` page came out at
 * ~26 MB and every one was dropped ("Session replay event dropped: serialized
 * size 26350 KB exceeds maximum allowed event size"), leaving those sessions
 * with no replay at all.
 *
 * Blocking the editor's engine container (`.dec-cardmirror-root`, created by
 * debate-editor's singleton boot) records it as an empty box of the same
 * size: the rest of the page, and every click around it, still replays, and
 * the editor's typing no longer streams a mutation per keystroke. It also
 * keeps the text of people's own documents out of the recordings.
 */
export const REPLAY_BLOCK_SELECTORS: string[] = [".dec-cardmirror-root"]

export const SESSION_REPLAY_OPTIONS = {
  sampleRate: 1,
  privacyConfig: { blockSelector: REPLAY_BLOCK_SELECTORS },
}
