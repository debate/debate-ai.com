import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DEFAULT_API_BASE,
  DEFAULT_SETTINGS,
  MAX_TIMER_WINDOW,
  MIN_TIMER_WINDOW,
  getSettings,
  saveSettings,
  type Settings,
  type ToolbarAction,
} from '@/src/settings/settings';
import { DEBATE_TYPES } from '@/src/timer/constants';
import { getDebateType, setDebateType } from '@/src/timer/storage';

/**
 * The single Options page for the merged extension: the round timer's defaults
 * and the on-page card reuse check's configuration, which used to live in two
 * separate extensions (and, for the reuse check, in its own options.html).
 */
export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [debateType, setDebateTypeState] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [stored, dt] = await Promise.all([getSettings(), getDebateType()]);
      if (cancelled) return;
      setSettings(stored);
      setDebateTypeState(dt);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function onSave() {
    await saveSettings(settings);
    // The format lives in storage.local alongside the timer's own session
    // state, and switching it clears any resumable session — same as picking a
    // different format in the timer window.
    if (debateType !== (await getDebateType())) await setDebateType(debateType);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  if (!loaded) return null;

  return (
    <div className="options">
      <h1 className="text-xl font-semibold">Debate AI — Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        One extension, two tools: a debate-round timer that opens in its own
        window, and the on-page card reuse check in the toolbar popup.
      </p>

      <section className="mt-8">
        <h2 className="text-base font-semibold">Round timer</h2>

        <div className="mt-4">
          <label className="text-sm font-medium" htmlFor="format">
            Default debate format
          </label>
          <Select
            value={String(debateType)}
            onValueChange={(v) => {
              setDebateTypeState(Number(v));
              setSaved(false);
            }}
          >
            <SelectTrigger id="format" className="mt-1 w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEBATE_TYPES.map((d, i) => (
                <SelectItem key={d} value={String(i)}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Saving a different format resets the speech and prep clocks, just
            like changing it from the timer window does.
          </p>
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium" htmlFor="toolbar-action">
            Toolbar icon opens
          </label>
          <Select
            value={settings.toolbarAction}
            onValueChange={(v) => update('toolbarAction', v as ToolbarAction)}
          >
            <SelectTrigger id="toolbar-action" className="mt-1 w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popup">The card reuse-check popup</SelectItem>
              <SelectItem value="timer">The timer window</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Either way the timer opens as its own window rather than a dropdown,
            so it keeps running while you work in the page.
          </p>
        </div>

        <div className="mt-5">
          <span className="text-sm font-medium">Timer window size</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              type="number"
              aria-label="Timer window width"
              min={MIN_TIMER_WINDOW.width}
              max={MAX_TIMER_WINDOW.width}
              value={settings.timerWindowWidth}
              onChange={(e) => update('timerWindowWidth', Number(e.target.value))}
            />
            <span className="text-sm text-muted-foreground">×</span>
            <input
              className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              type="number"
              aria-label="Timer window height"
              min={MIN_TIMER_WINDOW.height}
              max={MAX_TIMER_WINDOW.height}
              value={settings.timerWindowHeight}
              onChange={(e) => update('timerWindowHeight', Number(e.target.value))}
            />
            <span className="text-sm text-muted-foreground">px</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Applies to the next timer window you open. Out-of-range values are
            clamped to {MIN_TIMER_WINDOW.width}–{MAX_TIMER_WINDOW.width} px.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold">Card reuse check</h2>

        <div className="mt-4">
          <label className="text-sm font-medium" htmlFor="api-base">
            API base URL
          </label>
          <input
            id="api-base"
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            placeholder={DEFAULT_API_BASE}
            value={settings.apiBase}
            onChange={(e) => update('apiBase', e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            The debate-ai.com deployment the reuse check runs against. Only the
            production domain and <code>localhost:3000</code> are pre-authorized
            in the extension's manifest — pointing this at another host shows a
            permissions error until the manifest adds it and the extension is
            reloaded.
          </p>
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium" htmlFor="skip-domains">
            Skip-check whitelist (one domain per line)
          </label>
          <textarea
            id="skip-domains"
            className="mt-1 min-h-24 w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 font-mono text-sm"
            placeholder={'wikipedia.org\nyour-team-wiki.example.com'}
            value={settings.skipDomains}
            onChange={(e) => update('skipDomains', e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Sites the reuse check always skips without a network request — your
            own team's wiki, a general reference site that's never itself a cut
            card's source. A subdomain of a listed domain is skipped too.
          </p>
        </div>

        <label className="mt-5 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={settings.autoCheck}
            onChange={(e) => update('autoCheck', e.target.checked)}
          />
          <span>
            Check automatically when the popup opens
            <span className="block text-xs text-muted-foreground">
              Turn this off to send the page's URL only when you click “Check
              this page”.
            </span>
          </span>
        </label>
      </section>

      <div className="mt-8 flex items-center gap-3">
        <Button onClick={() => void onSave()}>Save</Button>
        {saved && <span className="text-sm text-emerald-700">Saved.</span>}
      </div>
    </div>
  );
}
