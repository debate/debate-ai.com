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
 */
import React from 'react';

import type { Article } from '@/src/article/types';

interface ArticleContentProps {
  article: Article;
  isHighlightMode: boolean;
  fontScale: number;
}

const ArticleContent: React.FC<ArticleContentProps> = ({
  article,
  isHighlightMode,
  fontScale,
}) => (
  <div className="border-t border-border pt-4">
    {article.title && <h1 className="mb-2 text-lg font-semibold leading-snug">{article.title}</h1>}

    {article.cite && <p className="mb-2 text-sm text-muted-foreground">{article.cite}</p>}

    {typeof article.word_count === 'number' && (
      <p className="mb-3 text-xs text-muted-foreground">
        <span className="font-semibold">Words:</span> {article.word_count.toLocaleString()}
      </p>
    )}

    <div
      id="article-content"
      className={`article-prose ${isHighlightMode ? 'is-highlighting' : ''}`}
      style={{ fontSize: `${fontScale}em` }}
      dangerouslySetInnerHTML={{ __html: article.html ?? '' }}
    />
  </div>
);

export default ArticleContent;
