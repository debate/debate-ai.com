/**
 * @fileoverview The guest sign-in prompt bus: how a tool deep inside a package
 * asks the app to open its login dialog, with a message naming what the guest
 * was trying to save.
 *
 * The tools in this repo are deliberately usable signed out — every store in
 * `state/toolRecordCollections.ts` writes `localStorage` first and treats the
 * account as a mirror of it. But "usable signed out" quietly became "favourite
 * a video on your laptop, open your phone, find nothing": the work is real,
 * the guest just has nowhere to keep it. Telling them that *at the moment they
 * click* is the only point where it is still actionable.
 *
 * Why a bus rather than a hook: the dialog is `apps/debate-ai.com`'s
 * `LoginDialog`, and `debate-data-sync` is a leaf package the tool packages
 * depend on — it cannot import the app, and the tool packages cannot import it
 * either. So this module stays framework-free (no React, no `next/*`, no
 * `fetch`): a package publishes an intent, the app subscribes once and renders
 * whatever sign-in UI it likes. A test subscribes and asserts on the intent.
 *
 * The same signed-in flag that gates the mirror gates the prompt, so the two
 * can never disagree about whether there is an account to save to.
 *
 * @module state/sign-in-prompt
 */

/** Why a guest is being asked to sign in. */
export interface SignInPrompt {
  /**
   * The tool the guest was using, as the sidebar names it — the prompt's
   * title says "Sign in to save your {feature}".
   */
  feature: string;
  /**
   * One sentence naming what signing in keeps, shown under the title. Written
   * for someone who has just had a click not do what they expected, so it
   * says what happens next rather than what went wrong.
   */
  message: string;
  /** Where to return to afterwards. Defaults to the current page. */
  returnTo?: string;
}

/** A subscriber to sign-in prompts — in practice, the app's dialog host. */
export type SignInPromptListener = (prompt: SignInPrompt) => void;

const listeners = new Set<SignInPromptListener>();

/** Whether there is a signed-in account. Mirrors `setToolRecordSyncEnabled`. */
let signedIn = false;

/**
 * Records whether a signed-in account exists, so {@link requireSignIn} can
 * answer without every caller needing a session hook.
 *
 * Called by the app alongside `setToolRecordSyncEnabled` — see
 * `lib/hooks/useToolRecordSync.ts`.
 *
 * @param value - Whether a session is present.
 */
export function setSignedIn(value: boolean): void {
  signedIn = value;
}

/** Whether the bus believes a signed-in account exists. */
export function isSignedIn(): boolean {
  return signedIn;
}

/**
 * Subscribes to sign-in prompts.
 *
 * @param listener - Called with each prompt raised while subscribed.
 * @returns An unsubscribe function.
 */
export function subscribeToSignInPrompts(listener: SignInPromptListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Raises a sign-in prompt, whether or not anyone is listening.
 *
 * Deliberately unconditional: {@link requireSignIn} is the guarded entry point
 * most callers want, and a caller that has already decided a guest needs
 * prompting should not have that decision second-guessed here.
 *
 * A listener that throws is not allowed to take down the click that raised the
 * prompt — the local save has usually already happened by this point.
 *
 * @param prompt - What the guest was trying to do.
 */
export function promptSignIn(prompt: SignInPrompt): void {
  for (const listener of [...listeners]) {
    try {
      listener(prompt);
    } catch {
      // A broken dialog host costs this guest the prompt, not the click.
    }
  }
}

/**
 * The guard a tool's click handler wraps a save in: true when there is an
 * account to save to, false — having raised a prompt — when there is not.
 *
 * Callers still save locally either way. A guest who dismisses the dialog
 * keeps the favourite they just made in this browser, and the first sign-in
 * pushes it up (`hydrateToolRecords` treats a local-only record as something
 * to adopt, never something to discard). The prompt is an offer to keep the
 * work, not a paywall in front of it.
 *
 * @param prompt - What the guest is trying to save.
 * @returns Whether a signed-in account is present.
 */
export function requireSignIn(prompt: SignInPrompt): boolean {
  if (signedIn) return true;
  promptSignIn(prompt);
  return false;
}

/** Drops every subscriber. For tests and for a full client-side teardown. */
export function resetSignInPrompts(): void {
  listeners.clear();
  signedIn = false;
}
