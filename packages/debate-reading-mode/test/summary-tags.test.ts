import { beforeEach, describe, expect, it } from 'vitest';

import { clearMarks, removeAllMarks, toggleMark } from '../src/marks';
import {
  SUMMARY_MAX_LENGTH,
  cleanSummary,
  getSummary,
  parseSummary,
  removeSummaryTag,
  setSummaryTag,
  summaryPrompt,
  summarySourceText,
  summaryTags,
  summaryTargets,
  summaryTargetsAt,
  syncSummaryTags,
} from '../src/summary-tags';

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

const PAGE =
  '<p id="p">Alpha <mark class="reader-highlight">first claim</mark> beta <mark class="reader-highlight-short">second</mark> gamma <mark class="debate-hl">third claim</mark> delta.</p>';

describe('summaryTargets', () => {
  beforeEach(() => setup(PAGE));

  it('finds the long, short and authored highlights a selection touches, in order', () => {
    const p = root.querySelector('#p')!;
    const targets = summaryTargets(rangeOver(p.firstChild!, 0, p.lastChild!, 3), root);
    expect(targets.map((el) => el.textContent)).toEqual(['first claim', 'second', 'third claim']);
  });

  it('takes a highlight whole when only part of it is selected', () => {
    const mark = root.querySelector('mark.reader-highlight')!;
    const targets = summaryTargets(rangeOver(mark.firstChild!, 2, mark.firstChild!, 5), root);
    expect(targets.map((el) => el.textContent)).toEqual(['first claim']);
  });

  it('is empty for text that is not highlighted, or a collapsed range', () => {
    const p = root.querySelector('#p')!;
    expect(summaryTargets(rangeOver(p.firstChild!, 0, p.firstChild!, 3), root)).toEqual([]);
    expect(summaryTargets(rangeOver(p.firstChild!, 2, p.firstChild!, 2), root)).toEqual([]);
  });

  it('ignores an authored mark whose highlight was taken off', () => {
    root.querySelector('mark.debate-hl')!.classList.add('debate-hl--no-highlight');
    const p = root.querySelector('#p')!;
    const targets = summaryTargets(rangeOver(p.lastChild!.previousSibling!, 0, p.lastChild!, 3), root);
    expect(targets).toEqual([]);
  });
});

describe('setSummaryTag', () => {
  beforeEach(() => setup(PAGE));

  const all = () => Array.from(root.querySelectorAll<HTMLElement>('mark'));

  it('annotates every highlight of a multi-highlight selection as one tag, with one badge on the last', () => {
    const group = setSummaryTag(root, all(), '  Claims  one to three ');
    expect(group).toBeTruthy();
    for (const el of all()) {
      expect(el.getAttribute('data-summary-tag')).toBe('Claims one to three');
      expect(el.getAttribute('data-summary-group')).toBe(group);
      expect(el.title).toBe('Claims one to three');
    }
    expect(all().map((el) => el.hasAttribute('data-summary-end'))).toEqual([false, false, true]);
    expect(summaryTags(root)).toEqual([
      { group, summary: 'Claims one to three', text: 'first claim … second … third claim' },
    ]);
  });

  it('edits in place: tagging a tagged highlight keeps its group and takes the rest of the tag with it', () => {
    const marks = all();
    const group = setSummaryTag(root, marks, 'Old');
    expect(setSummaryTag(root, [marks[0]], 'New')).toBe(group);
    expect(marks.map(getSummaryOf)).toEqual(['New', 'New', 'New']);
  });

  it('removes the tag with a blank summary or removeSummaryTag', () => {
    const marks = all();
    setSummaryTag(root, marks, 'Hello');
    expect(setSummaryTag(root, [marks[1]], '   ')).toBeNull();
    expect(root.querySelector('[data-summary-tag], [data-summary-group], [data-summary-end], [title]')).toBeNull();
    setSummaryTag(root, marks, 'Hello');
    removeSummaryTag(root, [marks[2]]);
    expect(root.querySelector('[data-summary-tag]')).toBeNull();
  });

  it('is found again from a node inside any of its highlights', () => {
    const marks = all();
    setSummaryTag(root, marks, 'Hello');
    expect(summaryTargetsAt(marks[1].firstChild!, root)).toEqual(marks);
    expect(summaryTargetsAt(root.querySelector('#p')!.firstChild!, root)).toEqual([]);
  });

  it('caps the summary length and collapses whitespace', () => {
    expect(cleanSummary('a\n\n b')).toBe('a b');
    expect(cleanSummary('x'.repeat(SUMMARY_MAX_LENGTH + 50))).toHaveLength(SUMMARY_MAX_LENGTH);
  });

  function getSummaryOf(el: HTMLElement) {
    return getSummary([el]);
  }
});

describe('summarySourceText', () => {
  it('reads a short highlight inside a long one once', () => {
    setup('<p><mark class="reader-highlight">one <mark class="reader-highlight-short">two</mark> three</mark></p>');
    const marks = Array.from(root.querySelectorAll<HTMLElement>('mark'));
    expect(summarySourceText(marks)).toBe('one two three');
  });
});

describe('tags follow the marks', () => {
  it('keeps the tag on both halves when a highlight is split, with a single badge', () => {
    setup('<p id="p"><mark class="reader-highlight">alpha beta gamma</mark></p>');
    const mark = root.querySelector<HTMLElement>('mark')!;
    setSummaryTag(root, [mark], 'Greek');
    const text = mark.firstChild!;
    toggleMark(rangeOver(text, 6, text, 10), root, 'highlight');
    syncSummaryTags(root);
    const marks = Array.from(root.querySelectorAll<HTMLElement>('mark'));
    expect(marks.map((el) => el.textContent)).toEqual(['alpha ', ' gamma']);
    expect(marks.map((el) => el.getAttribute('data-summary-tag'))).toEqual(['Greek', 'Greek']);
    expect(marks.map((el) => el.hasAttribute('data-summary-end'))).toEqual([false, true]);
  });

  it('drops the tag from an authored highlight that was turned off, and from Reset and Remove all marks', () => {
    setup('<p id="p">x <mark class="debate-hl">claim</mark> y</p>');
    const mark = root.querySelector<HTMLElement>('mark')!;
    setSummaryTag(root, [mark], 'Claim');
    mark.classList.add('debate-hl--no-highlight');
    syncSummaryTags(root);
    expect(mark.hasAttribute('data-summary-tag')).toBe(false);

    mark.classList.remove('debate-hl--no-highlight');
    setSummaryTag(root, [mark], 'Claim');
    clearMarks(root);
    expect(mark.hasAttribute('data-summary-tag')).toBe(false);

    setSummaryTag(root, [mark], 'Claim');
    removeAllMarks(root);
    expect(mark.hasAttribute('data-summary-tag')).toBe(false);
  });
});

describe('prompt and reply', () => {
  it('caps what is sent to the model', () => {
    expect(summaryPrompt('x'.repeat(10_000)).length).toBeLessThan(6100);
  });

  it('reads a reply as one clean line', () => {
    expect(parseSummary('"Summary: Warming is   real."')).toBe('Warming is real.');
    expect(parseSummary('```\nTag: ok\n```')).toBe('ok');
    expect(parseSummary('   ')).toBe('');
  });
});
