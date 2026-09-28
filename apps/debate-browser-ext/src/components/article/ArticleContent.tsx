/**
 * The extracted article itself: its citation line, its word count, and its
 * body at the reader's chosen zoom.
 *
 * Ported from research-agent-ui's `ArticleContent` and the
 * `LexicalArticleViewer` it renders. The viewer there runs DOMPurify over
 * server-extracted HTML before injecting it; here the body arrives from
 * src/article/readability.ts, which builds it out of an allowlist of tags and
 * attributes in the first place, so there is nothing left to strip. The
 * typography is plain CSS (src/styles/sidepanel.css) rather than the Tailwind
 * typography plugin, which this extension does not ship.
 *
 * In highlight mode, whatever the reader selects in the body is marked
 * (src/reader/highlights.ts) and clicking a mark removes it; every change is
 * reported through `onHighlightsChange` so the panel can ask the AI about it.
 */
import React, { useEffect, useMemo, useRef } from 'react';

import type { Article } from '@/src/article/types';
import {
  HIGHLIGHT_CLASS,
  highlightRange,
  highlightedPassages,
  removeHighlight,
} from '@/src/reader/highlights';

interface ArticleContentProps {
  article: Article;
  isHighlightMode: boolean;
  fontScale: number;
  /** Called with every highlighted passage whenever highlights change. */
  onHighlightsChange?: (passages: string[]) => void;
}

const ArticleContent: React.FC<ArticleContentProps> = ({
  article,
  isHighlightMode,
  fontScale,
  onHighlightsChange,
}) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  // React re-applies `dangerouslySetInnerHTML` whenever it receives a new
  // object, which would wipe every highlight on the next render. One object
  // per article keeps the body untouched until the article itself changes.
  const html = useMemo(() => ({ __html: article.html ?? '' }), [article.html]);
  const onChangeRef = useRef(onHighlightsChange);
  onChangeRef.current = onHighlightsChange;

  // A different article arrives with none of the old one's highlights.
  useEffect(() => {
    onChangeRef.current?.([]);
  }, [article.html]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !isHighlightMode) return;
    const report = () => onChangeRef.current?.(highlightedPassages(body));

    const onMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
      const id = highlightRange(selection.getRangeAt(0), body);
      if (!id) return;
      selection.removeAllRanges();
      report();
    };
    const onClick = (event: MouseEvent) => {
      const mark = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        `mark.${HIGHLIGHT_CLASS}`,
      );
      // A click that ends a new selection is not a click on a mark.
      if (!mark || !window.getSelection()?.isCollapsed) return;
      removeHighlight(body, mark.dataset.highlightId ?? '');
      report();
    };
    body.addEventListener('mouseup', onMouseUp);
    body.addEventListener('click', onClick);
    return () => {
      body.removeEventListener('mouseup', onMouseUp);
      body.removeEventListener('click', onClick);
    };
  }, [isHighlightMode]);

  return (
  <div className="border-t border-border pt-4">
    {article.title && <h1 className="mb-2 text-lg font-semibold leading-snug">{article.title}</h1>}

    {article.cite && <p className="mb-2 text-sm text-muted-foreground">{article.cite}</p>}

    {typeof article.word_count === 'number' && (
      <p className="mb-3 text-xs text-muted-foreground">
        <span className="font-semibold">Words:</span> {article.word_count.toLocaleString()}
      </p>
    )}

    <div
      ref={bodyRef}
      id="article-content"
      className={`article-prose ${isHighlightMode ? 'is-highlighting' : ''}`}
      style={{ fontSize: `${fontScale}em` }}
      dangerouslySetInnerHTML={html}
    />
  </div>
  );
};

export default ArticleContent;
