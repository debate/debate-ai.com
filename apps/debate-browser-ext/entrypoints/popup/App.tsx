import { BookOpen, Settings2, Timer } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

import { Button } from '@/components/ui/button';
import { isSignedIn } from '@/src/auth/session';
import { ReuseMatchCard, type AnnotationState } from '@/src/components/ReuseMatchCard';
import {
  annotateReuseCard,
  checkPageForExistingCards,
  isUrlDomainSkipped,
  parseSkipDomains,
  type ReuseMatch,
} from '@/src/reuse/api';
import { openReaderPanel, supportsReaderPanel } from '@/src/reader/panel';
import { getSettings } from '@/src/settings/settings';
import { requestTimerWindow } from '@/src/timer/window';

/**
 * Corpus matches annotated automatically when the popup opens on a signed-in
 * reader. Each is generated once server-side and then shared, but a page cut
 * dozens of times should not start dozens of model calls on its own — the
 * rest wait for a click.
 */
const AUTO_ANNOTATE_LIMIT = 3;

type StatusKind = 'idle' | 'loading' | 'safe' | 'cut' | 'skip' | 'error';

interface Status {
  kind: StatusKind;
  text: string;
}

const STATUS_CLASSES: Record<StatusKind, string> = {
  idle: 'bg-muted text-muted-foreground',
  loading: 'bg-muted text-muted-foreground',
  safe: 'bg-emerald-50 text-emerald-800',
  cut: 'bg-red-50 text-red-800',
  skip: 'bg-indigo-50 text-indigo-800',
  error: 'bg-muted text-foreground',
};

/**
 * The toolbar popup: the on-page card reuse check for the tab you're on, plus
 * the entry points to the article panel and the round timer. Neither of those
 * renders here — the timer opens in its own window (src/timer/window.ts) so it
 * keeps running while the debater clicks back into the page, and the article
 * panel opens as the browser's side panel (src/reader/panel.ts) so the article
 * stays open while they click around the page it came from.
 *
 * The panel is opened from here rather than by messaging the background
 * worker: both Chrome and Firefox will only open a panel while handling a user
 * action, and this click is one.
 */
export default function App() {
  const [pageUrl, setPageUrl] = useState('');
  // Resolved on mount rather than in the click handler: opening the panel has
  // to be the first thing that handler does (see src/reader/panel.ts).
  const [windowId, setWindowId] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<Status>({ kind: 'loading', text: 'Checking…' });
  const [matches, setMatches] = useState<ReuseMatch[]>([]);
  const [annotations, setAnnotations] = useState<Record<number, AnnotationState>>({});

  const annotate = useCallback(async (cardId: number) => {
    setAnnotations((prev) => ({ ...prev, [cardId]: { loading: true } }));
    try {
      const settings = await getSettings();
      const annotation = await annotateReuseCard(cardId, settings.apiBase);
      setAnnotations((prev) => ({ ...prev, [cardId]: { annotation } }));
    } catch (err) {
      setAnnotations((prev) => ({
        ...prev,
        [cardId]: { error: err instanceof Error ? err.message : 'Annotation failed.' },
      }));
    }
  }, []);

  const check = useCallback(async (url: string) => {
    setMatches([]);
    setAnnotations({});
    setStatus({ kind: 'loading', text: 'Checking…' });
    try {
      const settings = await getSettings();
      const result = await checkPageForExistingCards(url, settings.apiBase);
      if (result.alreadyCut) {
        setMatches(result.matches);
        if (await isSignedIn()) {
          result.matches
            .filter((match) => match.card && !match.annotation)
            .slice(0, AUTO_ANNOTATE_LIMIT)
            .forEach((match) => void annotate(match.card!.cardId));
        }
        setStatus({
          kind: 'cut',
          text: `Already cut: ${result.matches.length} existing ${
            result.matches.length === 1 ? 'entry' : 'entries'
          }.`,
        });
      } else {
        setStatus({ kind: 'safe', text: 'No existing cards found for this page — safe to cut.' });
      }
    } catch (err) {
      setStatus({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Reuse check failed.',
      });
    }
  }, [annotate]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Opened from the page context menu, this same page runs as a standalone
      // window and is told which URL to check; as the toolbar dropdown it reads
      // the active tab itself.
      const requested = new URLSearchParams(window.location.search).get('url');
      const activeTab = (await browser.tabs.query({ active: true, currentWindow: true }))[0];
      const url = requested ?? activeTab?.url ?? '';
      if (cancelled) return;
      setPageUrl(url);
      setWindowId(activeTab?.windowId);

      if (!url || !/^https?:\/\//.test(url)) {
        setStatus({ kind: 'error', text: 'Open a web page to check it for existing cards.' });
        return;
      }

      const settings = await getSettings();
      if (cancelled) return;
      if (isUrlDomainSkipped(url, parseSkipDomains(settings.skipDomains))) {
        setStatus({
          kind: 'skip',
          text: 'This site is on your skip-check whitelist — no reuse check run.',
        });
        return;
      }
      if (!settings.autoCheck) {
        setStatus({ kind: 'idle', text: 'Automatic checking is off — run it when you need it.' });
        return;
      }
      await check(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [check]);

  const canRecheck = /^https?:\/\//.test(pageUrl) && status.kind !== 'loading';
  const canRead = /^https?:\/\//.test(pageUrl) && supportsReaderPanel();

  return (
    <div className="p-3 text-foreground">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h1 className="text-sm font-semibold">Debate AI</h1>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Extension settings"
          onClick={() => browser.runtime.openOptionsPage()}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      {canRead && (
        <Button
          className="mb-2 w-full"
          onClick={() => {
            void openReaderPanel(windowId).then(() => window.close());
          }}
        >
          <BookOpen className="mr-2 h-4 w-4" />
          Read this page
        </Button>
      )}

      <Button
        variant={canRead ? 'outline' : 'default'}
        className="mb-3 w-full"
        onClick={async () => {
          await requestTimerWindow();
          window.close();
        }}
      >
        <Timer className="mr-2 h-4 w-4" />
        Open round timer
      </Button>

      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        On-page card reuse check
      </h2>
      <p className="mb-2 break-all text-[11px] text-muted-foreground">
        {pageUrl || '(no active tab URL)'}
      </p>

      <div className={`rounded-md p-2 text-[13px] ${STATUS_CLASSES[status.kind]}`}>
        {status.text}
      </div>

      {matches.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {matches.map((match, i) => (
            <ReuseMatchCard
              key={match.id ?? `${match.cite ?? ''}-${i}`}
              match={match}
              state={match.card ? annotations[match.card.cardId] : undefined}
              onAnnotate={match.card ? () => void annotate(match.card!.cardId) : undefined}
            />
          ))}
        </ul>
      )}

      {canRecheck && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={() => void check(pageUrl)}
        >
          {status.kind === 'idle'
            ? 'Check this page'
            : status.kind === 'skip'
              ? 'Check anyway'
              : 'Check again'}
        </Button>
      )}
    </div>
  );
}
