/**
 * Saving the article panel's article to the reader's debate-ai.com account.
 *
 * The document is built by src/article/document.ts and stored with
 * `POST /api/doc/documents` under the extension's session (a bearer token —
 * see src/auth/session.ts for why it is not the site's cookie). It then shows
 * up among the reader's REASON Docs at `/reason-editor` on the site.
 */
import { authorizedFetch } from '@/src/auth/session';
import { getSettings } from '@/src/settings/settings';

import { buildSavedArticleDocument } from './document';
import type { Article, ChatMessage } from './types';

export interface SavedArticle {
  id: number;
  title: string;
  /** Where the reader can find it in the app. */
  openUrl: string;
}

export async function saveArticleToAccount(
  article: Article,
  chatHistory: readonly ChatMessage[],
): Promise<SavedArticle> {
  const document = buildSavedArticleDocument(article, chatHistory);
  const response = await authorizedFetch('/api/doc/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(document),
  });

  if (response.status === 401) {
    throw new Error('Your Debate AI session has expired. Sign in again to save.');
  }
  if (!response.ok) {
    throw new Error(`Could not save this article (${response.status}).`);
  }

  const created = (await response.json()) as { id?: number; title?: string };
  const { apiBase } = await getSettings();
  return {
    id: created.id ?? 0,
    title: created.title ?? document.title,
    openUrl: `${apiBase.replace(/\/$/, '')}/reason-editor`,
  };
}
