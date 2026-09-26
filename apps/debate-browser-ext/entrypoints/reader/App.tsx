/**
 * The article panel: the page you are on, in reading mode, with an AI you can
 * ask about it.
 *
 * A port of research-agent-ui's `ArticleExtractPanel`
 * (qwksearch-research-agent/packages/research-agent-ui/src/components/ArticleReader)
 * — the same layout, the same toolbar, the same Ask/Suggest/chat-history flow,
 * the same Alt-key shortcuts and reading zoom. What is different is where each
 * half of it comes from, and both differences are the point of the port:
 *
 * - **The article.** There, a server fetched the URL and extracted it. Here the
 *   page is read out of the tab the reader is already looking at
 *   (src/reader/snapshot.ts) and extracted in this page
 *   (src/article/extract.ts), so it works on any page the reader can see —
 *   including ones behind their own login that no server-side fetch would get.
 * - **The answers.** There, app endpoints held the model keys. Here it is the
 *   reader's own debate-ai.com account or their own provider key
 *   (src/ai/article-ai.ts).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';

import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { NotReadableError, articleToPlainText, extractArticle } from '@/src/article/extract';
import type { Article, ChatMessage, PageSnapshot } from '@/src/article/types';
import {
  AiNotConfiguredError,
  askArticleQuestion,
  describeActiveProvider,
  suggestFollowups,
} from '@/src/ai/article-ai';
import { saveArticleToAccount } from '@/src/article/save';
import { isSignedIn } from '@/src/auth/session';
import { useAccount } from '@/src/auth/useAccount';
import AccountBar from '@/src/components/article/AccountBar';
import ArticleAIResponse from '@/src/components/article/ArticleAIResponse';
import ArticleActionButtons, {
  ARTICLE_TOOLBAR_SHORTCUTS,
} from '@/src/components/article/ArticleActionButtons';
import ArticleContent from '@/src/components/article/ArticleContent';
import ArticleFollowupQuestions from '@/src/components/article/ArticleFollowupQuestions';
import ArticlePromptInput from '@/src/components/article/ArticlePromptInput';
import {
  READER_SNAPSHOT_MESSAGE,
  READER_TAB_CHANGED_MESSAGE,
  requestReaderPanelClose,
} from '@/src/reader/panel';
import { checkPageForExistingCards } from '@/src/reuse/api';
import {
  DEFAULT_SUMMARIZE_PROMPT,
  getSettings,
  type Settings,
} from '@/src/settings/settings';

const MIN_FONT_SCALE = 0.5;
const MAX_FONT_SCALE = 1.8;
const FONT_SCALE_STEP = 0.1;
const FONT_SCALE_KEY = 'articleFontScale';

/** How much of the article body is sent to a model. */
const MAX_ARTICLE_CHARS = 15000;

/** A short-lived note under the toolbar — "Copied!", the reuse-check answer. */
interface Notice {
  tone: 'info' | 'warn';
  text: string;
  /** An optional link shown after the text, e.g. to the saved document. */
  link?: { href: string; label: string };
}

/** Hides the panel; the page it overlays keeps it, ready to toggle back. */
const closePanel = requestReaderPanelClose;

