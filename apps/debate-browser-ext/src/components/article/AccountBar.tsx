/**
 * Who you are signed in as, and which model answers your questions.
 *
 * Both live in one strip because they are one decision for the reader: the
 * Debate AI account *is* a model provider (the server holds the key), so
 * "signed out" and "no API key" are the same problem, and this is where it
 * gets said and fixed.
 */
import { LogIn, LogOut, Settings2 } from 'lucide-react';
import React from 'react';
import { browser } from 'wxt/browser';

import { Button } from '@/components/ui/button';
import type { AuthUser } from '@/src/auth/session';

interface AccountBarProps {
  user: AuthUser | null;
  isBusy: boolean;
  error?: string;
  /** Provider label and whether it can actually answer, from describeActiveProvider. */
  provider: { label: string; ready: boolean } | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

const AccountBar: React.FC<AccountBarProps> = ({
  user,
  isBusy,
  error,
  provider,
  onSignIn,
  onSignOut,
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center gap-2">
      {user ? (
        <>
          {user.image ? (
            <img
              src={user.image}
              alt=""
              className="h-6 w-6 shrink-0 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
              {(user.name || user.email || '?').slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {user.name || user.email}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Sign out"
            disabled={isBusy}
            onClick={onSignOut}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 flex-1 gap-1.5 text-xs"
          disabled={isBusy}
          onClick={onSignIn}
        >
          <LogIn className="h-3.5 w-3.5" />
          {isBusy ? 'Opening sign-in…' : 'Sign in with Google'}
        </Button>
      )}

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

    {provider && (
      <p className="text-[11px] text-muted-foreground">
        AI: <span className="font-medium text-foreground">{provider.label}</span>
        {!provider.ready && (
          <span className="text-destructive">
            {' '}
            — not set up yet.{' '}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => browser.runtime.openOptionsPage()}
            >
              Add a key
            </button>
            .
          </span>
        )}
      </p>
    )}

    {error && <p className="text-[11px] text-destructive">{error}</p>}
  </div>
);

export default AccountBar;
