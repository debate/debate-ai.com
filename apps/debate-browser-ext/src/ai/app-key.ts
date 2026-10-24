/**
 * The OpenRouter or Anthropic key the reader saved in the Debate AI app's own
 * settings, reused by the article panel so the extension never asks for a key
 * of its own.
 *
 * The app keeps that key in `localStorage` (`@debate-ai/webview`'s
 * `lib/ai/own-ai-key.ts`). The Options page *is* the app, so a key saved there
 * lands in the extension origin's `localStorage` — but the panel is framed
 * into other sites, where that storage can be partitioned away from it. So the
 * Options page mirrors the key into `storage.local` ({@link mirrorAppAiKey}),
 * which every extension context reads the same, and the panel reads that
 * first, falling back to `localStorage`. `storage.local` rather than
 * `storage.sync`: a paid key should not be copied to the browser account.
 */
import { browser } from 'wxt/browser';
import {
  getOwnAiKey,
  parseOwnAiKey,
  subscribeOwnAiKey,
  type OwnAiKey,
} from '@debate-ai/webview/lib/ai/own-ai-key';

const STORAGE_KEY = 'appOwnAiKey';

/** The app's saved key, or `null` when the reader hasn't saved one. */
export async function getAppAiKey(): Promise<OwnAiKey | null> {
  try {
    const stored = (await browser.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
    const mirrored = parseOwnAiKey(typeof stored === 'string' ? stored : null);
    if (mirrored) return mirrored;
  } catch {
    // Storage unavailable: fall through to this origin's own copy.
  }
  return getOwnAiKey();
}

async function writeMirror(key: OwnAiKey | null): Promise<void> {
  if (key) await browser.storage.local.set({ [STORAGE_KEY]: key.key });
  else await browser.storage.local.remove(STORAGE_KEY);
}

/**
 * Keeps `storage.local` in step with the key the app saves, removes and
 * changes in other tabs. Called once by the Options page.
 */
export function mirrorAppAiKey(): () => void {
  void writeMirror(getOwnAiKey());
  const unsubscribe = subscribeOwnAiKey((key) => void writeMirror(key));
  const onStorage = (event: StorageEvent) => {
    if (event.key === 'debate-ai.ownAiKey') void writeMirror(getOwnAiKey());
  };
  window.addEventListener('storage', onStorage);
  return () => {
    unsubscribe();
    window.removeEventListener('storage', onStorage);
  };
}
