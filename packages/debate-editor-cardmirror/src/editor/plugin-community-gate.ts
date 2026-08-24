/**
 * Community plugin installs — console gate.
 *
 * The GitHub installer only accepts repos on main's curated allowlist
 * (`PLUGIN_INSTALL_ALLOWLIST` in apps/desktop/src/plugin-manager.ts):
 * plugins are FULL-TRUST code, so arbitrary-repo installs stay behind a
 * deliberate, undiscoverable step — `window.__plugins('community-on')`
 * from the console, same pattern as the card-cutter switch. The flag
 * persists as a setting and is re-armed into MAIN each boot; main holds
 * the enforcement, the renderer only requests the unlock. The dev
 * "Load plugin from file…" path is independent of this gate.
 */

import { settings } from './settings.js';
import { getElectronHost } from './host/index.js';

declare global {
  interface Window {
    __plugins?: (cmd: 'community-on' | 'community-off' | 'status') => string;
  }
}

export function installPluginCommunityGate(): void {
  const arm = (): void => {
    void getElectronHost()?.pluginCommunityInstalls(
      settings.get('pluginCommunityInstalls') === true,
    );
  };

  window.__plugins = (cmd) => {
    if (cmd === 'status') {
      return settings.get('pluginCommunityInstalls')
        ? 'community plugin installs: ON'
        : 'community plugin installs: off (curated list only)';
    }
    if (cmd !== 'community-on' && cmd !== 'community-off') {
      return "usage: __plugins('community-on' | 'community-off' | 'status')";
    }
    const on = cmd === 'community-on';
    settings.set('pluginCommunityInstalls', on);
    arm();
    return on
      ? 'community plugin installs ENABLED — the installer now accepts any GitHub repo. ' +
          'Plugins run with full access to CardMirror and your documents; only install sources you trust. ' +
          "Disable with __plugins('community-off')."
      : 'community plugin installs disabled (curated list only).';
  };

  arm();
}