export default function App() {
  const account = useAccount();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [provider, setProvider] = useState<{ label: string; ready: boolean } | null>(null);

  const [article, setArticle] = useState<Article | null>(null);
  const [selectionText, setSelectionText] = useState('');
  const [extractError, setExtractError] = useState('');
  const [isExtracting, setIsExtracting] = useState(true);
  const [pageChanged, setPageChanged] = useState(false);

  const [userPrompt, setUserPrompt] = useState(DEFAULT_SUMMARIZE_PROMPT);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [aiResponse, setAiResponse] = useState('');
  const [aiError, setAiError] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const [followupQuestions, setFollowupQuestions] = useState<string[]>([]);
  const [followupError, setFollowupError] = useState('');
  const [isLoadingFollowups, setIsLoadingFollowups] = useState(false);

  const [isCheckingCards, setIsCheckingCards] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isHighlightMode, setIsHighlightMode] = useState(false);
  const [fontScale, setFontScale] = useState(1);

  // Holds the latest toolbar handlers so the global keydown listener, which is
  // registered once, always calls current closures rather than stale ones.
  const shortcutActionsRef = useRef<Partial<Record<string, () => void>>>({});

  /** Shows a note for a few seconds, replacing whatever was there. */
  const flashNotice = useCallback((next: Notice) => {
    setNotice(next);
    // A notice with a link stays long enough to be clicked.
    const duration = next.link ? 10000 : 4000;
    window.setTimeout(() => setNotice((current) => (current === next ? null : current)), duration);
  }, []);

  // Settings decide the prompt, the provider strip and how many follow-ups to
  // ask for, and are re-read whenever Options saves.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [stored, activeProvider] = await Promise.all([
        getSettings(),
        describeActiveProvider(),
      ]);
      if (cancelled) return;
      setSettings(stored);
      setProvider({ label: activeProvider.label, ready: activeProvider.ready });
      setUserPrompt((current) =>
        current === DEFAULT_SUMMARIZE_PROMPT ? stored.summarizePrompt : current,
      );
    };
    void load();
    const onChanged = () => void load();
    browser.storage.sync.onChanged.addListener(onChanged);
    browser.storage.local.onChanged.addListener(onChanged);
    return () => {
      cancelled = true;
      browser.storage.sync.onChanged.removeListener(onChanged);
      browser.storage.local.onChanged.removeListener(onChanged);
    };
  }, []);

  // Restore the reader's preferred zoom.
  useEffect(() => {
    const stored = Number.parseFloat(localStorage.getItem(FONT_SCALE_KEY) || '');
    if (!Number.isNaN(stored)) {
      setFontScale(Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, stored)));
    }
  }, []);

  const persistFontScale = (scale: number) => {
    const clamped = Math.min(
      MAX_FONT_SCALE,
      Math.max(MIN_FONT_SCALE, Math.round(scale * 100) / 100),
    );
    setFontScale(clamped);
    try {
      localStorage.setItem(FONT_SCALE_KEY, String(clamped));
    } catch (error) {
      console.error('Error storing article font scale:', error);
    }
  };

  /** Reads the tab the reader is on and turns it into the article shown here. */
  const readCurrentPage = useCallback(async () => {
    setIsExtracting(true);
    setExtractError('');
    setPageChanged(false);
    try {
      const response = (await browser.runtime.sendMessage({
        type: READER_SNAPSHOT_MESSAGE,
      })) as { ok: boolean; snapshot?: PageSnapshot; error?: string };

      if (!response?.ok || !response.snapshot) {
        setArticle(null);
        setExtractError(response?.error || 'Could not read this page.');
        return;
      }

      const extracted = extractArticle(response.snapshot);
      setArticle(extracted);
      setSelectionText(response.snapshot.selectionText.trim());
      // A fresh page starts a fresh conversation — the old answers were about
      // a different article.
      setChatHistory([]);
      setAiResponse('');
      setAiError('');
      setFollowupQuestions([]);
      setFollowupError('');
    } catch (error) {
      setArticle(null);
      setExtractError(
        error instanceof NotReadableError
          ? error.message
          : `Could not read this page: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsExtracting(false);
    }
  }, []);

  useEffect(() => {
    void readCurrentPage();
  }, [readCurrentPage]);

  // The background worker says when a tab has moved to another page. Every
  // open panel hears it, so only this panel's own tab counts. The panel offers
  // to follow rather than re-extracting underneath the reader mid-read.
  useEffect(() => {
    let ownTabId: number | undefined;
    void browser.tabs.getCurrent().then((tab) => {
      ownTabId = tab?.id;
    });
    const onMessage = (message: unknown) => {
      const { type, tabId } = (message as { type?: string; tabId?: number } | undefined) ?? {};
      if (type === READER_TAB_CHANGED_MESSAGE && (ownTabId == null || tabId === ownTabId)) {
        setPageChanged(true);
      }
    };
    browser.runtime.onMessage.addListener(onMessage);
    return () => browser.runtime.onMessage.removeListener(onMessage);
  }, []);

  /** Turns any failure from the AI layer into something worth reading. */
  const describeAiError = (error: unknown): string => {
    if (error instanceof AiNotConfiguredError) return error.message;
    if (error instanceof Error) return error.message;
    return 'Failed to get an AI response.';
  };

  const askQuestion = useCallback(
    async (question: string) => {
      if (!article) return;
      const body = articleToPlainText(article, MAX_ARTICLE_CHARS);
      // A reader who highlighted something before opening the panel almost
      // always means "about this part", so it is asked alongside the question.
      const fullQuestion = [selectionText, question].filter(Boolean).join('\n');

      setIsLoadingAI(true);
      setAiError('');
      try {
        const answer = await askArticleQuestion({
          article: body,
          question: fullQuestion,
          chatHistory: chatHistory.slice(-5).map((turn) => ({
            role: turn.role,
            content: turn.content,
          })),
        });
        setAiResponse(answer);
        setChatHistory((previous) => [
          ...previous,
          { role: 'user', content: question, time: new Date().toISOString() },
          { role: 'assistant', content: answer, time: new Date().toISOString() },
        ]);
      } catch (error) {
        setAiError(describeAiError(error));
      } finally {
        setIsLoadingAI(false);
      }
    },
    [article, chatHistory, selectionText],
  );

  const generateFollowups = useCallback(async () => {
    if (!article) return;
    setIsLoadingFollowups(true);
    setFollowupError('');
    try {
      const questions = await suggestFollowups({
        article: articleToPlainText(article, MAX_ARTICLE_CHARS),
        chatHistory: chatHistory.slice(-5).map((turn) => ({
          role: turn.role,
          content: turn.content,
        })),
        maxQuestions: settings?.maxFollowupQuestions ?? 4,
      });
      setFollowupQuestions(questions);
    } catch (error) {
      setFollowupError(describeAiError(error));
    } finally {
      setIsLoadingFollowups(false);
    }
  }, [article, chatHistory, settings?.maxFollowupQuestions]);

  const copyArticle = useCallback(async () => {
    if (!article) return;
    const plain = articleToPlainText(article, Number.POSITIVE_INFINITY);
    const text = [aiResponse, article.cite, plain].filter(Boolean).join('\n\n\n');
    try {
      await navigator.clipboard.writeText(text);
      flashNotice({ tone: 'info', text: 'Copied the citation and article text.' });
    } catch (error) {
      flashNotice({ tone: 'warn', text: 'Could not copy to the clipboard.' });
      console.error('Failed to copy to clipboard:', error);
    }
  }, [aiResponse, article, flashNotice]);

  const shareArticle = useCallback(async () => {
    const url = article?.url;
    if (!url) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: article?.title, text: article?.cite, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      flashNotice({ tone: 'info', text: 'Link copied.' });
    } catch (error) {
      // A cancelled share is not a failure worth reporting.
      if ((error as Error)?.name !== 'AbortError') {
        console.error('Failed to share article:', error);
      }
    }
  }, [article, flashNotice]);

  /** The extension's own card-reuse check, for the page being read. */
  const checkForExistingCards = useCallback(async () => {
    const url = article?.url;
    if (!url || !settings) return;
    setIsCheckingCards(true);
    try {
      const result = await checkPageForExistingCards(url, settings.apiBase);
      flashNotice(
        result.alreadyCut
          ? {
              tone: 'warn',
              text: `Already cut: ${result.matches.length} existing ${
                result.matches.length === 1 ? 'entry' : 'entries'
              } for this page.`,
            }
          : { tone: 'info', text: 'No existing cards for this page — safe to cut.' },
      );
    } catch (error) {
      flashNotice({
        tone: 'warn',
        text: error instanceof Error ? error.message : 'Reuse check failed.',
      });
    } finally {
      setIsCheckingCards(false);
    }
  }, [article?.url, flashNotice, settings]);

  /**
   * Saves the article — with the panel's Q&A so far — to the reader's
   * debate-ai.com account, signing them in first if they are not.
   */
  const saveToAccount = useCallback(async () => {
    if (!article || isSaving) return;
    setIsSaving(true);
    try {
      if (!(await isSignedIn())) {
        flashNotice({ tone: 'info', text: 'Sign in to Debate AI to save this article…' });
        await account.signIn();
        if (!(await isSignedIn())) {
          flashNotice({ tone: 'warn', text: 'Sign in to Debate AI to save articles to your account.' });
          return;
        }
      }
      const saved = await saveArticleToAccount(article, chatHistory);
      flashNotice({
        tone: 'info',
        text: `Saved “${saved.title}” to your Debate AI documents.`,
        link: { href: saved.openUrl, label: 'Open' },
      });
    } catch (error) {
      flashNotice({
        tone: 'warn',
        text: error instanceof Error ? error.message : 'Could not save this article.',
      });
    } finally {
      setIsSaving(false);
    }
  }, [account, article, chatHistory, flashNotice, isSaving]);

  // Keep the shortcut map pointing at the freshest closures every render.
  shortcutActionsRef.current = {
    ask: () => void askQuestion(userPrompt),
    suggest: () => void generateFollowups(),
    copy: () => void copyArticle(),
    highlight: () => setIsHighlightMode((previous) => !previous),
    cards: () => void checkForExistingCards(),
    save: () => void saveToAccount(),
    open: () => {
      if (article?.url) window.open(article.url, '_blank', 'noopener,noreferrer');
    },
    zoomIn: () => persistFontScale(fontScale + FONT_SCALE_STEP),
    zoomOut: () => persistFontScale(fontScale - FONT_SCALE_STEP),
    zoomReset: () => persistFontScale(1),
    close: closePanel,
  };

  // Alt/Option + key runs a toolbar action; Escape closes. Typing in an input,
  // textarea or contenteditable is never intercepted. Shortcuts are matched on
  // `event.code`, not `event.key`, because holding Option on macOS rewrites
  // `key` to an alternate character (Option+A becomes "å").
  useEffect(() => {
    const codeForKey = (key: string): string => {
      if (/^[a-z]$/.test(key)) return `Key${key.toUpperCase()}`;
      if (/^[0-9]$/.test(key)) return `Digit${key}`;
      if (key === '-') return 'Minus';
      if (key === '=') return 'Equal';
      return key;
    };

    const actionByCode: Record<string, string> = {};
    (Object.keys(ARTICLE_TOOLBAR_SHORTCUTS) as Array<keyof typeof ARTICLE_TOOLBAR_SHORTCUTS>)
      .forEach((action) => {
        const { alt, key } = ARTICLE_TOOLBAR_SHORTCUTS[action];
        if (alt) actionByCode[codeForKey(key.toLowerCase())] = action;
      });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        shortcutActionsRef.current.close?.();
        return;
      }
      if (!event.altKey || event.ctrlKey || event.metaKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const action = actionByCode[event.code];
      const run = action ? shortcutActionsRef.current[action] : undefined;
      if (run) {
        event.preventDefault();
        run();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen flex-col bg-background text-foreground">
        <div className="shrink-0 space-y-2 border-b border-border bg-background/95 px-3 py-2.5">
          <AccountBar
            user={account.user}
            isBusy={account.isLoading}
            error={account.error}
            provider={provider}
            onSignIn={() => void account.signIn()}
            onSignOut={() => void account.signOut()}
          />
          <ArticleActionButtons
            isLoadingAI={isLoadingAI}
            isLoadingFollowups={isLoadingFollowups}
            isCheckingCards={isCheckingCards}
            isSaving={isSaving}
            isSignedIn={Boolean(account.user)}
            isHighlightMode={isHighlightMode}
            articleUrl={article?.url}
            fontScale={fontScale}
            onAskClick={() => void askQuestion(userPrompt)}
            onSuggestClick={() => void generateFollowups()}
            onCopyClick={() => void copyArticle()}
            onShareClick={() => void shareArticle()}
            onCheckCardsClick={() => void checkForExistingCards()}
            onSaveClick={() => void saveToAccount()}
            onHighlightToggle={() => setIsHighlightMode((previous) => !previous)}
            onZoomIn={() => persistFontScale(fontScale + FONT_SCALE_STEP)}
            onZoomOut={() => persistFontScale(fontScale - FONT_SCALE_STEP)}
            onZoomReset={() => persistFontScale(1)}
            onClose={closePanel}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 p-3">
            {pageChanged && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-accent/40 p-2 text-xs">
                <span>You&apos;ve moved to another page.</span>
                <Button size="sm" className="h-7 text-xs" onClick={() => void readCurrentPage()}>
                  Read this one
                </Button>
              </div>
            )}

            {notice && (
              <div
                className={`rounded-md p-2 text-[13px] ${
                  notice.tone === 'warn'
                    ? 'bg-yellow-50 text-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-100'
                    : 'bg-muted text-foreground'
                }`}
              >
                {notice.text}
                {notice.link && (
                  <>
                    {' '}
                    <a
                      href={notice.link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline"
                    >
                      {notice.link.label}
                    </a>
                  </>
                )}
              </div>
            )}

            {isExtracting && (
              <p className="animate-pulse text-sm text-muted-foreground">Reading this page…</p>
            )}

            {!isExtracting && extractError && (
              <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
                <p>{extractError}</p>
                <Button variant="outline" size="sm" onClick={() => void readCurrentPage()}>
                  Try again
                </Button>
              </div>
            )}

            {article && (
              <>
                {selectionText && (
                  <div className="rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Asking about:</span>{' '}
                    {selectionText.slice(0, 280)}
                    {selectionText.length > 280 ? '…' : ''}
                  </div>
                )}

                <ArticlePromptInput
                  value={userPrompt}
                  onChange={setUserPrompt}
                  onSubmit={() => void askQuestion(userPrompt)}
                  disabled={isLoadingAI}
                />

                <ArticleFollowupQuestions
                  questions={followupQuestions}
                  summarizePrompt={settings?.summarizePrompt ?? DEFAULT_SUMMARIZE_PROMPT}
                  isLoading={isLoadingFollowups}
                  error={followupError}
                  onQuestionClick={(question) => {
                    setUserPrompt(question);
                    void askQuestion(question);
                  }}
                />

                {chatHistory.length > 0 && (
                  <div className="space-y-3">
                    {chatHistory.map((message, index) => (
                      <div key={`${message.time}-${index}`}>
                        {message.role === 'user' ? (
                          <div className="rounded-lg border border-primary/20 bg-primary/10 p-2.5">
                            <div className="mb-1 text-xs font-semibold text-foreground">
                              Your question
                            </div>
                            <div className="text-sm">{message.content}</div>
                          </div>
                        ) : (
                          <ArticleAIResponse response={message.content} isLoading={false} />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {(isLoadingAI || (aiResponse && chatHistory.length === 0)) && (
                  <ArticleAIResponse response={aiResponse} isLoading={isLoadingAI} />
                )}

                {aiError && !isLoadingAI && (
                  <div className="rounded-md bg-destructive p-2 text-sm text-destructive-foreground">
                    {aiError}
                  </div>
                )}

                <ArticleContent
                  article={article}
                  isHighlightMode={isHighlightMode}
                  fontScale={fontScale}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
