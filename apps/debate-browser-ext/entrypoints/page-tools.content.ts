import { browser } from 'wxt/browser';

import { detectArticle } from '@/src/article/detect';
import { hideReadingButton, showReadingButton } from '@/src/page-tools/reading-button';
import { closeSearchMenu, openSearchMenu } from '@/src/page-tools/search-menu';
import { isEditableTarget, isSearchShortcut } from '@/src/page-tools/shortcut';
import { toggleReaderPanelInPage } from '@/src/reader/panel';
import { PAGE_SNAPSHOT_REQUEST, collectPageSnapshot } from '@/src/reader/snapshot';
import { toSearchQuery } from '@/src/search/engines';
import { getSettings, type Settings } from '@/src/settings/settings';

/**
 * The two tools that live on every page:
 *
 * - **Reading-mode button.** Once the page settles, it is checked for an
 *   article (src/article/detect.ts: a regex word count, then the reading-mode
 *   extractor, all in the page). Over 1000 words gets a small arrow on the
 *   left edge that opens the article panel; anything else gets nothing.
 * - **Backtick search.** The key under Escape, pressed with text selected,
 *   opens the search menu on that text, Quick search first.
 *
 * Both can be turned off in Settings → Browser extension. It also answers the
 * background worker's snapshot request when the panel was opened from the
 * button rather than the toolbar (see src/reader/snapshot.ts).
 */
export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main(ctx) {
    let settings: Settings | null = null;
    const loadSettings = async () => {
      settings = await getSettings();
      return settings;
    };
    void loadSettings();

    browser.runtime.onMessage.addListener(
      (message: unknown, _sender: unknown, sendResponse: (response?: unknown) => void) => {
        if ((message as { type?: string } | undefined)?.type === PAGE_SNAPSHOT_REQUEST) {
          sendResponse(collectPageSnapshot());
        }
        return undefined;
      },
    );

    // Client-rendered articles may not be in the DOM yet at idle, so a miss is
    // retried once a few seconds later.
    let retry: number | undefined;
    const checkForArticle = async (allowRetry: boolean) => {
      const { articleButton } = settings ?? (await loadSettings());
      if (!articleButton || ctx.isInvalid) return hideReadingButton();
      const found = detectArticle(document, window.location.href);
      if (found) {
        showReadingButton(found.wordCount, () => void toggleReaderPanelInPage());
      } else {
        hideReadingButton();
        if (allowRetry) retry = ctx.setTimeout(() => void checkForArticle(false), 3000);
      }
    };
    const scheduleCheck = () => {
      if (retry !== undefined) clearTimeout(retry);
      const run = () => void checkForArticle(true);
      if ('requestIdleCallback' in window) ctx.requestIdleCallback(run, { timeout: 2000 });
      else ctx.setTimeout(run, 500);
    };

    scheduleCheck();
    // A single-page app moving to another route is another page to check.
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      hideReadingButton();
      ctx.setTimeout(scheduleCheck, 1000);
    });

    browser.storage.sync.onChanged.addListener((changes) => {
      if (!('articleButton' in changes) && !('searchShortcut' in changes) && !('apiBase' in changes)) {
        return;
      }
      void loadSettings().then(() => scheduleCheck());
    });

    ctx.addEventListener(
      window,
      'keydown',
      (event: KeyboardEvent) => {
        if (!isSearchShortcut(event) || isEditableTarget(event.target)) return;
        if (settings && !settings.searchShortcut) return;
        const selection = window.getSelection();
        const query = toSearchQuery(String(selection ?? ''));
        if (!query) return;
        event.preventDefault();
        event.stopPropagation();
        void (async () => {
          const { searchShortcut, apiBase } = settings ?? (await loadSettings());
          if (!searchShortcut) return;
          const anchor =
            selection && selection.rangeCount > 0
              ? selection.getRangeAt(0).getBoundingClientRect()
              : null;
          openSearchMenu(query, anchor, apiBase);
        })();
      },
      { capture: true },
    );

    ctx.onInvalidated(() => {
      closeSearchMenu();
      hideReadingButton();
    });
  },
});
