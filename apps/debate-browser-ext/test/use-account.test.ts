import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from './helpers/render-hook';
import { resetStorage } from './helpers/memory-browser';

const mem = vi.hoisted(() => ({ sync: {} as Record<string, unknown>, local: {} as Record<string, unknown> }));
const runtime = vi.hoisted(() => ({ sendMessage: vi.fn() }));
const changed = vi.hoisted(() => ({
  local: new Set<() => void>(),
  sync: new Set<() => void>(),
}));

vi.mock('wxt/browser', async () => {
  const { memoryBrowser } = await import('./helpers/memory-browser');
  const base = memoryBrowser(mem);
  const withEvents = (area: 'local' | 'sync') => ({
    ...base.storage[area],
    onChanged: {
      addListener: (fn: () => void) => void changed[area].add(fn),
      removeListener: (fn: () => void) => void changed[area].delete(fn),
    },
  });
  return { browser: { storage: { local: withEvents('local'), sync: withEvents('sync') }, runtime } };
});

import { useAccount } from '@/src/auth/useAccount';
import { SIGN_IN_MESSAGE, SIGN_OUT_MESSAGE } from '@/src/auth/session';

const ADA = { id: 'u1', name: 'Ada', email: 'ada@example.com' };
const session = (apiBase = 'https://debate-ai.com') => ({ token: 't', user: ADA, apiBase });

async function mount() {
  const hook = await renderHook(() => useAccount());
  await act(async () => {});
  return hook;
}

beforeEach(() => {
  resetStorage(mem);
  runtime.sendMessage.mockReset();
  changed.local.clear();
  changed.sync.clear();
});

describe('useAccount', () => {
  it('is loading, then signed out when nothing is stored', async () => {
    const { result } = await mount();
    expect(result.current).toMatchObject({ user: null, isLoading: false, error: '' });
  });

  it('loads the stored account', async () => {
    mem.local.debateAccountSession = session();
    const { result } = await mount();
    expect(result.current.user).toEqual(ADA);
  });

  it('ignores a session that belongs to another deployment', async () => {
    mem.local.debateAccountSession = session('https://other.example.com');
    const { result } = await mount();
    expect(result.current.user).toBeNull();
  });

  it('follows sign-ins made elsewhere through storage changes, in local and sync', async () => {
    const { result } = await mount();

    mem.local.debateAccountSession = session();
    await act(async () => void [...changed.local].forEach((fn) => fn()));
    expect(result.current.user).toEqual(ADA);

    mem.sync.apiBase = 'https://other.example.com';
    await act(async () => void [...changed.sync].forEach((fn) => fn()));
    expect(result.current.user).toBeNull();
  });

  it('stops listening when unmounted', async () => {
    const { unmount } = await mount();
    expect(changed.local.size).toBe(1);
    expect(changed.sync.size).toBe(1);

    await unmount();
    expect(changed.local.size).toBe(0);
    expect(changed.sync.size).toBe(0);
  });

  it('signs in through the background worker and reloads the account', async () => {
    const { result } = await mount();
    runtime.sendMessage.mockImplementation(async () => {
      mem.local.debateAccountSession = session();
      return { ok: true, user: ADA };
    });

    await act(async () => result.current.signIn());

    expect(runtime.sendMessage).toHaveBeenCalledWith({ type: SIGN_IN_MESSAGE });
    expect(result.current.user).toEqual(ADA);
    expect(result.current.error).toBe('');
    expect(result.current.isLoading).toBe(false);
  });

  it('shows why a sign-in failed, with a fallback when the worker gives no reason', async () => {
    const { result } = await mount();

    runtime.sendMessage.mockResolvedValueOnce({ ok: false, error: 'Sign-in was cancelled.' });
    await act(async () => result.current.signIn());
    expect(result.current.error).toBe('Sign-in was cancelled.');

    runtime.sendMessage.mockResolvedValueOnce({ ok: false });
    await act(async () => result.current.signIn());
    expect(result.current.error).toBe('Sign-in did not complete.');

    runtime.sendMessage.mockResolvedValueOnce(undefined);
    await act(async () => result.current.signIn());
    expect(result.current.error).toBe('Sign-in did not complete.');
  });

  it('shows the message when the worker cannot be reached, and clears it on the next attempt', async () => {
    const { result } = await mount();

    runtime.sendMessage.mockRejectedValueOnce(new Error('Receiving end does not exist'));
    await act(async () => result.current.signIn());
    expect(result.current.error).toBe('Receiving end does not exist');
    expect(result.current.isLoading).toBe(false);

    runtime.sendMessage.mockRejectedValueOnce('boom');
    await act(async () => result.current.signIn());
    expect(result.current.error).toBe('Sign-in did not complete.');

    runtime.sendMessage.mockResolvedValueOnce({ ok: true });
    await act(async () => result.current.signIn());
    expect(result.current.error).toBe('');
  });

  it('signs out through the background worker and drops the account', async () => {
    mem.local.debateAccountSession = session();
    const { result } = await mount();
    runtime.sendMessage.mockImplementation(async () => {
      delete mem.local.debateAccountSession;
    });

    await act(async () => result.current.signOut());

    expect(runtime.sendMessage).toHaveBeenCalledWith({ type: SIGN_OUT_MESSAGE });
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
