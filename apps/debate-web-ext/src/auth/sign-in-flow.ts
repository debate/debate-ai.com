/**
 * The background worker's half of the sign-in handoff: open the sign-in tab,
 * wait for `/auth/extension-complete` to park a one-time token in its URL,
 * spend it, and close the tab.
 *
 * It lives in the worker rather than in whichever page asked because the page
 * that asks — the popup above all — is routinely closed by the very click that
 * opens the sign-in tab, and a flow that dies with its opener is a flow that
 * only ever completes by luck. `src/auth/session.ts` explains the rest of the
 * handoff and why a bearer token is needed at all.
 */
import { browser } from 'wxt/browser';

import { getSettings } from '@/src/settings/settings';
import { EXTENSION_CALLBACK_PATH, readTokenFromUrl } from './handoff';
import { exchangeOneTimeToken, setStoredSession, type SignInResult } from './session';

/**
 * How long to leave the sign-in tab open before giving up on it.
 *
 * Generous on purpose: this covers a reader finding their password manager,
 * picking a Google account and clearing a two-factor prompt, not a round trip.
 */
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

/** Runs sign-in end to end, resolving once there is a session or a reason there isn't. */
export async function runSignInFlow(): Promise<SignInResult> {
  const { apiBase } = await getSettings();
  const base = apiBase.replace(/\/$/, '');
  const loginUrl = `${base}/login?callbackURL=${encodeURIComponent(EXTENSION_CALLBACK_PATH)}`;

  let tab: { id?: number } | undefined;
  try {
    tab = await browser.tabs.create({ url: loginUrl, active: true });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not open sign-in.' };
  }
  const tabId = tab?.id;
  if (tabId == null) return { ok: false, error: 'Could not open a sign-in tab.' };

  let token: string;
  try {
    token = await waitForToken(tabId);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Sign-in did not complete.',
    };
  } finally {
    // The tab has served its purpose either way, and it is showing a URL with
    // a token in it. It may already be gone if the reader closed it.
    try {
      await browser.tabs.remove(tabId);
    } catch {
      /* already closed */
    }
  }

  try {
    const session = await exchangeOneTimeToken(token, base);
    await setStoredSession(session);
    return { ok: true, user: session.user };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Sign-in could not be completed.',
    };
  }
}

/**
 * Resolves with the one-time token as soon as the sign-in tab's URL carries
 * one, and rejects if the reader closes that tab or nothing arrives in time.
 *
 * The tab's URL is readable because the manifest grants host permissions for
 * the deployments the extension talks to — this never sees any other tab.
 */
function waitForToken(tabId: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
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
      const token = readTokenFromUrl(url);
      if (token) finish(() => resolve(token));
    };

    const onUpdated = (
      updatedTabId: number,
      _change: unknown,
      updatedTab: { url?: string },
    ) => {
      if (updatedTabId === tabId) consider(updatedTab.url);
    };

    const onRemoved = (removedTabId: number) => {
      if (removedTabId === tabId) {
        finish(() => reject(new Error('Sign-in was cancelled.')));
      }
    };

    const timer = setTimeout(
      () => finish(() => reject(new Error('Sign-in timed out. Please try again.'))),
      SIGN_IN_TIMEOUT_MS,
    );

    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onRemoved.addListener(onRemoved);

    // A fragment-only navigation can land before the listener is attached, so
    // check the tab's current URL once rather than waiting for an update that
    // has already happened.
    void browser.tabs
      .get(tabId)
      .then((current) => consider(current?.url))
      .catch(() => {
        /* the tab may already be gone; onRemoved handles that */
      });
  });
}
