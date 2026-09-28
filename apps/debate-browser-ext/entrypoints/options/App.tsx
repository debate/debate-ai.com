import { useMemo } from 'react';
import { DebateApp, type AppRoute } from 'debate-webview';
import { Settings } from 'lucide-react';

import { setProxiedApiBase } from '@/src/app-host/api-proxy';

import { SettingsPanel } from './SettingsPanel';

/** Where the extension's own settings live inside the app's routes. */
export const EXTENSION_SETTINGS_PATH = '/extension';

/**
 * The Options page: the whole debate-ai.com app — the same dock, sidebar,
 * pages and tools as the website — with the extension's settings as one more
 * page at `#/extension`.
 *
 * The UI is `debate-webview`, the package the website itself mounts from its
 * Next `app/` directory. Here it routes through the URL fragment and reaches
 * the API through `src/app-host/api-proxy.ts`; `main.tsx` sets both up before
 * this renders. See the package's README for what a non-Next host provides.
 */
export default function App() {
  const extraRoutes: AppRoute[] = useMemo(
    () => [
      {
        pattern: EXTENSION_SETTINGS_PATH,
        load: async () => ({
          default: () => <SettingsPanel onApiBaseSaved={setProxiedApiBase} />,
        }),
      },
    ],
    []
  );

  return (
    <>
      <DebateApp extraRoutes={extraRoutes} />
      <a
        href={`#${EXTENSION_SETTINGS_PATH}`}
        className="fixed right-3 top-3 z-50 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur hover:bg-accent"
        title="Timer, toolbar, reader and reuse-check settings for this extension"
      >
        <Settings className="h-3.5 w-3.5" />
        Extension settings
      </a>
    </>
  );
}
