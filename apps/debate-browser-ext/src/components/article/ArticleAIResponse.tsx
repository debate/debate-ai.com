/**
 * One AI answer about the article, with its loading and error states.
 *
 * Ported from research-agent-ui's `ArticleAIResponse`. It renders HTML, as the
 * original does, but the HTML is produced here by src/ai/markdown.ts, which
 * escapes the model's text before adding any tags of its own — the app this
 * came from could lean on its server having done that.
 */
import React from 'react';

import { renderMarkdown } from '@/src/ai/markdown';

interface ArticleAIResponseProps {
  response: string;
  isLoading: boolean;
  error?: string;
}

const ArticleAIResponse: React.FC<ArticleAIResponseProps> = ({
  response,
  isLoading,
  error,
}) => (
  <>
    {isLoading && (
      <div className="flex justify-center">
        <div
          role="status"
          aria-label="Waiting for the AI answer"
          className="h-7 w-7 animate-spin rounded-full border-b-2 border-primary"
        />
      </div>
    )}

    {response && (
      <div
        className="answer-prose rounded-lg bg-muted p-3 text-sm shadow-md"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(response) }}
      />
    )}

    {error && (
      <div className="rounded-md bg-destructive p-2 text-sm text-destructive-foreground">
        {error}
      </div>
    )}
  </>
);

export default ArticleAIResponse;
