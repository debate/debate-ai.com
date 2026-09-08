/* Debate types, speech tables, and time-format helpers.
 * Ported as-is from the original js/init.js + js/timer.js. */

export const DEBATE_TYPES = [
  'High School Policy',
  'College Policy',
  'Lincoln-Douglas',
  'Public Forum',
  'Parlimentary',
  'Extemp',
] as const;

/** Minutes for [Constructive, Rebuttal, Cross-x, Aff Prep, Neg Prep], indexed by debate type. */
export const SPEECH_TIMES: number[][] = [
  [8, 5, 3, 8, 8], // 0 HS Policy
  [9, 6, 3, 10, 10], // 1 College Policy
  [6, 7, 3, 4, 4], // 2 Lincoln-Douglas
  [4, 3, 2, 2, 2], // 3 Public Forum
  [8, 4, 5, 20, 20], // 4 Parlimentary
  [2, 2, 1, 1, 1], // 5 Extemp
];

/** Human speech names, aligned with SPEECH_TIMES columns. */
export const SPEECH_NAMES = [
  'Constructive',
  'Rebuttal',
  'Cross-x',
  'Aff Prep',
  'Neg Prep',
] as const;

/** Button ids used for styling classes and next-speech lookup. */
export const BUTTON_NAMES = [
  'constructive',
  'rebuttal',
  'crossx',
  'aff',
  'neg',
] as const;

export type ButtonName = (typeof BUTTON_NAMES)[number];

/** After a speech hits 0:00, which button gets auto-selected next.
 * Aligned with SPEECH_NAMES indexes: Constructive->Cross-x, Rebuttal->Cross-x,
 * Cross-x->Constructive, Aff Prep->Rebuttal, Neg Prep->Rebuttal. */
export const NEXT_SPEECH: ButtonName[] = [
  'crossx',
  'crossx',
  'constructive',
  'rebuttal',
  'rebuttal',
];

/** Colors per timeline row, aligned with SPEECH_NAMES then "Pause". */
export const TIMELINE_ROWS = [
  { label: 'Constructive', color: '#41a9f0' },
  { label: 'Rebuttal', color: '#118C4E' },
  { label: 'Cross-x', color: 'purple' },
  { label: 'Aff Prep', color: 'blue' },
  { label: 'Neg Prep', color: 'red' },
  { label: 'Pause', color: 'gray' },
] as const;

/** Seconds integer -> "M:SS" string. */
export function toTimeString(n: number): string {
  return (
    Math.floor(n / 60) + ':' + (n % 60 < 10 ? '0' : '') + (n % 60)
  );
}

/** Time string -> seconds integer. Accepts M:SS MM:SS M SS MSS MMSS. */
export function toNumber(s: string): number {
  const dots = s.indexOf(':');
  if (s === '10') return 600;
  return (
    (parseInt(
      s.substring(0, dots > -1 ? dots : s.length > 1 ? s.length - 2 : 1)
    ) || 0) *
      60 +
    (parseInt(
      s.substring(dots > -1 ? dots + 1 : s.length > 1 ? s.length - 2 : 1)
    ) || 0)
  );
}

/** Minute tables for a debate type, falling back to HS Policy. */
export function speechTimesFor(debateType: number): number[] {
  return SPEECH_TIMES[debateType] ?? SPEECH_TIMES[0];
}
