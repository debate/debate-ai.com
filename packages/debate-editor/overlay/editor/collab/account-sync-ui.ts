/**
 * Settings → Collaboration → "Account sync": the row that replaced upstream's
 * "Debate Decoded account" linking (connect code, membership, seat limit).
 *
 * Card sharing and co-editing ride the signed-in debate-ai.com account
 * (`account-sync.ts`), so there is nothing to link — the row only says which
 * account this browser shares as, and offers sign-in when there is none.
 * Same status chip markup as the old row, so the existing
 * `.pmd-pairing-account*` styles apply unchanged.
 */

import {
  accountSyncStatus,
  onAccountSyncChanged,
  refreshAccountSync,
  type AccountSyncStatus,
} from './account-sync.js';

/** Where a signed-out user goes to sign in; returns here afterwards. */
function signInHref(): string {
  try {
    const back = `${window.location.pathname}${window.location.search}`;
    return `/login?callbackURL=${encodeURIComponent(back)}`;
  } catch {
    return '/login';
  }
}

/** Builds the row's control; `cleanup` unsubscribes when the settings row unmounts. */
export function buildAccountSyncEditor(): { el: HTMLElement; cleanup: () => void } {
  const wrap = document.createElement('div');
  wrap.className = 'pmd-pairing-account';

  const controls = document.createElement('div');
  controls.className = 'pmd-pairing-account-controls';
  const chip = document.createElement('div');
  chip.className = 'pmd-pairing-account-connected';
  controls.appendChild(chip);

  const signIn = document.createElement('a');
  signIn.className = 'pmd-settings-btn';
  signIn.textContent = 'Sign in';
  controls.appendChild(signIn);
  wrap.appendChild(controls);

  const message = document.createElement('div');
  message.className = 'pmd-pairing-account-message';
  wrap.appendChild(message);

  function render(st: AccountSyncStatus): void {
    chip.replaceChildren();
    chip.classList.toggle('pmd-pairing-account-notlinked', !st.signedIn);
    const glyph = document.createElement('span');
    glyph.className = st.signedIn
      ? 'pmd-pairing-account-check'
      : 'pmd-pairing-account-check pmd-pairing-account-cross';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = st.signedIn ? '✓' : '✕';
    chip.appendChild(glyph);
    const who = st.email || st.name;
    chip.appendChild(
      document.createTextNode(st.signedIn ? (who ? `Syncing as ${who}` : 'Signed in') : 'Not signed in'),
    );
    signIn.hidden = st.signedIn;
    signIn.href = signInHref();
    message.textContent = st.signedIn
      ? ''
      : 'Sign in to send and receive cards and to start co-editing sessions. You can still join a session from an invite link without an account.';
  }

  render(accountSyncStatus());
  void refreshAccountSync().then(render);
  const off = onAccountSyncChanged(() => render(accountSyncStatus()));
  return { el: wrap, cleanup: off };
}
