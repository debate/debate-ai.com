import { beforeEach, describe, expect, it } from 'vitest';

import {
  HIGHLIGHT_CLASS,
  clearHighlights,
  highlightRange,
  highlightedPassages,
  removeHighlight,
} from '@/src/reader/highlights';

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML =
    '<div id="article"><p>First paragraph here.</p><p>Second <em>emphasised</em> paragraph.</p></div>';
  root = document.getElementById('article')!;
});

function rangeOver(startNode: Node, startOffset: number, endNode: Node, endOffset: number) {
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

const text = (selector: string, index = 0) =>
  root.querySelectorAll(selector)[index].firstChild as Text;

describe('highlightRange', () => {
  it('marks exactly the selected part of one text node', () => {
    const node = text('p');
    const id = highlightRange(rangeOver(node, 6, node, 15), root);
    expect(id).toBeTruthy();
    expect(highlightedPassages(root)).toEqual(['paragraph']);
    expect(root.querySelector('p')!.textContent).toBe('First paragraph here.');
  });

  it('marks a passage that spans paragraphs and inline elements as one highlight', () => {
    const start = text('p', 0);
    const end = text('em');
    const id = highlightRange(rangeOver(start, 6, end, 4), root)!;
    const marks = root.querySelectorAll(`mark.${HIGHLIGHT_CLASS}`);
    expect(marks.length).toBeGreaterThan(1);
    marks.forEach((mark) => expect((mark as HTMLElement).dataset.highlightId).toBe(id));
    expect(highlightedPassages(root)).toEqual(['paragraph here. Second emph']);
  });

  it('ignores selections outside the article and empty ones', () => {
    const outside = document.createElement('p');
    outside.textContent = 'Not the article';
    document.body.appendChild(outside);
    expect(highlightRange(rangeOver(outside.firstChild!, 0, outside.firstChild!, 3), root)).toBeNull();
    const node = text('p');
    expect(highlightRange(rangeOver(node, 2, node, 2), root)).toBeNull();
  });
});

describe('removing highlights', () => {
  it('removes one highlight and restores the original text nodes', () => {
    const node = text('p');
    const id = highlightRange(rangeOver(node, 0, node, 5), root)!;
    removeHighlight(root, id);
    expect(root.querySelector('mark')).toBeNull();
    expect(root.querySelector('p')!.childNodes).toHaveLength(1);
    expect(root.querySelector('p')!.textContent).toBe('First paragraph here.');
  });

  it('clears every highlight', () => {
    highlightRange(rangeOver(text('p', 0), 0, text('p', 0), 5), root);
    highlightRange(rangeOver(text('em'), 0, text('em'), 4), root);
    expect(highlightedPassages(root)).toHaveLength(2);
    clearHighlights(root);
    expect(highlightedPassages(root)).toEqual([]);
    expect(root.textContent).toBe('First paragraph here.Second emphasised paragraph.');
  });
});
