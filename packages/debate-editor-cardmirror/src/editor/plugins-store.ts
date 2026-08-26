/**
 * Per-plugin enabled flags — localStorage blob, pins-store style.
 * Install state (which plugins exist) lives on disk with main; this
 * store only remembers which ones the user switched on.
 */
import { settings } from './settings.js';

const STORAGE_KEY = 'pmd-plugins';

interface PluginsBlob {
  enabled: Record<string, boolean>;
}

function read(): PluginsBlob {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PluginsBlob>;
      if (parsed && typeof parsed === 'object' && parsed.enabled && typeof parsed.enabled === 'object') {
        return { enabled: parsed.enabled };
      }
    }
  } catch {
    /* fall through */
  }
  return { enabled: {} };
}

function write(blob: PluginsBlob): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
  } catch {
    /* quota — non-fatal */
  }
}

export function isPluginEnabled(id: string): boolean {
  return read().enabled[id] === true;
}

export function setPluginEnabled(id: string, on: boolean): void {
  const blob = read();
  blob.enabled[id] = on;
  write(blob);
}

/** Boot-time reconciliation against what is ACTUALLY installed on disk:
 *  drops enabled flags, `plugin:<id>` storage bags, and dot-namespaced
 *  key overrides for plugins whose install directory no longer exists
 *  (deleted outside the app, or an uninstall that predates this
 *  cleanup). Directory-absent is the one unambiguous signal — a plugin
 *  that merely FAILED TO LOAD is still installed, and pruning on that
 *  would wipe a user's keybindings over a transient error. Command ids
 *  are enforced to start with `<pluginId>.` at registration, and no
 *  static ribbon id contains a dot, so the prefix test is exact. */
export function reconcilePluginState(installedIds: ReadonlySet<string>): void {
  const blob = read();
  let changed = false;
  for (const id of Object.keys(blob.enabled)) {
    if (!installedIds.has(id)) {
      delete blob.enabled[id];
      changed = true;
    }
  }
  if (changed) write(blob);
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('plugin:') && !installedIds.has(key.slice('plugin:'.length))) {
        stale.push(key);
      }
    }
    for (const key of stale) localStorage.removeItem(key);
  } catch {
    /* storage unavailable — nothing to prune */
  }
  const overrides = settings.get('ribbonKeyOverrides');
  const kept: Partial<Record<string, string | string[]>> = {};
  let dropped = 0;
  for (const [cmdId, key] of Object.entries(overrides)) {
    const dot = cmdId.indexOf('.');
    if (dot > 0 && !installedIds.has(cmdId.slice(0, dot))) {
      dropped++;
      continue;
    }
    if (key !== undefined) kept[cmdId] = key;
  }
  if (dropped > 0) settings.set('ribbonKeyOverrides', kept);
  // Custom ribbon buttons bound to a gone plugin's commands unconfigure the
  // same way (dot-prefix test — setting commands use `toggle:`/`cycle:`, no
  // dot, and static ribbon ids are dot-free).
  const customButtons = settings.get('ribbonCustomButtons');
  const keptButtons = customButtons.filter((b) => {
    const dot = b.command.indexOf('.');
    return dot <= 0 || installedIds.has(b.command.slice(0, dot));
  });
  if (keptButtons.length !== customButtons.length) {
    settings.set('ribbonCustomButtons', keptButtons);
  }
}
