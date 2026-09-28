/**
 * Plugin setting VALUES — read/write/subscribe. Definitions live in the
 * registry (declared at registration, gone on unregister); values live
 * inside the plugin's `plugin:<id>` storage bag under a reserved
 * `__settings` key, so both existing cleanup paths (uninstall purge and
 * boot reconciliation) cover them with no extra bookkeeping. The
 * settings modal writes through here; plugins read through
 * `api.settings`, which applies the declared default whenever a stored
 * value is missing or off-type (a plugin can scribble over `__settings`
 * via its own storage api — that only corrupts its own settings, and
 * the type check here degrades it to defaults rather than surprises).
 */
import { pluginSettingsDefs, type PluginSettingDef, type PluginSettingValue } from './plugin-registry.js';

export const PLUGIN_SETTINGS_BAG_KEY = '__settings';

function readBag(pluginId: string): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(`plugin:${pluginId}`) || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readValues(pluginId: string): Record<string, unknown> {
  const raw = readBag(pluginId)[PLUGIN_SETTINGS_BAG_KEY];
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

/** The stored value when it matches the declared type, else the default. */
export function effectivePluginSettingValue(
  def: PluginSettingDef,
  raw: unknown,
): PluginSettingValue {
  switch (def.type) {
    case 'boolean':
      return typeof raw === 'boolean' ? raw : def.default;
    case 'text':
    case 'multiline':
      return typeof raw === 'string' ? raw : def.default;
    case 'number':
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : def.default;
    case 'select':
      return typeof raw === 'string' && (def.options ?? []).includes(raw) ? raw : def.default;
  }
}

/** Current value of a declared setting; undefined for undeclared keys. */
export function getPluginSettingValue(
  pluginId: string,
  key: string,
): PluginSettingValue | undefined {
  const def = pluginSettingsDefs(pluginId).find((d) => d.key === key);
  if (!def) return undefined;
  return effectivePluginSettingValue(def, readValues(pluginId)[key]);
}

type SettingListener = (key: string, value: PluginSettingValue) => void;
const listeners = new Map<string, Set<SettingListener>>();

/** Persist a value and notify the plugin's subscribers. Listener errors
 *  are contained — a throwing plugin callback must not break the modal
 *  control that triggered the write. */
export function setPluginSettingValue(
  pluginId: string,
  key: string,
  value: PluginSettingValue,
): void {
  const bag = readBag(pluginId);
  const prev = bag[PLUGIN_SETTINGS_BAG_KEY];
  const values =
    prev && typeof prev === 'object' && !Array.isArray(prev)
      ? (prev as Record<string, unknown>)
      : {};
  values[key] = value;
  bag[PLUGIN_SETTINGS_BAG_KEY] = values;
  try {
    localStorage.setItem(`plugin:${pluginId}`, JSON.stringify(bag));
  } catch {
    /* quota — non-fatal */
  }
  for (const cb of listeners.get(pluginId) ?? []) {
    try {
      cb(key, value);
    } catch (err) {
      console.error(`[plugins] ${pluginId} setting listener failed:`, err);
    }
  }
}

export function subscribePluginSettings(pluginId: string, cb: SettingListener): () => void {
  let set = listeners.get(pluginId);
  if (!set) {
    set = new Set();
    listeners.set(pluginId, set);
  }
  set.add(cb);
  return () => {
    set.delete(cb);
    if (set.size === 0) listeners.delete(pluginId);
  };
}

export function resetPluginSettingListenersForTests(): void {
  listeners.clear();
}
