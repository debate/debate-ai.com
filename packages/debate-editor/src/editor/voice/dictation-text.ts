/**
 * Dictation text post-processing (SPEC-voice.md §7): spoken punctuation
 * words, the dash system, and sentence auto-capitalization. The
 * recognizer emits lowercase unpunctuated text — every model does —
 * so precision here is a transform problem, not a model problem.
 */
import type { Settings } from '../settings.js';

const DASH_GLYPHS: Record<string, string> = {
  em: '—',
  en: '–',
  hyphen: '-',
  double: '--',
  triple: '---',
};

function dashFor(style: Settings['voiceDashStyle']): string {
  const [kind, spaced] = style.split('-') as [string, string | undefined];
  const glyph = DASH_GLYPHS[kind] ?? '—';
  return spaced ? ` ${glyph} ` : glyph;
}

/** Spoken-punctuation vocabulary. Tight glyphs attach to the preceding
 *  word; openers attach to the following one. */
const PUNCT: Array<{ words: string; glyph: string; attach: 'prev' | 'next' }> = [
  { words: 'period', glyph: '.', attach: 'prev' },
  { words: 'full stop', glyph: '.', attach: 'prev' },
  { words: 'comma', glyph: ',', attach: 'prev' },
  { words: 'colon', glyph: ':', attach: 'prev' },
  { words: 'semicolon', glyph: ';', attach: 'prev' },
  { words: 'question mark', glyph: '?', attach: 'prev' },
  { words: 'exclamation point', glyph: '!', attach: 'prev' },
  { words: 'exclamation mark', glyph: '!', attach: 'prev' },
  { words: 'close quote', glyph: '”', attach: 'prev' },
  { words: 'end quote', glyph: '”', attach: 'prev' },
  { words: 'open quote', glyph: '“', attach: 'next' },
  { words: 'close paren', glyph: ')', attach: 'prev' },
  { words: 'open paren', glyph: '(', attach: 'next' },
  { words: 'ellipsis', glyph: '…', attach: 'prev' },
  { words: 'percent sign', glyph: '%', attach: 'prev' },
];

export function transformDictation(
  raw: string,
  dashStyle: Settings['voiceDashStyle'],
): string {
  let text = ` ${raw} `;

  // Dashes first — explicit names bypass the setting; bare "dash" uses
  // it. Unspaced glyphs consume surrounding spaces so "deterrence dash
  // fails" → "deterrence—fails".
  const dashRepl = (named: string | undefined, spaced: string | undefined): string => {
    const glyph = named ? (DASH_GLYPHS[named === 'm' ? 'em' : named === 'n' ? 'en' : named] ?? '—') : null;
    if (glyph !== null) return spaced ? ` ${glyph} ` : glyph;
    return dashFor(dashStyle);
  };
  text = text.replace(
    /\s*\b(?:(em|m|en|n|double|triple)\s+)?dash(?:\s+(spaced))?\b\s*/gi,
    (_m, named: string | undefined, spaced: string | undefined) => dashRepl(named?.toLowerCase(), spaced),
  );
  text = text.replace(/\s*\bhyphen(?:\s+(spaced))?\b\s*/gi, (_m, spaced: string | undefined) =>
    spaced ? ' - ' : '-',
  );

  // Spoken punctuation.
  for (const p of PUNCT) {
    const re = new RegExp(`\\s*\\b${p.words.replace(' ', '\\s+')}\\b\\s*`, 'gi');
    text = text.replace(re, p.attach === 'prev' ? `${p.glyph} ` : ` ${p.glyph}`);
  }

  // Sentence auto-capitalization: first letter after ., ?, !, … and
  // after an opening quote that follows one.
  text = text.replace(/([.?!…]\s*[“(]?\s*)([a-z])/g, (_m, pre: string, ch: string) => pre + ch.toUpperCase());
  // Standalone "i".
  text = text.replace(/\bi\b/g, 'I');

  return text.replace(/\s{2,}/g, ' ').trim();
}

/** Capitalize the segment's first letter when it starts a sentence —
 *  decided by the text immediately before the insertion point. */
export function capitalizeForContext(text: string, before: string): string {
  const startsSentence = before.trim() === '' || /[.?!…]\s*[”’)]?\s*$/.test(before);
  if (!startsSentence || !text) return text;
  const i = text.search(/[a-zA-Z]/);
  if (i < 0) return text;
  return text.slice(0, i) + text[i]!.toUpperCase() + text.slice(i + 1);
}
