/**
 * Plugin registry — the only place plugin bundles register. A bundle
 * (loaded by the desktop host) calls `window.__registerCardMirrorPlugin`
 * with a versioned definition; the registry validates it, mints the
 * plugin's capability api object, and indexes its commands so the
 * ribbon/palette/keymap chokepoints can find them. Card-cutter-port
 * precedent: if nothing registers, everything stays inert.
 */
import { showToast } from './toast.js';
import type { CardMirrorPluginApi } from './plugin-api.js';

export const PLUGIN_API_VERSION = 1;

export interface PluginCommandDef {
  /** Must start with `<pluginId>.` */
  id: string;
  label: string;
  keywords?: readonly string[];
  defaultKey?: string | string[] | null;
  run: (api: CardMirrorPluginApi) => void | Promise<void>;
}

export type PluginSettingValue = boolean | string | number;

/** A user-configurable setting a plugin declares at registration. The
 *  host renders the controls (gear on the plugin's Settings row); the
 *  plugin reads values through `api.settings`. Values persist in the
 *  plugin's storage bag, so uninstall cleanup covers them for free. */
export interface PluginSettingDef {
  key: string;
  label: string;
  /** `text` renders a single-line input; `multiline` a textarea (for
   *  list-shaped values — one entry per line by convention). Both hold
   *  a plain string value. */
  type: 'boolean' | 'text' | 'multiline' | 'number' | 'select';
  /** Must match `type`; for `select`, must be one of `options`. */
  default: PluginSettingValue;
  /** Required for `select` (the choices), forbidden otherwise. */
  options?: readonly string[];
  /** Muted helper line rendered under the control. */
  description?: string;
}

export interface PluginDefinition {
  id: string;
  name: string;
  apiVersion: number;
  commands: PluginCommandDef[];
  settings?: PluginSettingDef[];
}

declare global {
  interface Window {
    __registerCardMirrorPlugin?: (def: PluginDefinition) => void;
  }
}

interface RegisteredPlugin {
  def: PluginDefinition;
  api: CardMirrorPluginApi;
  settings: PluginSettingDef[];
}

const plugins = new Map<string, RegisteredPlugin>();
const commands = new Map<string, { pluginId: string; cmd: PluginCommandDef }>();
let makeApi: ((pluginId: string) => CardMirrorPluginApi) | null = null;

const PLUGIN_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const SETTING_KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const SETTING_TYPES = new Set(['boolean', 'text', 'multiline', 'number', 'select']);

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/** Validate + snapshot a definition's `settings` array. Same discipline
 *  as commands: every field is read exactly once, and any off-shape
 *  entry rejects the whole registration — the settings modal renders
 *  these blind, so it must be able to trust the shape. */
function validateSettings(
  def: PluginDefinition,
): { ok: true; settings: PluginSettingDef[] } | { ok: false; error: string } {
  const raw = def.settings;
  if (raw === undefined) return { ok: true, settings: [] };
  if (!Array.isArray(raw)) return { ok: false, error: 'settings must be an array' };
  const snapshots: PluginSettingDef[] = [];
  const seen = new Set<string>();
  for (const s of raw) {
    if (!s || typeof s !== 'object') return { ok: false, error: 'settings entries must be objects' };
    const { key, label, type, options, description } = s;
    const dflt = s.default;
    if (typeof key !== 'string' || !SETTING_KEY_RE.test(key)) {
      return { ok: false, error: `setting key "${String(key)}" is invalid` };
    }
    if (seen.has(key)) return { ok: false, error: `duplicate setting key "${key}"` };
    if (typeof label !== 'string' || !label) {
      return { ok: false, error: `setting "${key}" has no label` };
    }
    if (typeof type !== 'string' || !SETTING_TYPES.has(type)) {
      return { ok: false, error: `setting "${key}" has invalid type "${String(type)}"` };
    }
    if (description !== undefined && typeof description !== 'string') {
      return { ok: false, error: `setting "${key}" has an invalid description` };
    }
    if (type === 'select') {
      if (!isStringArray(options) || options.length === 0 || options.some((o) => !o)) {
        return { ok: false, error: `select setting "${key}" needs a non-empty options list` };
      }
      if (typeof dflt !== 'string' || !options.includes(dflt)) {
        return { ok: false, error: `select setting "${key}" default must be one of its options` };
      }
    } else {
      if (options !== undefined) {
        return { ok: false, error: `setting "${key}" has options but is not a select` };
      }
      const wanted = type === 'text' || type === 'multiline' ? 'string' : type;
      if (typeof dflt !== wanted || (type === 'number' && !Number.isFinite(dflt))) {
        return { ok: false, error: `setting "${key}" default must be a ${wanted}` };
      }
    }
    seen.add(key);
    snapshots.push({ key, label, type, default: dflt, options, description });
  }
  return { ok: true, settings: snapshots };
}

