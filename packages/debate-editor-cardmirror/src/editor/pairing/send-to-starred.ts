/**
 * "Send to Starred" — send the cursor's enclosing card (or the active selection)
 * to the single starred recipient/group. Sourced exactly like Send to Dropzone
 * (`resolveSendSlice`), but routed to the relay instead of the dropzone shelf,
 * building the same payload the Send pill builds.
 */

import type { EditorView } from 'prosemirror-view';
import { settings, type PairingPartner, type PairingGroup } from '../settings.js';
import { takeSendSlice } from '../speech-doc-send.js';
import { deriveDropzoneLabel } from '../dropzone-store.js';
import { showToast } from '../toast.js';
import { relayClient, sendOutcomeToast, type SendItem } from './relay-client.js';

/** Resolve the starred ref → recipient codes + a display label (groups also
 *  carry a `via` label). Returns null when nothing is starred or the starred
 *  recipient/group no longer exists. Pure (takes the pairing lists) so it can be
 *  unit-tested. */
export function resolveStarredTarget(
  star: { kind: 'partner' | 'group'; ref: string } | null,
  partners: readonly PairingPartner[],
  groups: readonly PairingGroup[],
): { codes: string[]; label: string; via?: string } | null {
  if (!star) return null;
  const known = partners.filter((p) => p.code);
  if (star.kind === 'partner') {
    const p = known.find((x) => x.code === star.ref);
    if (!p) return null;
    return { codes: [p.code], label: p.name || p.code };
  }
  const g = groups.find((x) => x.id === star.ref);
  if (!g) return null;
  // Re-filter members against current partners (one may have been removed).
  const codes = g.memberCodes.filter((c) => known.some((p) => p.code === c));
  return { codes, label: g.label || 'Group', via: g.label };
}

/** Send the cursor's card / active selection to the starred recipient or group.
 *  Silently no-ops when nothing is starred; toasts when sharing is off or the
 *  starred group has no reachable members. */
export async function sendViewToStarred(view: EditorView): Promise<void> {
  const target = resolveStarredTarget(
    settings.get('pairingStarred'),
    settings.get('pairingPartners'),
    settings.get('pairingGroups'),
  );
  if (!target) return; // nothing starred (or the starred target was deleted) → no-op
  if (!settings.get('pairingEnabled')) {
    showToast('Card sharing is off');
    return;
  }
  if (target.codes.length === 0) {
    showToast('The starred group has no recipients yet');
    return;
  }
  const slice = takeSendSlice(view);
  if (!slice) return;
  const type = slice.content.firstChild?.type.name || 'text';
  const item: SendItem = {
    label: deriveDropzoneLabel(slice, type),
    type,
    sliceJson: slice.toJSON(),
  };
  const res = await relayClient.send(target.codes, item, { via: target.via });
  showToast(sendOutcomeToast(target.label, res));
}
