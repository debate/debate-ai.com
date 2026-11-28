import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { click, render } from './helpers/render';

import { ReuseMatchCard } from '@/src/components/ReuseMatchCard';
import type { CardAnnotation, ReuseCardDetails, ReuseMatch } from '@/src/reuse/api';

const card = (overrides: Partial<ReuseCardDetails> = {}): ReuseCardDetails => ({
  cardId: 1,
  tag: 'Warming causes extinction',
  cite: 'Smith 21',
  fullcite: 'Smith 2021, Prof of Climate',
  author: 'Smith',
  year: 2021,
  quotes: ['first quote'],
  caselist: 'openev',
  event: 'cx',
  level: 'varsity',
  side: 'aff',
  duplicateCount: 1,
  ...overrides,
});

const annotation = (overrides: Partial<CardAnnotation> = {}): CardAnnotation => ({
  claim: 'Warming is bad',
  supportScore: 7,
  authorQuality: { rating: 'strong', qualifications: 'Climate scientist at MIT', concerns: '' },
  flaws: [],
  ...overrides,
});

const show = (props: Parameters<typeof ReuseMatchCard>[0]) =>
  render(createElement('ul', null, createElement(ReuseMatchCard, props)));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ReuseMatchCard headline', () => {
  it('shows the tag and a cite line built from author, year, caselist, event and level', async () => {
    const { container } = await show({ match: { card: card() } });

    expect(container.querySelector('.font-semibold')!.textContent).toBe('Warming causes extinction');
    expect(container.querySelector('.text-muted-foreground')!.textContent).toBe('Smith 2021 — openev — CX varsity');
  });

  it('falls back to the cite when the card has no author, and omits blank parts', async () => {
    const { container } = await show({
      match: { card: card({ author: null, year: null, caselist: '', level: '', event: 'pf' }) },
    });
    expect(container.querySelector('.text-muted-foreground')!.textContent).toBe('Smith 21 — PF');
  });

  it('uses the argument block, cite and topic for a match with no card', async () => {
    const { container } = await show({ match: { argBlock: 'Case turn', cite: 'Doe 19', topic: 'Space' } });
    expect(container.querySelector('.font-semibold')!.textContent).toBe('Case turn');
    expect(container.querySelector('.text-muted-foreground')!.textContent).toBe('Doe 19 — Space');
  });

  it('calls an unnamed match untitled', async () => {
    const { container } = await show({ match: {} });
    expect(container.querySelector('.font-semibold')!.textContent).toBe('(untitled)');
  });
});

describe('ReuseMatchCard duplicates and quotes', () => {
  it.each([
    [1, null],
    [2, 'Read 2× across caselists'],
    [1400, 'Read 1.4k× across caselists'],
    [10000, 'Read 10k× across caselists'],
    [25400, 'Read 25k× across caselists'],
  ])('reports %i duplicates as %s', async (duplicateCount, expected) => {
    const { container } = await show({ match: { card: card({ duplicateCount }) } });
    const note = [...container.querySelectorAll('div')].find((div) => /Read .* across/.test(div.textContent ?? ''));
    expect(note?.textContent ?? null).toBe(expected);
  });

  it('shows the first three highlighted quotes and counts the rest', async () => {
    const quotes = ['one', 'two', 'three', 'four', 'five'];
    const { container } = await show({ match: { card: card({ quotes }) } });

    const items = [...container.querySelectorAll('li li')].map((li) => li.textContent);
    expect(items).toEqual(['“one”', '“two”', '“three”', '+2 more highlighted']);
  });

  it('shows no quote list when the card has none', async () => {
    const { container } = await show({ match: { card: card({ quotes: [] }) } });
    expect(container.querySelector('ul ul')).toBeNull();
  });
});

describe('ReuseMatchCard annotation', () => {
  it('offers to annotate a corpus card, and calls back when clicked', async () => {
    const onAnnotate = vi.fn();
    const { container } = await show({ match: { card: card() }, onAnnotate });

    const button = container.querySelector('button')!;
    expect(button.textContent).toBe('Find flaws & rate author');
    await click(button);
    expect(onAnnotate).toHaveBeenCalledTimes(1);
  });

  it('disables the button while annotating, and shows an error from the last attempt', async () => {
    const { container } = await show({
      match: { card: card() },
      onAnnotate: () => {},
      state: { loading: true, error: 'Rate limited' },
    });
    const button = container.querySelector('button')!;
    expect(button.textContent).toBe('Annotating…');
    expect(button.disabled).toBe(true);
    expect(container.textContent).toContain('Rate limited');
  });

  it('offers nothing for a match without a card or without a handler', async () => {
    expect((await show({ match: { argBlock: 'x' }, onAnnotate: () => {} })).container.querySelector('button')).toBeNull();
    expect((await show({ match: { card: card() } })).container.querySelector('button')).toBeNull();
  });

  it('shows the annotation with the author rating, support score, qualifications and concerns', async () => {
    const match: ReuseMatch = {
      card: card(),
      annotation: annotation({
        authorQuality: { rating: 'weak', qualifications: 'Blogger', concerns: 'Funded by industry' },
        supportScore: 3,
      }),
    };
    const { container } = await show({ match, onAnnotate: () => {} });

    expect(container.textContent).toContain('Author: weak');
    expect(container.textContent).toContain('Support 3/10');
    expect(container.textContent).toContain('Blogger');
    expect(container.textContent).toContain('⚠ Funded by industry');
    expect(container.querySelector('.bg-red-50')).not.toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  it('lets an annotation fetched in the popup take over from the one on the match', async () => {
    const { container } = await show({
      match: { card: card(), annotation: annotation({ supportScore: 2 }) },
      state: { annotation: annotation({ supportScore: 9 }) },
    });
    expect(container.textContent).toContain('Support 9/10');
    expect(container.textContent).not.toContain('Support 2/10');
  });

  it('lists each flaw with its severity and explanation', async () => {
    const { container } = await show({
      match: {
        card: card(),
        annotation: annotation({
          authorQuality: { rating: 'unknown', qualifications: '', concerns: '' },
          flaws: [
            { flaw: 'Cherry-picked', severity: 'high', explanation: 'Ignores the counter-study' },
            { flaw: 'Dated', severity: 'low', explanation: '' },
          ],
        }),
      },
    });

    const dots = [...container.querySelectorAll('[title$="severity"]')];
    expect(dots.map((dot) => dot.getAttribute('title'))).toEqual(['high severity', 'low severity']);
    expect(dots[0].className).toContain('bg-red-500');
    expect(dots[1].className).toContain('bg-slate-400');
    expect(container.textContent).toContain('Cherry-picked — Ignores the counter-study');
    expect(container.textContent).not.toContain('Dated —');
    expect(container.textContent).not.toContain('⚠');
  });
});
