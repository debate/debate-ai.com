import React from 'react';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { applyStoredAppearance, configureHost } from 'debate-webview';

import { installApiProxy } from '@/src/app-host/api-proxy';
import { requestSignIn, type StoredSession } from '@/src/auth/session';
import { getSettings } from '@/src/settings/settings';

import App from './App';

/**
 * Everything the app needs from its host, done before its modules render:
 * where `/api` goes, which web-only features to leave out, and how to sign in.
 * The page's stylesheet is linked from index.html (see
 * src/styles/options-app.css for why it isn't imported here).
 */
async function start() {
  const { apiBase } = await getSettings();
  // Before the first render: the app's first requests would otherwise go to
  // `chrome-extension://…/api`.
  installApiProxy(apiBase);

  configureHost({
    // There is no server behind this page's origin to frame, and Google's
    // One Tap script is refused by the extension page CSP.
    framing: false,
    oneTap: false,
    serviceWorker: false,
    // The same handoff the popup and panel use: a tab on the site that passes
    // the session back to the background worker.
    signIn: () => void requestSignIn(),
    openOnSite: (path) => void browser.tabs.create({ url: `${apiBase}${path}` }),
  });

  // better-auth's client caches the session it read at load. Signing in or
  // out (here, or in the popup or panel) changes who the proxy sends
  // requests as, so start the app over. A rotated token for the same reader
  // doesn't count.
  browser.storage.local.onChanged.addListener((changes) => {
    const change = changes.debateAccountSession;
    if (!change) return;
    const before = (change.oldValue as StoredSession | undefined)?.user?.id;
    const after = (change.newValue as StoredSession | undefined)?.user?.id;
    if (before !== after) window.location.reload();
  });

  applyStoredAppearance();
  if (!window.location.hash) window.history.replaceState(null, '', '#/videos');

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void start();
