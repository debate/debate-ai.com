/**
 * The signed-in account, as React state, kept in step with `storage.local`.
 *
 * Every extension page that shows the account — the panel, the popup, Options
 * — reads it through this, so signing in from one of them updates the others
 * without a reload: `storage.onChanged` fires in every page of the extension.
 */
import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

import {
  getActiveSession,
  requestSignIn,
  requestSignOut,
  type AuthUser,
} from './session';

export interface AccountState {
  user: AuthUser | null;
  isLoading: boolean;
  /** Set when the last sign-in attempt failed, so a page can show why. */
  error: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAccount(): AccountState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    const session = await getActiveSession();
    setUser(session?.user ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await reload();
      if (!cancelled) setIsLoading(false);
    })();

    const onChanged = () => void reload();
    browser.storage.local.onChanged.addListener(onChanged);
    // The deployment the session belongs to is a synced setting, and switching
    // it invalidates the session — so that matters here too.
    browser.storage.sync.onChanged.addListener(onChanged);
    return () => {
      cancelled = true;
      browser.storage.local.onChanged.removeListener(onChanged);
      browser.storage.sync.onChanged.removeListener(onChanged);
    };
  }, [reload]);

  const signIn = useCallback(async () => {
    setError('');
    setIsLoading(true);
    try {
      const result = await requestSignIn();
      if (!result?.ok) setError(result?.error || 'Sign-in did not complete.');
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in did not complete.');
    } finally {
      setIsLoading(false);
    }
  }, [reload]);

  const signOut = useCallback(async () => {
    setError('');
    setIsLoading(true);
    try {
      await requestSignOut();
      await reload();
    } finally {
      setIsLoading(false);
    }
  }, [reload]);

  return { user, isLoading, error, signIn, signOut };
}
