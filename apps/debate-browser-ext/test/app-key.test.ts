import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStorage, type MemoryStorage } from './helpers/memory-browser';

const mem = vi.hoisted<MemoryStorage>(() => ({ sync: {}, local: {} }));
const failures = vi.hoisted(() => ({ read: false }));

vi.mock('wxt/browser', async () => {
  const { memoryBrowser } = await import('./helpers/memory-browser');
  const base = memoryBrowser(mem);
  return {
    browser: {
      storage: {
        ...base.storage,
        local: {
          ...base.storage.local,
          get: (keys: string) => {
            if (failures.read) return Promise.reject(new Error('storage unavailable'));
            return base.storage.local.get(keys);
          },
        },
      },
    },
  };
});

import { getAppAiKey, mirrorAppAiKey } from '@/src/ai/app-key';
import { clearOwnAiKey, setOwnAiKey } from '@debate-ai/webview/lib/ai/own-ai-key';

const OPENROUTER = 'sk-or-v1-abcdefghijkl';
const ANTHROPIC = 'sk-ant-abcdefghijkl';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  resetStorage(mem);
  failures.read = false;
  clearOwnAiKey();
  window.localStorage.clear();
});

describe('getAppAiKey', () => {
  it('prefers the key mirrored into extension storage', async () => {
    mem.local.appOwnAiKey = ANTHROPIC;
    window.localStorage.setItem('debate-ai.ownAiKey', OPENROUTER);
    expect(await getAppAiKey()).toEqual({ provider: 'anthropic', key: ANTHROPIC });
  });

  it("falls back to this origin's own copy when nothing is mirrored", async () => {
    window.localStorage.setItem('debate-ai.ownAiKey', OPENROUTER);
    expect(await getAppAiKey()).toEqual({ provider: 'openrouter', key: OPENROUTER });
  });

  it('ignores a mirrored value that is not a key', async () => {
    mem.local.appOwnAiKey = 'garbage';
    expect(await getAppAiKey()).toBeNull();
    mem.local.appOwnAiKey = 12345;
    expect(await getAppAiKey()).toBeNull();
  });

  it('falls back when extension storage throws', async () => {
    failures.read = true;
    window.localStorage.setItem('debate-ai.ownAiKey', ANTHROPIC);
    expect(await getAppAiKey()).toEqual({ provider: 'anthropic', key: ANTHROPIC });
  });

  it('returns null when no key was saved anywhere', async () => {
    expect(await getAppAiKey()).toBeNull();
  });
});

describe('mirrorAppAiKey', () => {
  it('mirrors an already-saved key right away', async () => {
    window.localStorage.setItem('debate-ai.ownAiKey', OPENROUTER);
    const stop = mirrorAppAiKey();
    await flush();
    expect(mem.local.appOwnAiKey).toBe(OPENROUTER);
    stop();
  });

  it('removes a stale mirror when there is no saved key', async () => {
    mem.local.appOwnAiKey = ANTHROPIC;
    const stop = mirrorAppAiKey();
    await flush();
    expect(mem.local).not.toHaveProperty('appOwnAiKey');
    stop();
  });

  it('follows the key as the app saves, replaces and clears it', async () => {
    const stop = mirrorAppAiKey();
    setOwnAiKey(OPENROUTER);
    await flush();
    expect(mem.local.appOwnAiKey).toBe(OPENROUTER);
    setOwnAiKey(ANTHROPIC);
    await flush();
    expect(mem.local.appOwnAiKey).toBe(ANTHROPIC);
    clearOwnAiKey();
    await flush();
    expect(mem.local).not.toHaveProperty('appOwnAiKey');
    stop();
  });

  it('picks up a change made in another tab, but only to the key it watches', async () => {
    const stop = mirrorAppAiKey();
    await flush();
    window.localStorage.setItem('debate-ai.ownAiKey', ANTHROPIC);
    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' }));
    await flush();
    expect(mem.local).not.toHaveProperty('appOwnAiKey');
    window.dispatchEvent(new StorageEvent('storage', { key: 'debate-ai.ownAiKey' }));
    await flush();
    expect(mem.local.appOwnAiKey).toBe(ANTHROPIC);
    stop();
  });

  it('stops mirroring once stopped', async () => {
    const stop = mirrorAppAiKey();
    await flush();
    stop();
    setOwnAiKey(OPENROUTER);
    window.dispatchEvent(new StorageEvent('storage', { key: 'debate-ai.ownAiKey' }));
    await flush();
    expect(mem.local).not.toHaveProperty('appOwnAiKey');
  });
});
