/**
 * "Sign in with QwkSearch" from the extension: linking a QwkSearch account to
 * the reader's debate-ai account, so the research workspace on the Options
 * page runs as that QwkSearch user — saved chats, history and the plan's
 * models — instead of a guest.
 *
 * On debate-ai.com the button navigates to `/api/qwksearch/connect`, which
 * keeps the PKCE verifier in a cookie and finishes in `/api/qwksearch/callback`
 * off that cookie and the site's session cookie. Neither exists here: the
 * Options page is `chrome-extension://…`, its requests to the site carry a
 * bearer token (./session.ts), and QwkSearch only redirects to allowlisted web
 * origins. So the extension runs the PKCE half itself:
 *
 * 1. Signs in to debate-ai first if it isn't — the link is stored on that
 *    account (./sign-in-flow.ts).
 * 2. Makes a verifier and state, and opens QwkSearch's consent screen in a tab
 *    with `<deployment>/auth/qwksearch-extension-complete` as the redirect.
 *    The reader signs in to (or creates) their QwkSearch account there and
 *    approves the link.
 * 3. Watches that tab land on the completion page, reads `code` (or `error`)
 *    off its URL, checks `state`, and closes it.
 * 4. Posts the code and verifier to `/api/qwksearch/token` with the bearer
 *    session; the server redeems them with QwkSearch and stores the key. From
 *    then on `/api/qwksearch/session` (proxied, src/app-host/api-proxy.ts)
 *    answers with the account, and the embed sends its key to qwksearch.com.
 *
 * Like sign-in, this runs in the background worker so closing the page that
 * asked doesn't kill the flow.
 */
import { browser } from 'wxt/browser';
import {
  EXTENSION_CALLBACK_PATH,
  buildAuthorizeUrl,
  pkceChallenge,
  qwksearchOrigin,
  randomToken,
  readExtensionCallback,
  type ExtensionCallbackResult,
} from '@debate-ai/qwksearch/lib/connect';

import { getSettings } from '@/src/settings/settings';
import { authorizedFetch, isSignedIn } from './session';
import { runSignInFlow } from './sign-in-flow';

/** Message extension pages send the background worker to run the flow. */
export const QWKSEARCH_CONNECT_MESSAGE = 'qwksearch-connect';

/** How the flow ended, for the page that asked. */
export interface QwkSearchConnectResult {
  ok: boolean;
  /** The reader closed the tab or chose Cancel on QwkSearch. */
  cancelled?: boolean;
  error?: string;
}

/** Same allowance as debate-ai sign-in: QwkSearch may need an account made first. */
const CONNECT_TIMEOUT_MS = 10 * 60 * 1000;

/** Asks the background worker to run the flow. */
export async function requestQwkSearchConnect(): Promise<QwkSearchConnectResult> {
  return (await browser.runtime.sendMessage({
    type: QWKSEARCH_CONNECT_MESSAGE,
  })) as QwkSearchConnectResult;
}

/** Runs the flow end to end, resolving once the account is linked or with why it isn't. */
export async function runQwkSearchConnectFlow(): Promise<QwkSearchConnectResult> {
  if (!(await isSignedIn())) {
    const signedIn = await runSignInFlow();
    if (!signedIn.ok) {
      return { ok: false, error: signedIn.error ?? 'Sign in to Debate AI first.' };
    }
  }

  const { apiBase } = await getSettings();
  const base = apiBase.replace(/\/$/, '');
  const verifier = randomToken(48);
  const state = randomToken(24);
  const authorizeUrl = buildAuthorizeUrl({
    origin: qwksearchOrigin(),
    redirectUri: `${base}${EXTENSION_CALLBACK_PATH}`,
    state,
    challenge: await pkceChallenge(verifier),
  });

  let tabId: number | undefined;
  try {
    tabId = (await browser.tabs.create({ url: authorizeUrl, active: true }))?.id;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not open QwkSearch.' };
  }
  if (tabId == null) return { ok: false, error: 'Could not open QwkSearch.' };

  let answer: ExtensionCallbackResult;
  try {
    answer = await waitForCallback(tabId, base, state);
  } catch (error) {
    return {
      ok: false,
      cancelled: error instanceof CancelledError,
      error: error instanceof Error ? error.message : 'QwkSearch sign-in did not complete.',
    };
  } finally {
    try {
      await browser.tabs.remove(tabId);
    } catch {
      /* already closed */
    }
  }

  if ('error' in answer) {
    return answer.error === 'access_denied'
      ? { ok: false, cancelled: true, error: 'QwkSearch sign-in was cancelled.' }
      : { ok: false, error: `QwkSearch sign-in failed (${answer.error}). Please try again.` };
  }

  try {
    const response = await authorizedFetch('/api/qwksearch/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: answer.code, code_verifier: verifier }),
    });
    if (!response.ok) {
      return {
        ok: false,
        error:
          response.status === 401
            ? 'Your Debate AI sign-in expired. Sign in again and retry.'
            : `QwkSearch sign-in could not be completed (${response.status}).`,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'QwkSearch sign-in could not be completed.',
    };
  }
}

class CancelledError extends Error {
  constructor() {
    super('QwkSearch sign-in was cancelled.');
    this.name = 'CancelledError';
  }
}

/**
 * Resolves with QwkSearch's answer once the tab reaches the completion page,
 * and rejects if the reader closes the tab or nothing arrives in time.
 */
function waitForCallback(
  tabId: number,
  base: string,
  state: string,
): Promise<ExtensionCallbackResult> {
  return new Promise<ExtensionCallbackResult>((resolve, reject) => {
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onRemoved.removeListener(onRemoved);
      clearTimeout(timer);
      fn();
    };

    const consider = (url: string | undefined) => {
      const answer = readExtensionCallback(url, base, state);
      if (answer) finish(() => resolve(answer));
    };

    const onUpdated = (updatedTabId: number, _change: unknown, updatedTab: { url?: string }) => {
      if (updatedTabId === tabId) consider(updatedTab.url);
    };

    const onRemoved = (removedTabId: number) => {
      if (removedTabId === tabId) finish(() => reject(new CancelledError()));
    };

    const timer = setTimeout(
      () => finish(() => reject(new Error('QwkSearch sign-in timed out. Please try again.'))),
      CONNECT_TIMEOUT_MS,
    );

    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onRemoved.addListener(onRemoved);
    void browser.tabs
      .get(tabId)
      .then((current) => consider(current?.url))
      .catch(() => {
        /* the tab may already be gone; onRemoved handles that */
      });
  });
}
