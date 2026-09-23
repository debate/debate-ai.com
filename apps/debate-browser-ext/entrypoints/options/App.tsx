import { useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import { DebateWebUI, type WebUIScreen } from 'debate-ai-webui';

import { DEFAULT_API_BASE, getSettings } from '@/src/settings/settings';

import { SettingsPanel } from './SettingsPanel';

/**
 * The Options page: debate-ai.com's own frontend UI, with the extension's
 * settings as the last screen in its nav.
 *
 * The page used to be a settings form and nothing else, which left the
 * extension's two tools (the timer window and the toolbar popup's reuse check)
 * as the only debate-ai.com surfaces reachable without opening the site. The
 * app's UI is now a package — `debate-ai-webui`, which talks to the API
 * through `debate-api-client` and knows nothing about Next.js or about this
 * extension — so the Options tab can mount the real thing: the video archive,
 * card search, the reuse check over any URL, the standings, and the catalog of
 * every tool in the app.
 *
 * The API base the reuse check already used is what the UI is pointed at, so
 * the whole page follows the deployment setting rather than hard-coding
 * production — and repoints the moment that setting is saved, without a
 * reload. Note that `host_permissions` still decides what the browser will
 * actually let it reach; see the README.
 */
export default function App() {
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getSettings().then((stored) => {
      if (cancelled) return;
      setApiBase(stored.apiBase);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const extraScreens: WebUIScreen[] = useMemo(
    () => [
      {
        id: 'extension',
        label: 'Extension',
        description:
          'Timer defaults, what the toolbar icon opens, and how the on-page reuse check behaves.',
        render: () => <SettingsPanel onApiBaseSaved={setApiBase} />,
      },
    ],
    []
  );

  // Rendering the shell before the stored API base is known would build a
  // client against the production default and then throw it away one tick
  // later, so the first request of every screen would go to the wrong
  // deployment for anyone who changed the setting.
  if (!loaded) return null;

  return (
    <DebateWebUI
      origin={apiBase}
      extraScreens={extraScreens}
      // An extension page can't navigate itself to the web app without losing
      // the Options tab, so in-app routes open in a tab of their own.
      onOpenRoute={(url) => void browser.tabs.create({ url })}
    />
  );
}
