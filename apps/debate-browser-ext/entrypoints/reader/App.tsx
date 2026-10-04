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
  READING_WIDTHS,
  type ReadingWidth,
} from '@/src/components/article/ArticleActionButtons';
import ArticleContent from '@/src/components/article/ArticleContent';
import ArticleFollowupQuestions from '@/src/components/article/ArticleFollowupQuestions';
import ArticlePromptInput from '@/src/components/article/ArticlePromptInput';
import { clearHighlights } from '@/src/reader/highlights';
import {
  READER_SNAPSHOT_MESSAGE,
  READER_TAB_CHANGED_MESSAGE,
  requestReaderPanelClose,
  requestReaderPanelLayout,
  type ReaderLayout,
} from '@/src/reader/panel';
import { checkPageForExistingCards } from '@/src/reuse/api';
import { detectPageUrl } from '@/src/url-detection/api';
import {
  DEFAULT_SUMMARIZE_PROMPT,
  getSettings,
  type Settings,
} from '@/src/settings/settings';

const MIN_FONT_SCALE = 0.5;
const MAX_FONT_SCALE = 1.8;
const FONT_SCALE_STEP = 0.1;
const FONT_SCALE_KEY = 'articleFontScale';
const LAYOUT_KEY = 'readerLayout';
const READING_WIDTH_KEY = 'readerWidth';

/** A value kept in this extension's own `localStorage`, or `fallback`. */
function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked — the choice just won't be remembered.
  }
}

/**
 * The AI column beside the article in the full-page layout. Below Tailwind's
 * `lg` breakpoint there is no room beside it, so it stacks above the article.
 */
const ASSISTANT_COLUMN_WIDTH = '24rem';
const WIDE_WINDOW_QUERY = '(min-width: 1024px)';