export function registerPluginDefinition(
  def: PluginDefinition,
): { ok: true } | { ok: false; error: string } {
  if (!makeApi) return { ok: false, error: 'plugin system not initialized' };
  if (!def || typeof def !== 'object') return { ok: false, error: 'bad definition' };
  if (typeof def.id !== 'string' || !def.id) return { ok: false, error: 'missing plugin id' };
  if (!PLUGIN_ID_RE.test(def.id)) return { ok: false, error: `invalid plugin id "${def.id}"` };
  if (typeof def.name !== 'string' || !def.name) return { ok: false, error: 'missing plugin name' };
  if (def.apiVersion !== PLUGIN_API_VERSION) {
    return {
      ok: false,
      error: `unsupported apiVersion ${String(def.apiVersion)} (this CardMirror supports ${PLUGIN_API_VERSION})`,
    };
  }
  // Ids this plugin already owns — so a re-registration (e.g. re-enable
  // re-runs the bundle) doesn't trip the global command-collision check
  // against its own previously-registered commands.
  const ownIds = new Set(
    [...commands.entries()].filter(([, e]) => e.pluginId === def.id).map(([id]) => id),
  );
  const raw = def.commands;
  const cmds = Array.isArray(raw) ? [...raw] : null;
  if (!cmds) return { ok: false, error: 'commands must be an array' };
  const seen = new Set<string>();
  const snapshots: PluginCommandDef[] = [];
  const prefix = `${def.id}.`;
  for (const c of cmds) {
    // Read every field exactly once — a stateful getter must not be able
    // to pass validation with one value and register a different one.
    const { id, label, keywords, defaultKey, run } = c;
    if (typeof id !== 'string' || !id.startsWith(prefix) || id.length === prefix.length) {
      return { ok: false, error: `command id "${String(id)}" must start with "${prefix}"` };
    }
    if (typeof label !== 'string' || !label) {
      return { ok: false, error: `command "${id}" has no label` };
    }
    if (typeof run !== 'function') {
      return { ok: false, error: `command "${id}" has no run function` };
    }
    if (keywords !== undefined && !isStringArray(keywords)) {
      return { ok: false, error: `command "${id}" has invalid keywords` };
    }
    if (
      defaultKey !== undefined &&
      defaultKey !== null &&
      typeof defaultKey !== 'string' &&
      !isStringArray(defaultKey)
    ) {
      return { ok: false, error: `command "${id}" has invalid defaultKey` };
    }
    if ((commands.has(id) && !ownIds.has(id)) || seen.has(id)) {
      return { ok: false, error: `command id "${id}" already registered` };
    }
    seen.add(id);
    snapshots.push({ id, label, keywords, defaultKey, run });
  }
  const settingsRes = validateSettings(def);
  if (!settingsRes.ok) return settingsRes;
  if (plugins.has(def.id)) {
    // Already registered: an identical command-id list is a silent no-op
    // success (the re-enable path); any difference still rejects. The
    // settings snapshots ARE refreshed — the dev load-from-file loop
    // re-runs a bundle whose declared settings may have changed even
    // when its command ids haven't.
    const same = seen.size === ownIds.size && [...seen].every((id) => ownIds.has(id));
    if (same) {
      plugins.get(def.id)!.settings = settingsRes.settings;
      return { ok: true };
    }
    return { ok: false, error: `plugin "${def.id}" already registered` };
  }
  const api = makeApi(def.id);
  plugins.set(def.id, { def, api, settings: settingsRes.settings });
  for (const c of snapshots) commands.set(c.id, { pluginId: def.id, cmd: c });
  return { ok: true };
}

/** Declared settings of a registered plugin — [] when it declared none
 *  or isn't registered (never loaded this session, or unregistered). */
export function pluginSettingsDefs(pluginId: string): readonly PluginSettingDef[] {
  return plugins.get(pluginId)?.settings ?? [];
}

