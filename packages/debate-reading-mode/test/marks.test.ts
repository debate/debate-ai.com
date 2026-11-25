import { beforeEach, describe, expect, it } from 'vitest';

import {
  chunkPassages,
  clearMarks,
  markPhrase,
  markedPassages,
  parseAutoCut,
  toggleMark,
  toggleMarks,
} from '../src/marks';

let root: HTMLElement;

function setup(html: string) {
  document.body.innerHTML = `<div id="article">${html}</div>`;
  root = document.getElementById('article')!;
}

function rangeOver(startNode: Node, startOffset: number, endNode: Node, endOffset: number) {
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

const first = (selector: string) => root.querySelector(selector)!.firstChild as Text;

describe('toggleMark', () => {
  beforeEach(() => setup('<p>The plan solves warming now.</p>'));

  it('highlights a selection, then removes exactly that part when selected again', () => {
    expect(toggleMark(rangeOver(first('p'), 4, first('p'), 15), root, 'highlight')).toBe('added');
    expect(root.querySelector('mark.reader-highlight')!.textContent).toBe('plan solves');

    const mark = first('mark');
    expect(toggleMark(rangeOver(mark, 0, mark, 4), root, 'highlight')).toBe('removed');
    expect(Array.from(root.querySelectorAll('mark')).map((m) => m.textContent)).toEqual([' solves']);
    expect(root.textContent).toBe('The plan solves warming now.');
  });

  it('underlines with <u class="reader-underline"> independently of highlights', () => {
    toggleMark(rangeOver(first('p'), 4, first('p'), 8), root, 'underline');
    expect(root.querySelector('u.reader-underline')!.textContent).toBe('plan');
    const u = first('u');
    toggleMark(rangeOver(u, 0, u, 4), root, 'highlight');
    expect(root.querySelector('u mark.reader-highlight')!.textContent).toBe('plan');
    expect(markedPassages(root)).toEqual(['plan']);
  });

  it('short-highlights inside a long highlight, separately from it', () => {
    toggleMark(rangeOver(first('p'), 4, first('p'), 15), root, 'highlight');
    const mark = first('mark');
    expect(toggleMark(rangeOver(mark, 0, mark, 4), root, 'short-highlight')).toBe('added');
    expect(root.querySelector('mark.reader-highlight mark.reader-highlight-short')!.textContent).toBe('plan');
    expect(markedPassages(root)).toEqual(['plan solves']);
    const short = first('mark.reader-highlight-short');
    expect(toggleMark(rangeOver(short, 0, short, 4), root, 'short-highlight')).toBe('removed');
    expect(root.querySelector('.reader-highlight-short')).toBeNull();
    expect(root.querySelector('mark.reader-highlight')!.textContent).toBe('plan solves');
  });

  it('emphasizes words with <strong class="reader-emphasis">, and takes it off again', () => {
    expect(toggleMark(rangeOver(first('p'), 9, first('p'), 15), root, 'emphasis')).toBe('added');
    expect(root.querySelector('strong.reader-emphasis')!.textContent).toBe('solves');
    expect(markedPassages(root)).toEqual(['solves']);
    const strong = first('strong');
    expect(toggleMark(rangeOver(strong, 0, strong, 6), root, 'emphasis')).toBe('removed');
    expect(root.querySelector('strong')).toBeNull();
    expect(root.textContent).toBe('The plan solves warming now.');
  });

  it('marks only the unmarked part when the selection is partly marked', () => {
    toggleMark(rangeOver(first('p'), 4, first('p'), 8), root, 'highlight');
    const p = root.querySelector('p')!;
    expect(toggleMark(rangeOver(p, 0, p, p.childNodes.length), root, 'highlight')).toBe('added');
    expect(root.querySelectorAll('mark.reader-highlight')).toHaveLength(3);
    expect(root.textContent).toBe('The plan solves warming now.');
  });

  it('ignores a collapsed range or one outside the root', () => {
    expect(toggleMark(rangeOver(first('p'), 2, first('p'), 2), root, 'highlight')).toBeNull();
    const outside = document.createElement('p');
    outside.textContent = 'elsewhere';
    document.body.appendChild(outside);
    expect(toggleMark(rangeOver(outside.firstChild!, 0, outside.firstChild!, 3), root, 'highlight')).toBeNull();
  });
});

describe('toggleMarks', () => {
  it('highlights and underlines one selection together, then removes both', () => {
    setup('<p>The plan solves warming now.</p>');
    expect(toggleMarks(rangeOver(first('p'), 4, first('p'), 15), root, ['highlight', 'underline'])).toEqual(['added', 'added']);
    expect(root.querySelector('mark.reader-highlight')!.textContent).toBe('plan solves');
    expect(root.querySelector('u.reader-underline')!.textContent).toBe('plan solves');
    const p = root.querySelector('p')!;
    const range = document.createRange();
    range.selectNodeContents(p.childNodes[1]);
    expect(toggleMarks(range, root, ['highlight', 'underline'])).toEqual(['removed', 'removed']);
    expect(root.innerHTML).toBe('<p>The plan solves warming now.</p>');
  });
});

describe('toggleMark on authored marks', () => {
  beforeEach(() => setup('<p>We <mark class="debate-hl">must <strong>act</strong> today</mark>.</p>'));

  it('takes the highlight off part of an authored mark but keeps its underline', () => {
    const strongText = first('strong');
    expect(toggleMark(rangeOver(strongText, 0, strongText, 3), root, 'highlight')).toBe('removed');
    const marks = Array.from(root.querySelectorAll('mark.debate-hl'));
    expect(marks.map((m) => [m.textContent, m.classList.contains('debate-hl--no-highlight')])).toEqual([
      ['must ', false],
      ['act', true],
      [' today', false],
    ]);
    expect(root.querySelector('mark.debate-hl--no-highlight strong')!.textContent).toBe('act');
    expect(root.textContent).toBe('We must act today.');

    const off = root.querySelector('mark.debate-hl--no-highlight strong')!.firstChild as Text;
    expect(toggleMark(rangeOver(off, 0, off, 3), root, 'highlight')).toBe('added');
    expect(root.querySelector('.debate-hl--no-highlight')).toBeNull();
  });

  it('removes the authored mark when both kinds come off', () => {
    const p = root.querySelector('p')!;
    // Every node between "We " and the final ".": the marks, however many there are.
    const all = () => rangeOver(p, 1, p, p.childNodes.length - 1);
    toggleMark(all(), root, 'highlight');
    expect(root.querySelectorAll('mark.debate-hl--no-highlight').length).toBeGreaterThan(0);
    toggleMark(all(), root, 'underline');
    expect(root.querySelector('mark')).toBeNull();
    expect(root.querySelector('strong')!.textContent).toBe('act');
    expect(root.textContent).toBe('We must act today.');
  });

  it('short-highlights authored text with a reader mark, leaving the authored mark whole', () => {
    const strongText = first('strong');
    expect(toggleMark(rangeOver(strongText, 0, strongText, 3), root, 'short-highlight')).toBe('added');
    expect(root.querySelector('mark.reader-highlight-short')!.textContent).toBe('act');
    expect(root.querySelector('.debate-hl--no-highlight, .debate-hl--no-underline')).toBeNull();
    clearMarks(root);
    expect(root.querySelector('.reader-highlight-short')).toBeNull();
  });

  it('clearMarks restores authored marks and drops the reader’s', () => {
    const strongText = first('strong');
    toggleMark(rangeOver(strongText, 0, strongText, 3), root, 'highlight');
    toggleMark(rangeOver(first('p'), 0, first('p'), 2), root, 'underline');
    clearMarks(root);
    expect(root.querySelector('.reader-underline, .debate-hl--no-highlight')).toBeNull();
    expect(root.textContent).toBe('We must act today.');
  });
});

describe('markPhrase', () => {
  beforeEach(() => setup('<p>Warming is “real” and <em>accelerating</em>   fast.</p><p>Act now.</p>'));

  it('finds a phrase across inline elements, ignoring case, quotes and spacing', () => {
    expect(markPhrase(root, 'is "real" and accelerating fast', 'underline')).toBe(true);
    expect(markedPassages(root)).toEqual(['is “real” and accelerating fast']);
  });

  it('skips an occurrence already marked and reports a missing phrase', () => {
    expect(markPhrase(root, 'act now', 'highlight')).toBe(true);
    expect(markPhrase(root, 'act now', 'highlight')).toBe(false);
    expect(markPhrase(root, 'not in the text', 'highlight')).toBe(false);
  });
});

describe('parseAutoCut and chunkPassages', () => {
  it('reads JSON inside a code fence and drops non-strings', () => {
    expect(parseAutoCut('```json\n{"underline":["a b", 3], "highlight":["a"]}\n```')).toEqual({
      underline: ['a b'],
      highlight: ['a'],
    });
    expect(parseAutoCut('no json here')).toEqual({ underline: [], highlight: [] });
  });

  it('packs paragraphs into chunks under the limit', () => {
    expect(chunkPassages('aaaa\n\nbbbb\n\ncccc', 10)).toEqual(['aaaa\n\nbbbb', 'cccc']);
  });
});
