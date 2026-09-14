import { Settings2, Timer } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

import { Button } from '@/components/ui/button';
import {
  checkPageForExistingCards,
  isUrlDomainSkipped,
  parseSkipDomains,
  type ReuseMatch,
} from '@/src/reuse/api';
import { getSettings } from '@/src/settings/settings';
import { requestTimerWindow } from '@/src/timer/window';

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
 * the entry point to the round timer. The timer itself deliberately does not
 * render here — it opens in its own window (src/timer/window.ts) so it keeps
 * running while the debater clicks back into the page.
 */
export default function App() {
  const [pageUrl, setPageUrl] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'loading', text: 'Checking…' });
  const [matches, setMatches] = useState<ReuseMatch[]>([]);

  const check = useCallback(async (url: string) => {
    setMatches([]);
    setStatus({ kind: 'loading', text: 'Checking…' });
    try {
      const settings = await getSettings();
      const result = await checkPageForExistingCards(url, settings.apiBase);
      if (result.alreadyCut) {
        setMatches(result.matches);
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
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Opened from the page context menu, this same page runs as a standalone
      // window and is told which URL to check; as the toolbar dropdown it reads
      // the active tab itself.
      const requested = new URLSearchParams(window.location.search).get('url');
      const url =
        requested ??
        (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.url ??
        '';
      if (cancelled) return;
      setPageUrl(url);

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

      <Button
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
            <li
              key={`${match.cite ?? ''}-${i}`}
              className="rounded-md border border-dashed border-border p-2 text-xs"
            >
              <div className="font-semibold">{match.argBlock || '(untitled)'}</div>
              <div className="text-muted-foreground">
                {[match.cite, match.topic].filter(Boolean).join(' — ')}
              </div>
            </li>
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
