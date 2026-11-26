import { describe, expect, it } from 'vitest';

import {
  BUTTON_NAMES,
  DEBATE_TYPES,
  NEXT_SPEECH,
  SPEECH_NAMES,
  SPEECH_TIMES,
  TIMELINE_ROWS,
  speechTimesFor,
  toNumber,
  toTimeString,
} from '@/src/timer/constants';

describe('toTimeString', () => {
  it('formats seconds as M:SS with a zero-padded seconds field', () => {
    expect(toTimeString(0)).toBe('0:00');
    expect(toTimeString(5)).toBe('0:05');
    expect(toTimeString(59)).toBe('0:59');
    expect(toTimeString(60)).toBe('1:00');
    expect(toTimeString(485)).toBe('8:05');
    expect(toTimeString(1200)).toBe('20:00');
  });
});

describe('toNumber', () => {
  it('reads the colon forms', () => {
    expect(toNumber('8:00')).toBe(480);
    expect(toNumber('3:30')).toBe(210);
    expect(toNumber('12:05')).toBe(725);
    expect(toNumber('0:45')).toBe(45);
  });

  it('reads the colonless forms the timer field accepts', () => {
    expect(toNumber('800')).toBe(480);
    expect(toNumber('0800')).toBe(480);
    expect(toNumber('1230')).toBe(750);
    expect(toNumber('45')).toBe(45);
    expect(toNumber('7')).toBe(420);
  });

  it('treats a bare "10" as ten minutes, not ten seconds', () => {
    expect(toNumber('10')).toBe(600);
  });

  it('falls back to zero for the parts it cannot read', () => {
    expect(toNumber('')).toBe(0);
    expect(toNumber('abc')).toBe(0);
    expect(toNumber(':30')).toBe(30);
    expect(toNumber('5:')).toBe(300);
  });

  it('round-trips with toTimeString', () => {
    for (const seconds of [0, 1, 59, 60, 61, 599, 600, 1199, 1200]) {
      expect(toNumber(toTimeString(seconds))).toBe(seconds);
    }
  });
});

describe('speech tables', () => {
  it('keeps every table aligned with the speech names', () => {
    expect(SPEECH_TIMES).toHaveLength(DEBATE_TYPES.length);
    for (const row of SPEECH_TIMES) expect(row).toHaveLength(SPEECH_NAMES.length);
    expect(BUTTON_NAMES).toHaveLength(SPEECH_NAMES.length);
    expect(NEXT_SPEECH).toHaveLength(SPEECH_NAMES.length);
    expect(TIMELINE_ROWS.map((row) => row.label)).toEqual([...SPEECH_NAMES, 'Pause']);
  });

  it('only ever advances to a real button', () => {
    for (const next of NEXT_SPEECH) expect(BUTTON_NAMES).toContain(next);
  });

  it('moves cross-examination back to the constructive and prep to the rebuttal', () => {
    const next = (name: (typeof SPEECH_NAMES)[number]) => NEXT_SPEECH[SPEECH_NAMES.indexOf(name)];
    expect(next('Cross-x')).toBe('constructive');
    expect(next('Aff Prep')).toBe('rebuttal');
    expect(next('Neg Prep')).toBe('rebuttal');
  });
});

describe('speechTimesFor', () => {
  it('returns the minutes for a known debate type', () => {
    const pf = DEBATE_TYPES.indexOf('Public Forum');
    expect(speechTimesFor(pf)).toEqual([4, 3, 2, 2, 2]);
  });

  it('falls back to High School Policy for an unknown index', () => {
    expect(speechTimesFor(99)).toEqual(SPEECH_TIMES[0]);
    expect(speechTimesFor(-1)).toEqual(SPEECH_TIMES[0]);
  });
});
