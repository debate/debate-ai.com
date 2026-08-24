/**
 * Mode-switch marker — the handoff record carried across the reload
 * a `multiDocWorkspace` toggle triggers.
 *
 * Before reloading, the initiating window journals every open doc
 * and writes this marker to sessionStorage. After the reload, the
 * startup-recovery flow reads it back and auto-opens EXACTLY the
 * docs listed — and only those. Journals from other sessions (crash
 * leftovers) are left in the store for the recovery sidebar on the
 * next normal launch; sweeping them into the new layout would make
 * stale docs reappear on every toggle.
 *
 * Each entry also records whether the doc had unsaved changes when
 * the switch started. Clean docs already match their on-disk files,
 * so after they reopen their mode-switch journal is deleted — the
 * journal store keeps its journals-mean-unsaved-work invariant —
 * and they reopen clean (no spurious close prompts).
 *
 * Docs open in OTHER windows (single→multi closes them) can't reach
 * the surviving window's sessionStorage; those windows report their
 * entries to the main process instead, and the surviving window
 * collects them after the reload. This module only handles the
 * marker encoding shared by both channels.
 */

export interface ModeSwitchDoc {
  uid: string;
  dirty: boolean;
}

export function encodeModeSwitchMarker(docs: ModeSwitchDoc[]): string {
  return JSON.stringify({ docs });
}

/** Decode a marker read back from sessionStorage. `null` input means
 *  no mode switch happened (`null` out). A malformed marker still
 *  means a switch happened — return an empty list so the caller
 *  consumes the marker without sweeping in unrelated journals. */
export function decodeModeSwitchMarker(raw: string | null): ModeSwitchDoc[] | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as { docs?: unknown };
    if (!Array.isArray(parsed.docs)) return [];
    return parsed.docs.filter(
      (d): d is ModeSwitchDoc =>
        typeof d === 'object' &&
        d !== null &&
        typeof (d as ModeSwitchDoc).uid === 'string' &&
        typeof (d as ModeSwitchDoc).dirty === 'boolean',
    );
  } catch {
    return [];
  }
}

/** uid → was-dirty-before-the-switch, for scoping + journal cleanup. */
export function modeSwitchDirtyMap(docs: ModeSwitchDoc[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const d of docs) {
    // A uid reported dirty by ANY channel stays dirty — losing an
    // unsaved-changes flag is worse than a redundant close prompt.
    map.set(d.uid, (map.get(d.uid) ?? false) || d.dirty);
  }
  return map;
}
