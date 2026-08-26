/**
 * Setting "commands" — the Toggle/Cycle-a-setting actions the command bar
 * generates. Unlike ribbon commands they aren't `RibbonCommandId`s (there are
 * ~50, derived from the settings registry), so they carry a namespaced string
 * id: `toggle:<settingKey>` or `cycle:<settingKey>`. This module is the single
 * place that runs, labels, and enumerates them, shared by the command palette
 * and the custom ribbon buttons.
 */

import {
  settings,
  SETTING_METADATA,
  toggleableSettingMetas,
  cyclableSettings,
  cleanToggleLabel,
  toggleCommandName,
  cycleCommandName,
  nextCycleValue,
  currentCycleLabel,
  CYCLABLE_SETTINGS,
  type Settings,
  type ToggleEnv,
} from './settings.js';
import { getHost, isWindowsHost } from './host/index.js';
import { showToast } from './toast.js';

export const SETTING_TOGGLE_PREFIX = 'toggle:';
export const SETTING_CYCLE_PREFIX = 'cycle:';

function toggleEnv(): ToggleEnv {
  return {
    hostKind: getHost().kind,
    isWindows: isWindowsHost(),
    get: (k) => settings.get(k),
  };
}

/** Flip a boolean setting and toast the new state. */
export function runSettingToggle(key: keyof Settings): void {
  settings.set(key, (settings.get(key) !== true) as never);
  const applied = settings.get(key) === true; // read back — a subscriber may reject
  const label = SETTING_METADATA.find((m) => m.key === key)?.label ?? String(key);
  showToast(`${cleanToggleLabel(label)}: ${applied ? 'On' : 'Off'}`);
}

/** Advance an enum setting to its next value and toast it. */
export function runSettingCycle(key: keyof Settings): void {
  const setting = CYCLABLE_SETTINGS.find((c) => c.key === key);
  if (!setting) return;
  settings.set(key, nextCycleValue(setting, settings.get(key)).value as never);
  const applied = currentCycleLabel(setting, settings.get(key));
  const label = SETTING_METADATA.find((m) => m.key === key)?.label ?? String(key);
  showToast(`${cleanToggleLabel(label)}: ${applied}`);
}

/** Run a setting command by id; returns true if `command` was one (and ran),
 *  false otherwise (so callers can fall through to their ribbon-command path). */
export function runSettingCommand(command: string): boolean {
  if (command.startsWith(SETTING_TOGGLE_PREFIX)) {
    runSettingToggle(command.slice(SETTING_TOGGLE_PREFIX.length) as keyof Settings);
    return true;
  }
  if (command.startsWith(SETTING_CYCLE_PREFIX)) {
    runSettingCycle(command.slice(SETTING_CYCLE_PREFIX.length) as keyof Settings);
    return true;
  }
  return false;
}

/** Display label for a `toggle:`/`cycle:` command, or null if `command` isn't
 *  a setting command or its setting no longer exists. */
export function settingCommandLabel(command: string): string | null {
  const prefixed = (prefix: string, name: (m: (typeof SETTING_METADATA)[number]) => string) => {
    const key = command.slice(prefix.length);
    const meta = SETTING_METADATA.find((m) => String(m.key) === key);
    return meta ? name(meta) : null;
  };
  if (command.startsWith(SETTING_TOGGLE_PREFIX)) return prefixed(SETTING_TOGGLE_PREFIX, toggleCommandName);
  if (command.startsWith(SETTING_CYCLE_PREFIX)) return prefixed(SETTING_CYCLE_PREFIX, cycleCommandName);
  return null;
}

/** All available setting commands (toggle + cycle), as `{ command, label }`,
 *  for a picker. Gated on host + dependency exactly like the command bar. */
export function settingCommandOptions(): { command: string; label: string }[] {
  const env = toggleEnv();
  const out: { command: string; label: string }[] = [];
  for (const m of toggleableSettingMetas(env)) {
    out.push({ command: SETTING_TOGGLE_PREFIX + String(m.key), label: toggleCommandName(m) });
  }
  for (const { meta } of cyclableSettings(env)) {
    out.push({ command: SETTING_CYCLE_PREFIX + String(meta.key), label: cycleCommandName(meta) });
  }
  return out;
}
