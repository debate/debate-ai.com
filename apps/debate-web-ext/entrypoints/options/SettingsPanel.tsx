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
  AI_PROVIDERS,
  BYO_KEY_PROVIDERS,
  type AiProviderId,
  getProvider,
} from '@/src/ai/providers';
import { getApiKeys, saveApiKeys, type ApiKeys } from '@/src/ai/keys';
import { useAccount } from '@/src/auth/useAccount';
import {
  DEFAULT_API_BASE,
  DEFAULT_SETTINGS,
  DEFAULT_SUMMARIZE_PROMPT,
  MAX_FOLLOWUP_QUESTIONS,
  MAX_TIMER_WINDOW,
  MIN_FOLLOWUP_QUESTIONS,
  MIN_TIMER_WINDOW,
  getSettings,
  saveSettings,
  type Settings,
  type ToolbarAction,
} from '@/src/settings/settings';
import { DEBATE_TYPES } from '@/src/timer/constants';
import { getDebateType, setDebateType } from '@/src/timer/storage';

/** Props for {@link SettingsPanel}. */
export interface SettingsPanelProps {
  /**
   * Called with the saved API base whenever it changes, so the shell around
   * this panel can repoint its `debate-api-client` client at the new
   * deployment without the page being reloaded.
   */
  onApiBaseSaved?: (apiBase: string) => void;
}

/**
 * The extension's own settings — the account the article panel reads and asks
 * with, that panel's AI provider and keys, the round timer's defaults, and the
 * on-page card reuse check's configuration, which used to live in two separate
 * extensions (and, for the reuse check, in its own options.html).
 *
 * Rendered as one screen inside `debate-ai-webui`'s shell rather than as the
 * whole Options page: the page now opens on the web app's UI (see `App.tsx`),
 * and these settings are the last tab in its nav.
 */
export function SettingsPanel({ onApiBaseSaved }: SettingsPanelProps) {
  const account = useAccount();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  // Kept apart from `settings` because keys live in storage.local, not the
  // storage.sync everything else uses — see src/ai/keys.ts for why.
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [debateType, setDebateTypeState] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [stored, keys, dt] = await Promise.all([
        getSettings(),
        getApiKeys(),
        getDebateType(),
      ]);
      if (cancelled) return;
      setSettings(stored);
      setApiKeys(keys);
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

  function updateKey(provider: string, value: string) {
    setApiKeys((prev) => ({ ...prev, [provider]: value }));
    setSaved(false);
  }

  async function onSave() {
    await saveSettings(settings);
    await saveApiKeys(apiKeys);
    // The format lives in storage.local alongside the timer's own session
    // state, and switching it clears any resumable session — same as picking a
    // different format in the timer window.
    if (debateType !== (await getDebateType())) await setDebateType(debateType);
    // Read the setting back rather than echoing the form: `saveSettings`
    // trims the URL, and the shell should point at what was stored.
    onApiBaseSaved?.((await getSettings()).apiBase);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  if (!loaded) return null;

  const selectedProvider = getProvider(settings.aiProvider);

  return (
    <div className="options-settings">
      <section>
        <h2 className="text-base font-semibold">Your Debate AI account</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Signing in lets the article panel answer questions without you
          supplying a model key — the deployment holds the key and this browser
          holds the session. Sign-in happens on debate-ai.com in an ordinary
          tab, never inside the extension, and the session is kept alive in the
          background so you stay signed in.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {account.user ? (
            <>
              <span className="text-sm">
                Signed in as{' '}
                <span className="font-medium">
                  {account.user.name || account.user.email}
                </span>
              </span>
              <Button
                variant="outline"
                disabled={account.isLoading}
                onClick={() => void account.signOut()}
              >
                Sign out
              </Button>
            </>
          ) : (
            <Button disabled={account.isLoading} onClick={() => void account.signIn()}>
              {account.isLoading ? 'Opening sign-in…' : 'Sign in with Google'}
            </Button>
          )}
        </div>
        {account.error && <p className="mt-2 text-xs text-destructive">{account.error}</p>}
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold">Article panel AI</h2>

        <div className="mt-4">
          <label className="text-sm font-medium" htmlFor="ai-provider">
            Answers come from
          </label>
          <Select
            value={settings.aiProvider}
            onValueChange={(v) => update('aiProvider', v as AiProviderId)}
          >
            <SelectTrigger id="ai-provider" className="mt-1 w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_PROVIDERS.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            {settings.aiProvider === 'account'
              ? 'Uses the deployment\u2019s own model key. Requires being signed in above.'
              : 'Called directly from this browser with your key below. Usage is billed to your own account with that provider.'}
          </p>
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium" htmlFor="ai-model">
            Model
          </label>
          <input
            id="ai-model"
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-sm disabled:opacity-60"
            placeholder={selectedProvider.defaultModel || 'Chosen by the server'}
            disabled={settings.aiProvider === 'account'}
            value={settings.aiModel}
            onChange={(e) => update('aiModel', e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {settings.aiProvider === 'account'
              ? 'The deployment picks the model for account-backed answers.'
              : `Leave blank for ${selectedProvider.defaultModel}.`}
          </p>
        </div>

        <div className="mt-6">
          <span className="text-sm font-medium">Your API keys</span>
          <p className="mt-1 text-xs text-muted-foreground">
            Stored in this browser only (<code>storage.local</code>, not the
            synced settings), sent to that provider and to nothing else. Clear a
            field and save to delete a key.
          </p>
          <div className="mt-3 space-y-4">
            {BYO_KEY_PROVIDERS.map((provider) => (
              <div key={provider.id}>
                <label className="text-sm font-medium" htmlFor={`key-${provider.id}`}>
                  {provider.label.replace(' (my key)', '')}
                </label>
                <input
                  id={`key-${provider.id}`}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-sm"
                  placeholder={provider.keyPlaceholder}
                  value={apiKeys[provider.id as keyof ApiKeys] ?? ''}
                  onChange={(e) => updateKey(provider.id, e.target.value)}
                />
                {provider.keyUrl && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <a
                      className="underline underline-offset-2"
                      href={provider.keyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Get a key
                    </a>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <label className="text-sm font-medium" htmlFor="summarize-prompt">
            Default question
          </label>
          <input
            id="summarize-prompt"
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            placeholder={DEFAULT_SUMMARIZE_PROMPT}
            value={settings.summarizePrompt}
            onChange={(e) => update('summarizePrompt', e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            What the panel's prompt box starts with, and the first suggestion it
            offers for any article.
          </p>
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium" htmlFor="max-followups">
            Follow-up questions to suggest
          </label>
          <input
            id="max-followups"
            type="number"
            min={MIN_FOLLOWUP_QUESTIONS}
            max={MAX_FOLLOWUP_QUESTIONS}
            className="mt-1 w-24 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            value={settings.maxFollowupQuestions}
            onChange={(e) => update('maxFollowupQuestions', Number(e.target.value))}
          />
        </div>
      </section>

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
              <SelectItem value="reader">The article panel</SelectItem>
              <SelectItem value="timer">The timer window</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Whichever you pick, the other two stay one right-click away, and the
            timer always opens as its own window rather than a dropdown so it
            keeps running while you work in the page.
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
            The debate-ai.com deployment the reuse check, sign-in and
            account-backed AI answers all run against — and the one this page's
            own UI is pointed at. Only the production domain and{' '}
            <code>localhost:3000</code> are pre-authorized in the extension's
            manifest — pointing this at another host shows a permissions error
            until the manifest adds it and the extension is reloaded. Changing
            it signs you out, since a session belongs to the deployment that
            issued it.
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