/** Fired after any registration OR unregistration changes the command
 *  set — the host rebuilds live keymaps (views bake their keymaps at
 *  construction, and both plugin load and uninstall happen after). */
let commandsChangedHook: ((pluginId: string) => void) | null = null;

function fireCommandsChanged(pluginId: string): void {
  try {
    commandsChangedHook?.(pluginId);
  } catch (err) {
    console.error('[plugins] onCommandsChanged hook failed:', err);
  }
}

/** Remove a plugin's registration and every command it owns — the
 *  UNINSTALL half of the lifecycle, so its palette rows, keybinding
 *  rows, and hotkeys vanish immediately instead of lingering until
 *  restart. (Already-executed bundle code can't be unloaded; with its
 *  commands gone it is inert until the next launch.) Returns the
 *  removed command ids so the caller can purge their key overrides. */
export function unregisterPlugin(pluginId: string): string[] {
  const removed: string[] = [];
  for (const [id, entry] of [...commands.entries()]) {
    if (entry.pluginId === pluginId) {
      commands.delete(id);
      removed.push(id);
    }
  }
  const had = plugins.delete(pluginId);
  if (had || removed.length > 0) {
    console.log(`[plugins] unregistered ${pluginId} (${removed.length} commands)`);
    fireCommandsChanged(pluginId);
  }
  return removed;
}

/** Install the window global. `createApi` mints one capability object
 *  per plugin id (dependency-injected so tests can stub it).
 *  `opts.onCommandsChanged` fires after each successful registration
 *  AND after every unregistration — the host uses it to rebuild live
 *  keymaps, since every editor view built before the change baked its
 *  keymap without it (initPlugins runs async after boot, so on a cold
 *  launch that is EVERY open view — without the rebuild new defaultKeys
 *  stay dead, and uninstalled ones stay live, until an unrelated
 *  reconfigure). */
export function installPluginRegistry(
  createApi: (pluginId: string) => CardMirrorPluginApi,
  opts: { onCommandsChanged?: (pluginId: string) => void } = {},
): void {
  makeApi = createApi;
  commandsChangedHook = opts.onCommandsChanged ?? null;
  window.__registerCardMirrorPlugin = (def) => {
    const res = registerPluginDefinition(def);
    if (res.ok) {
      const count = [...commands.values()].filter((c) => c.pluginId === def.id).length;
      console.log(`[plugins] registered ${def.id} (${count} commands)`);
      fireCommandsChanged(String(def.id));
    } else {
      console.warn(`[plugins] registration rejected: ${res.error}`);
      showToast(`Plugin failed to load: ${res.error}`);
    }
  };
}

export function pluginCommandIds(): string[] {
  return [...commands.keys()];
}
export function isPluginCommandId(id: string): boolean {
  return commands.has(id);
}
export function pluginCommandLabel(id: string): string | null {
  return commands.get(id)?.cmd.label ?? null;
}
export function pluginCommandKeywords(id: string): readonly string[] {
  return commands.get(id)?.cmd.keywords ?? [];
}
export function pluginDefaultKey(id: string): string | string[] | null {
  return commands.get(id)?.cmd.defaultKey ?? null;
}

/** Run a plugin command by id. Never throws: sync and async failures
 *  both log and toast with the plugin's name. */
export function runPluginCommand(id: string): boolean {
  const entry = commands.get(id);
  if (!entry) return false;
  const plugin = plugins.get(entry.pluginId);
  if (!plugin) return false;
  const report = (err: unknown): void => {
    console.error(`[plugins] ${id} failed:`, err);
    const message = err instanceof Error ? err.message : String(err);
    showToast(`${plugin.def.name}: command failed — ${message}`);
  };
  try {
    const r = entry.cmd.run(plugin.api);
    if (r && typeof (r as Promise<void>).catch === 'function') {
      void (r as Promise<void>).catch(report);
    }
  } catch (err) {
    report(err);
  }
  return true;
}

export function registeredPlugins(): { id: string; name: string }[] {
  return [...plugins.values()].map((p) => ({ id: p.def.id, name: p.def.name }));
}

export function resetPluginRegistryForTests(): void {
  plugins.clear();
  commands.clear();
  makeApi = null;
  commandsChangedHook = null;
  if (typeof window !== 'undefined') delete window.__registerCardMirrorPlugin;
}
