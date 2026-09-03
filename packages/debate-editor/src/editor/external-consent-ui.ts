/**
 * Renderer half of external-app consent (main half:
 * apps/desktop/src/external-consent.ts). Three jobs:
 *
 *  1. MIRROR — push the master toggle + per-app decisions to main on
 *     boot and on every settings change (`host:sync-external-consent`).
 *     Main enforces; settings persist; this keeps them agreeing.
 *  2. PROMPT — run the first-contact consent dialog on main's request
 *     (route-style, 1/2/3 keys): Allow always / Allow once / Deny.
 *     Always/Deny are recorded in the settings registry; Esc records
 *     nothing (asks again next time). The reply releases main's queue
 *     of held actions.
 *  3. NOTES — stamp `lastSeen` when main serves an allowed request,
 *     and explain unidentified callers where the consent prompt would
 *     have appeared: a full dialog the first time this session, a
 *     toast after (main rate-limits the stream).
 */
import { settings } from './settings.js';
import type { ExternalAppConsent } from './settings.js';
import { alertDialog, promptForRouteChoice } from './text-prompt.js';
import { showToast } from './toast.js';

interface ConsentPromptRequest {
  requestId: string;
  appId: string;
  appName: string | null;
  appVersion: string | null;
}

interface ConsentNote {
  kind: 'seen' | 'unidentified';
  appId?: string;
  when?: string;
}

/** Preload surface this module reads — structural, so the renderer
 *  build takes no dependency on the desktop preload. */
interface ConsentBridge {
  syncExternalConsent(state: {
    policy: 'off' | 'ask' | 'open';
    apps: Record<string, 'allow' | 'deny'>;
  }): void;
  onExternalConsentPrompt(handler: (req: ConsentPromptRequest) => void): () => void;
  sendExternalConsentPromptResult(result: { requestId: string; outcome: string }): void;
  onExternalConsentNote(handler: (note: ConsentNote) => void): () => void;
}

function pickBridge(): ConsentBridge | null {
  const api = (window as unknown as { electronAPI?: Partial<ConsentBridge> }).electronAPI;
  if (!api) return null;
  if (typeof api.syncExternalConsent !== 'function') return null;
  if (typeof api.onExternalConsentPrompt !== 'function') return null;
  if (typeof api.sendExternalConsentPromptResult !== 'function') return null;
  if (typeof api.onExternalConsentNote !== 'function') return null;
  return api as ConsentBridge;
}

/** Upsert one app's decision in the settings registry. Exported for
 *  the External-apps settings rows, which flip decisions in place. */
export function recordExternalAppDecision(appId: string, decision: 'allow' | 'deny'): void {
  const now = new Date().toISOString();
  const list = settings.get('externalAppConsents');
  const existing = list.find((c) => c.id === appId);
  const next: ExternalAppConsent[] = existing
    ? list.map((c) => (c.id === appId ? { ...c, decision, lastSeen: now } : c))
    : [...list, { id: appId, decision, firstSeen: now, lastSeen: now }];
  settings.set('externalAppConsents', next);
}

function stampLastSeen(appId: string, when: string): void {
  const list = settings.get('externalAppConsents');
  if (!list.some((c) => c.id === appId)) return;
  settings.set(
    'externalAppConsents',
    list.map((c) => (c.id === appId ? { ...c, lastSeen: when } : c)),
  );
}

const UNIDENTIFIED_EXPLANATION =
  'An external app tried to insert text into your documents, but it did not ' +
  'identify itself, so CardMirror turned it away. This usually means the app ' +
  'predates CardMirror’s app permissions — update the app you were ' +
  'sending from, then try again.';

/** Mount the consent bridge. Returns an unsubscribe for tests. */
export function installExternalConsent(): () => void {
  const bridge = pickBridge();
  if (!bridge) return () => {};

  const sync = (): void => {
    const apps: Record<string, 'allow' | 'deny'> = {};
    for (const c of settings.get('externalAppConsents')) apps[c.id] = c.decision;
    bridge.syncExternalConsent({ policy: settings.get('externalInsertPolicy'), apps });
  };
  sync();
  const unsubscribeSettings = settings.subscribe(sync);

  const unsubscribePrompt = bridge.onExternalConsentPrompt((req) => {
    void (async () => {
      const label = req.appName
        ? `${req.appName}${req.appVersion ? ` v${req.appVersion}` : ''}`
        : req.appId;
      const choice = await promptForRouteChoice<'allow-always' | 'allow-once' | 'deny'>({
        message: `${label} wants to insert text into your documents.`,
        choices: [
          {
            value: 'allow-always',
            label: 'Always Allow',
            description: 'Let it insert text and jump to sources from now on.',
          },
          {
            value: 'allow-once',
            label: 'Allow Once',
            description: 'Just this time — ask again on its next send.',
          },
          {
            value: 'deny',
            label: 'Deny',
            description: 'Block it. Change later in Settings → Plugins → External apps.',
          },
        ],
      });
      if (choice === 'allow-always') recordExternalAppDecision(req.appId, 'allow');
      if (choice === 'deny') recordExternalAppDecision(req.appId, 'deny');
      bridge.sendExternalConsentPromptResult({
        requestId: req.requestId,
        outcome: choice ?? 'dismissed',
      });
    })();
  });

  let unidentifiedDialogShown = false;
  const unsubscribeNotes = bridge.onExternalConsentNote((note) => {
    if (note.kind === 'seen' && typeof note.appId === 'string') {
      stampLastSeen(note.appId, typeof note.when === 'string' ? note.when : new Date().toISOString());
      return;
    }
    if (note.kind === 'unidentified') {
      // Where the consent prompt would have appeared: a real dialog the
      // first time (this is a "why isn't my send working" moment), then
      // toasts — main already rate-limits the stream.
      if (unidentifiedDialogShown) {
        showToast('An external app tried to insert text without identifying itself — update it to continue.');
      } else {
        unidentifiedDialogShown = true;
        void alertDialog(UNIDENTIFIED_EXPLANATION, { title: 'External app blocked' });
      }
    }
  });

  return () => {
    unsubscribeSettings();
    unsubscribePrompt();
    unsubscribeNotes();
  };
}
