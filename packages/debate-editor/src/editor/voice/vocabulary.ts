/**
 * Voice v2 command vocabulary + the whole-utterance matcher (spec §3,
 * §6.1). Shared by the desktop recognizer worker (bundled) and the
 * renderer (calibration, tests). Pure: no DOM, no Node.
 *
 * Fourteen words, chosen for acoustic distance, each mapped to an existing
 * editor command by the dispatcher. A command fires only when the WHOLE
 * utterance is one vocabulary word (after trimming fillers): "line"
 * fires; "the line of argument" does not — that rule, not a grammar, is
 * what keeps background speech from firing commands.
 */

export const VOICE_COMMANDS = [
  'line',
  'box',
  'glow',
  'bare',
  'shrink',
  'tag',
  'cite',
  'card',
  'condense',
  'chunk',
  'ship',
  'return',
  'undo',
  'delete',
] as const;
export type VoiceVerb = (typeof VOICE_COMMANDS)[number];

/** What each word does, for the pill / manual / calibration prompts. */
export const VOICE_COMMAND_LABELS: Record<VoiceVerb, string> = {
  line: 'underline',
  box: 'emphasis',
  glow: 'highlight',
  bare: 'clear marks',
  shrink: 'shrink',
  tag: 'tag',
  cite: 'cite',
  card: 'new card',
  condense: 'condense',
  chunk: 'select heading',
  ship: 'send to speech',
  return: 'new paragraph',
  undo: 'undo',
  delete: 'delete',
};

/** Spoken while listening for commands: park the mic. Two syllables and
 *  a word pair that never occurs in debate prose. */
export const SLEEP_PHRASES = ['sleep', 'go to sleep'];
/** The only thing that decodes while asleep. */
export const WAKE_PHRASES = ['wake', 'wake up'];

/** Spellings an open recognizer produces for a word said in isolation
 *  (homophones and near-homophones; measured in the 2026-09-10 spike).
 *  Each is only ever accepted as a WHOLE utterance. */
export const BUILT_IN_ALIASES: Record<VoiceVerb, readonly string[]> = {
  line: ['lyne', 'lion'],
  box: ['bocks', 'bax'],
  glow: ['low', 'glo', 'glowe', 'glue'],
  bare: ['bear', 'bar', 'bair', 'bere'],
  shrink: ['shrank', 'shrunk', 'shrinks'],
  tag: ['tagg', 'tack'],
  cite: ['site', 'sight', 'sites', 'cited', 'psych'],
  card: ['cart', 'kard', 'cod', 'cards'],
  condense: ['condensed', 'condens', 'condenser'],
  chunk: ['chunks', 'chuck', 'junk', 'trunk', 'chunky'],
  ship: ['ships', 'shipped', 'chip', 'sip', 'shep'],
  return: ['returns', 'returned', 'retain', 'we turn', 'return key'],
  undo: ['undue', 'and do', 'un do', 'ondo'],
  delete: ['deleted', 'the lead', 'delet', 'dilate'],
};

const FILLERS = new Set(['um', 'uh', 'hmm', 'mm', 'ah', 'er', 'eh', 'oh']);

/** Lowercase, strip punctuation, collapse whitespace, drop leading and
 *  trailing fillers. */
export function normalizeTranscript(raw: string): string {
  const words = raw
    .toLowerCase()
    .replace(/[^a-z' ]+/g, ' ')
    .replace(/'/g, '')
    .split(/\s+/)
    .filter(Boolean);
  while (words.length && FILLERS.has(words[0]!)) words.shift();
  while (words.length && FILLERS.has(words[words.length - 1]!)) words.pop();
  return words.join(' ');
}

export interface VoiceProfile {
  /** Per-user spellings learned by calibration, keyed by verb. */
  aliases?: Record<string, string[]>;
}

function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => {
    const row = new Array<number>(b.length + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return d[a.length]![b.length]!;
}

/**
 * The verb an utterance fires, or null. Exact word, a built-in alias, a
 * profile alias, or — for the longer words only — one character off.
 * The utterance must be the word alone: two-word transcripts match only
 * two-word aliases ("and do" → undo).
 */
export function matchCommand(raw: string, profile?: VoiceProfile | null): VoiceVerb | null {
  const t = normalizeTranscript(raw);
  if (!t) return null;
  for (const verb of VOICE_COMMANDS) {
    if (t === verb) return verb;
    if (BUILT_IN_ALIASES[verb].includes(t)) return verb;
    const mine = profile?.aliases?.[verb];
    if (mine && mine.includes(t)) return verb;
  }
  if (!t.includes(' ')) {
    for (const verb of VOICE_COMMANDS) {
      if (verb.length >= 6 && editDistance(t, verb) <= 1) return verb;
    }
  }
  return null;
}

/** Whether the utterance is one of `phrases` (sleep / wake), tolerating
 *  one trailing or leading stray word and repetition ("wake up wake up"). */
export function matchPhrase(raw: string, phrases: readonly string[]): string | null {
  const t = normalizeTranscript(raw);
  if (!t) return null;
  for (const p of phrases) {
    if (t === p) return p;
    const re = new RegExp(`^(?:\\w+ )?${p}(?: ${p})*(?: \\w+)?$`);
    if (re.test(t)) return p;
  }
  return null;
}

/** Aliases a calibration run learned for `verb`: every distinct
 *  normalized transcript that is not already the word, not a filler-only
 *  string, and not another verb or another verb's alias (a collision is
 *  reported instead of learned). */
export function learnAliases(
  verb: VoiceVerb,
  transcripts: readonly string[],
  profile?: VoiceProfile | null,
): { aliases: string[]; collisions: Array<{ transcript: string; with: VoiceVerb }> } {
  const aliases: string[] = [];
  const collisions: Array<{ transcript: string; with: VoiceVerb }> = [];
  for (const raw of transcripts) {
    const t = normalizeTranscript(raw);
    if (!t || t === verb || aliases.includes(t)) continue;
    const owner = matchCommand(t, profile);
    if (owner && owner !== verb) {
      collisions.push({ transcript: t, with: owner });
      continue;
    }
    if (owner === verb) continue; // already recognized
    if (t.split(' ').length > 2) continue; // not a word said alone
    aliases.push(t);
  }
  return { aliases, collisions };
}