/** Whether the window is at least Tailwind's `lg` wide, kept current on resize. */
function useIsWideWindow(): boolean {
  const [isWide, setIsWide] = useState(() => window.matchMedia(WIDE_WINDOW_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(WIDE_WINDOW_QUERY);
    const onChange = () => setIsWide(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return isWide;
}

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
  const [highlights, setHighlights] = useState<string[]>([]);
  const [fontScale, setFontScale] = useState(1);
  const [layout, setLayout] = useState<ReaderLayout>(() =>
    readStored<ReaderLayout>(LAYOUT_KEY, ['full', 'side'], 'full'),
  );
  const [readingWidth, setReadingWidth] = useState<ReadingWidth>(() =>
    readStored(READING_WIDTH_KEY, Object.keys(READING_WIDTHS) as ReadingWidth[], 'medium'),
  );

  const isWideWindow = useIsWideWindow();
  const assistantScrollRef = useRef<HTMLDivElement>(null);
  const backdropPressRef = useRef(false);

  // The frame opens full-page; tell the page which layout to actually use,
  // now and whenever the reader switches. The full-page layout draws its own
  // translucent backdrop, so the document under it must not paint one
  // (src/styles/sidepanel.css).
  useEffect(() => {
    requestReaderPanelLayout(layout);
    writeStored(LAYOUT_KEY, layout);
    document.documentElement.dataset.layout = layout;
  }, [layout]);

  useEffect(() => writeStored(READING_WIDTH_KEY, readingWidth), [readingWidth]);

  const toggleLayout = () => setLayout((current) => (current === 'full' ? 'side' : 'full'));
  const cycleReadingWidth = () =>
    setReadingWidth((current) => {
      const widths = Object.keys(READING_WIDTHS) as ReadingWidth[];
      return widths[(widths.indexOf(current) + 1) % widths.length];
    });

  const clearAllHighlights = () => {
    const body = document.getElementById('article-content');
    if (body) clearHighlights(body);
    setHighlights([]);
  };

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

      // Report the visited URL to the server for URL detection (non-blocking)
      if (extracted.url) {
        const pageTitle = document.title || extracted.title;
        const favicon = document.querySelector('link[rel="icon"]')?.getAttribute('href') || undefined;
        detectPageUrl(extracted.url, pageTitle, favicon).catch(() => {});
      }
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
      // A reader who selected something before opening the panel, or has
      // highlighted passages in it, almost always means "about this part", so
      // that text is asked alongside the question.
      const focus = [selectionText, ...highlights].filter(Boolean);
      const fullQuestion = focus.length
        ? `Focus on these passages from the article:\n${focus
            .map((passage) => `"${passage}"`)
            .join('\n')}\n\n${question}`
        : question;

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
    [article, chatHistory, highlights, selectionText],
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
    layout: toggleLayout,
    width: () => {
      if (layout === 'full') cycleReadingWidth();
    },
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

  // In the full-page layout the conversation has a column of its own; keep the
  // newest question and answer in view there as they arrive.
  useEffect(() => {
    const column = assistantScrollRef.current;
    if (column) column.scrollTo({ top: column.scrollHeight, behavior: 'smooth' });
  }, [chatHistory.length, isLoadingAI, aiError]);

  // The article column sits at the reader's chosen width in the full-page
  // layout; the side panel is already narrow, so there it just fills the frame.
  const readingMaxWidth = READING_WIDTHS[readingWidth].maxWidth;
  const columnStyle: React.CSSProperties | undefined =
    layout === 'full' ? { maxWidth: readingMaxWidth } : undefined;

  const toolbar = (
    <>
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
        highlightCount={highlights.length}
        layout={layout}
        readingWidth={readingWidth}
        articleUrl={article?.url}
        fontScale={fontScale}
        onAskClick={() => void askQuestion(userPrompt)}
        onSuggestClick={() => void generateFollowups()}
        onCopyClick={() => void copyArticle()}
        onShareClick={() => void shareArticle()}
        onCheckCardsClick={() => void checkForExistingCards()}
        onSaveClick={() => void saveToAccount()}
        onHighlightToggle={() => setIsHighlightMode((previous) => !previous)}
        onClearHighlights={clearAllHighlights}
        onLayoutToggle={toggleLayout}
        onReadingWidthChange={setReadingWidth}
        onZoomIn={() => persistFontScale(fontScale + FONT_SCALE_STEP)}
        onZoomOut={() => persistFontScale(fontScale - FONT_SCALE_STEP)}
        onZoomReset={() => persistFontScale(1)}
        onClose={closePanel}
      />
    </>
  );

  /** Page-moved prompt, transient notices, and the reading/failed states. */
  const status = (
    <>
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
    </>
  );

  /** Everything about asking the AI: focus passages, prompt, suggestions, answers. */
  const assistant = article && (
    <>
      {(selectionText || highlights.length > 0) && (
        <div className="space-y-1 rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-foreground">Asking about:</span>
            {highlights.length > 0 && (
              <button
                type="button"
                onClick={clearAllHighlights}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Clear highlights
              </button>
            )}
          </div>
          {[selectionText, ...highlights].filter(Boolean).map((passage, index) => (
            <p key={index} className="border-l-2 border-yellow-300 pl-2">
              {passage.slice(0, 280)}
              {passage.length > 280 ? '…' : ''}
            </p>
          ))}
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
                  <div className="mb-1 text-xs font-semibold text-foreground">Your question</div>
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
    </>
  );

  const articleBody = article && (
    <ArticleContent
      article={article}
      isHighlightMode={isHighlightMode}
      fontScale={fontScale}
      onHighlightsChange={setHighlights}
    />
  );

  if (layout === 'side') {
    return (
      <TooltipProvider delayDuration={0}>
        <div className="flex h-screen flex-col bg-background text-foreground">
          <div className="shrink-0 space-y-2 border-b border-border bg-background/95 px-3 py-2.5">
            {toolbar}
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="w-full space-y-4 p-3">
              {status}
              {assistant}
              {articleBody}
            </div>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // Full page: the site behind is dimmed (and blurred by the frame itself, see
  // src/reader/panel.ts), the article is a sheet centered on it, and the AI is
  // a column beside the article — or a strip above it on a narrow window — so
  // answers and the passage they are about are on screen together. Clicking
  // the backdrop closes the reader, like any modal.
  return (
    <TooltipProvider delayDuration={0}>
      <div
        className="flex h-screen justify-center bg-black/50 sm:p-4 lg:p-6"
        onMouseDown={(event) => {
          backdropPressRef.current = event.target === event.currentTarget;
        }}
        onClick={(event) => {
          // Only a press that both started and ended on the backdrop — a
          // highlight dragged out past the sheet's edge is not a close.
          if (backdropPressRef.current && event.target === event.currentTarget) closePanel();
          backdropPressRef.current = false;
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={article?.title || 'Article reader'}
          className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground shadow-2xl sm:rounded-xl sm:border sm:border-border"
          // Wide enough for the article column at the chosen width plus the
          // AI column; on anything narrower it is simply the whole window.
          style={{ maxWidth: `calc(${readingMaxWidth} + 3rem + ${ASSISTANT_COLUMN_WIDTH})` }}
        >
          <header className="shrink-0 space-y-2 border-b border-border bg-background/95 px-4 py-2.5">
            {toolbar}
          </header>

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <main className="order-2 min-h-0 flex-1 overflow-y-auto overscroll-contain lg:order-1">
              <div className="mx-auto w-full space-y-4 px-6 py-8" style={columnStyle}>
                {status}
                {articleBody}
              </div>
            </main>

            {article && (
              <aside
                aria-label="Ask AI about this article"
                className="order-1 flex max-h-[45%] shrink-0 flex-col border-b border-border bg-muted/30 lg:order-2 lg:max-h-none lg:border-b-0 lg:border-l"
                style={{ width: isWideWindow ? ASSISTANT_COLUMN_WIDTH : undefined }}
              >
                <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ask AI about this article
                </div>
                <div
                  ref={assistantScrollRef}
                  className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4"
                >
                  {assistant}
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
