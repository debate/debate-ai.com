import { DebateApp } from '@debate/webview';

/**
 * The Options page: the whole debate-ai.com app — the same dock, sidebar,
 * pages and tools as the website. The extension's own settings are not a page
 * of their own: they are the "Browser extension" tab of the app's Settings
 * (`main.tsx` hands them over through `configureHost`).
 *
 * The UI is `debate-webview`, the package the website itself mounts from its
 * Next `app/` directory. Here it routes through the URL fragment and reaches
 * the API through `src/app-host/api-proxy.ts`; `main.tsx` sets both up before
 * this renders. See the package's README for what a non-Next host provides.
 */
export default function App() {
  return <DebateApp />;
}
