/**
 * The Plugins settings tab body: install-from-GitHub field, installed
 * plugin rows (enable / update / uninstall), and the developer
 * load-from-file row. All operations go through the desktop host;
 * off Electron this panel never mounts (category is electronOnly).
 */
import { getElectronHost } from './host/index.js';
import { setIcon } from './icons';
import { pluginSettingsDefs, unregisterPlugin } from './plugin-registry.js';
import { openPluginSettingsModal } from './plugin-settings-modal.js';
import { isPluginEnabled, setPluginEnabled } from './plugins-store.js';
import { settings } from './settings.js';
import { confirmDialog } from './text-prompt.js';
import { showToast } from './toast.js';

interface InstalledPlugin {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  repo?: string;
  /** Set when the install needs a newer CardMirror (the required
   *  version). Listed disabled rather than hidden — an invisible
   *  install looks like data loss and can't be uninstalled. */
  incompatible?: string;
}

/** Surface an IPC rejection as a toast instead of an unhandled rejection. */
function guarded(work: () => Promise<void>): void {
  void work().catch((err: unknown) => {
    showToast(`Plugin operation failed: ${err instanceof Error ? err.message : String(err)}`);
  });
}

/** Panel-level status text — same treatment as an empty settings tab. */
function placeholder(container: HTMLElement, text: string): void {
  const p = document.createElement('p');
  p.className = 'pmd-settings-empty';
  p.textContent = text;
  container.append(p);
}

/** A settings-style section header, matching the rest of the dialog. */
function sectionTitle(text: string): HTMLElement {
  const h = document.createElement('h3');
  h.className = 'pmd-settings-section-title';
  h.textContent = text;
  return h;
}

export function renderPluginsPanel(container: HTMLElement): void {
  const host = getElectronHost();
  if (!host) {
    placeholder(container, 'Plugins are available on the desktop app only.');
    return;
  }
  // The panel's install / dev-load actions execute third-party bundles
  // (webFrame.executeJavaScript), so they must be unreachable while the
  // master switch that promises to gate plugins is off.
  if (!settings.get('pluginsEnabled')) {
    placeholder(container, 'Enable plugins above, then restart CardMirror.');
    return;
  }
  // Switch is on but boot ran with it off — the window registry was never
  // installed, so a loaded bundle's registration would silently no-op.
  if (typeof window.__registerCardMirrorPlugin !== 'function') {
    placeholder(container, 'Restart CardMirror to activate plugins.');
    return;
  }

  const installRow = document.createElement('div');
  installRow.className = 'pmd-plugins-install';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'pmd-settings-text pmd-plugins-input';
  input.placeholder = 'GitHub URL or owner/repo';
  const installBtn = document.createElement('button');
  installBtn.type = 'button';
  installBtn.className = 'pmd-install-info-btn';
  installBtn.textContent = 'Install';
  installRow.append(input, installBtn);

  // Install/update/uninstall failures surface here, next to the action,
  // not as a transient toast that scrolls away. Cleared on the next
  // successful action.
  const errorEl = document.createElement('p');
  errorEl.className = 'pmd-plugins-error';
  const showError = (msg: string): void => {
    errorEl.textContent = msg;
  };
  const clearError = (): void => {
    errorEl.textContent = '';
  };
  /** Like `guarded`, but routes the rejection inline instead of a toast. */
  const guardedInline = (work: () => Promise<void>): void => {
    void work().catch((err: unknown) => {
      showError(`Plugin operation failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  };

  const list = document.createElement('div');
  list.className = 'pmd-plugins-list';

  const devRow = document.createElement('div');
  devRow.className = 'pmd-plugins-dev';
  const devDesc = document.createElement('p');
  devDesc.className = 'pmd-settings-row-desc';
  devDesc.textContent = 'Load an unpackaged plugin bundle for this session only.';
  const devBtn = document.createElement('button');
  devBtn.type = 'button';
  devBtn.className = 'pmd-install-info-btn';
  devBtn.textContent = 'Load plugin from file…';
  devRow.append(devDesc, devBtn);

  container.append(
    sectionTitle('Install a plugin'),
    installRow,
    errorEl,
    sectionTitle('Installed plugins'),
    list,
    sectionTitle('Developer'),
    devRow,
  );

  async function refresh(): Promise<void> {
    const plugins = ((await host!.pluginList()) as InstalledPlugin[]) ?? [];
    list.textContent = '';
    if (plugins.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'pmd-settings-empty';
      empty.textContent = 'No plugins installed.';
      list.append(empty);
      return;
    }
    for (const p of plugins) {
      const row = document.createElement('div');
      row.className = 'pmd-plugins-row';
      const label = document.createElement('span');
      label.className = 'pmd-plugins-name';
      label.textContent = `${p.name} v${p.version}${p.author ? ` — ${p.author}` : ''}`;
      if (p.incompatible) {
        // Listed but inert: main refuses to serve its bundle, so the
        // toggle would lie. The row stays so the user can see it and
        // uninstall it (hidden reads as data loss).
        label.textContent += ` — needs CardMirror ${p.incompatible} or newer`;
        row.classList.add('pmd-plugins-row-incompatible');
      }
      const enable = document.createElement('input');
      enable.type = 'checkbox';
      enable.className = 'pmd-settings-toggle';
      enable.setAttribute('aria-label', `Enable ${p.name}`);
      enable.checked = !p.incompatible && isPluginEnabled(p.id);
      enable.disabled = !!p.incompatible;
      enable.addEventListener('change', () => {
        setPluginEnabled(p.id, enable.checked);
        if (enable.checked) {
          guardedInline(async () => {
            clearError();
            const r = await host!.pluginLoad(p.id);
            if (!r.ok) showError(`${p.name} failed to load: ${r.error ?? 'unknown error'}`);
            // Re-render so the gear appears once the just-registered
            // plugin's declared settings are known.
            guarded(refresh);
          });
        } else {
          showToast('Plugin disabled. It stops fully on the next launch.');
          guarded(refresh);
        }
      });
      const update = document.createElement('button');
      update.type = 'button';
      update.className = 'pmd-install-info-btn';
      update.textContent = 'Check for updates';
      update.addEventListener('click', () => {
        guardedInline(async () => {
          clearError();
          const res = (await host!.pluginCheckUpdate(p.id, p.repo ?? '')) as
            | { ok: true; latest: string; hasUpdate: boolean }
            | { ok: false; error: string }
            | undefined;
          if (!res || !res.ok) {
            showError(`Update check failed: ${res && 'error' in res ? res.error : 'unavailable'}`);
            return;
          }
          if (!res.hasUpdate) {
            showToast(`${p.name} is up to date.`);
            return;
          }
          if (await confirmDialog(`Update ${p.name} to v${res.latest}?`)) {
            // Same-repo reinstall of an already-consented plugin: the update
            // confirm above IS the consent, so inspect rolls straight into
            // commit. Nothing touches the existing install unless commit runs.
            const ins = (await host!.pluginInstallInspect(p.repo ?? '')) as
              | { ok: true; pending: string }
              | { ok: false; error: string }
              | undefined;
            if (!ins?.ok) {
              showError(`Update failed: ${ins && 'error' in ins ? ins.error : 'unavailable'}`);
              return;
            }
            const r = (await host!.pluginInstallCommit(ins.pending)) as
              | { ok: true }
              | { ok: false; error: string }
              | undefined;
            if (r?.ok) showToast(`${p.name} updated. Restart to apply.`);
            else showError(`Update failed: ${r && 'error' in r ? r.error : 'unavailable'}`);
          }
        });
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'pmd-install-info-btn';
      remove.textContent = 'Uninstall';
      remove.addEventListener('click', () => {
        guardedInline(async () => {
          if (!(await confirmDialog(`Uninstall ${p.name}?`))) return;
          clearError();
          await host!.pluginUninstall(p.id);
          setPluginEnabled(p.id, false);
          // Drop the plugin's storage bag so a reinstall starts clean.
          localStorage.removeItem(`plugin:${p.id}`);
          // Deregister NOW: palette rows, keybinding rows, and hotkeys
          // vanish immediately (the onCommandsChanged hook rebuilds live
          // keymaps) instead of lingering until restart. Already-executed
          // bundle code can't be unloaded — inert until the next launch.
          const removedCmds = unregisterPlugin(p.id);
          // Purge the user's key overrides for this plugin's commands —
          // both the just-unregistered ids and (prefix match) any from a
          // session where it never loaded. Without this they'd sit in
          // settings forever.
          const overrides = settings.get('ribbonKeyOverrides');
          const kept: typeof overrides = {};
          let dropped = 0;
          for (const [cmdId, key] of Object.entries(overrides)) {
            if (removedCmds.includes(cmdId) || cmdId.startsWith(`${p.id}.`)) {
              dropped++;
              continue;
            }
            if (key !== undefined) kept[cmdId] = key;
          }
          if (dropped > 0) settings.set('ribbonKeyOverrides', kept);
          // Same for custom ribbon buttons bound to this plugin's commands —
          // an unconfigured button disappears rather than sitting dead.
          const customButtons = settings.get('ribbonCustomButtons');
          const keptButtons = customButtons.filter((b) => !b.command.startsWith(`${p.id}.`));
          if (keptButtons.length !== customButtons.length) {
            settings.set('ribbonCustomButtons', keptButtons);
          }
          showToast(
            removedCmds.length > 0
              ? `${p.name} uninstalled. Its background code stops on the next launch.`
              : `${p.name} uninstalled.`,
          );
          guarded(refresh);
        });
      });
      row.append(enable, label);
      // Gear → the plugin's own settings modal. Only when the plugin is
      // enabled AND its registration declared settings — a disabled
      // plugin's bundle never ran, so its settings defs are unknown (and
      // the modal would have nothing trustworthy to render).
      if (!p.incompatible && isPluginEnabled(p.id) && pluginSettingsDefs(p.id).length > 0) {
        const gear = document.createElement('button');
        gear.type = 'button';
        gear.className = 'pmd-plugins-gear';
        gear.title = `${p.name} settings`;
        setIcon(gear, 'settings', { label: `${p.name} settings` });
        gear.addEventListener('click', () => {
          openPluginSettingsModal(p.id, p.name);
        });
        row.append(gear);
      }
      row.append(update, remove);
      list.append(row);
    }
  }

  installBtn.addEventListener('click', () => {
    guardedInline(async () => {
      const ref = input.value.trim();
      if (!ref) return;
      clearError();
      installBtn.disabled = true;
      try {
        // Two-phase: inspect stages the release main-side (no disk writes),
        // then the consent dialog runs on its facts — including the ACTUAL
        // owner/repo, which the manifest can't spoof — and only consent
        // commits. Declining discards the staged files, so a declined
        // REINSTALL leaves the existing working version untouched (the old
        // install-then-ask flow deleted it).
        const res = (await host.pluginInstallInspect(ref)) as
          | { ok: true; pending: string; plugin: InstalledPlugin; ownerRepo: string }
          | { ok: false; error: string }
          | undefined;
        if (!res || !res.ok) {
          showError(`Install failed: ${res && 'error' in res ? res.error : 'unavailable'}`);
          return;
        }
        const p = res.plugin;
        const consent = await confirmDialog(
          `Install ${p.name} v${p.version} by ${p.author ?? 'an unknown author'} ` +
            `from github.com/${res.ownerRepo}? ` +
            'This plugin runs with full access to CardMirror and your documents.',
        );
        if (!consent) {
          await host.pluginInstallDiscard(res.pending);
          return;
        }
        const committed = (await host.pluginInstallCommit(res.pending)) as
          | { ok: true }
          | { ok: false; error: string }
          | undefined;
        if (!committed?.ok) {
          showError(
            `Install failed: ${committed && 'error' in committed ? committed.error : 'unavailable'}`,
          );
          return;
        }
        setPluginEnabled(p.id, true);
        const r = await host.pluginLoad(p.id);
        showToast(r.ok ? `${p.name} installed and loaded.` : `${p.name} installed; loads on next launch.`);
        input.value = '';
        guarded(refresh);
      } finally {
        installBtn.disabled = false;
      }
    });
  });

  devBtn.addEventListener('click', () => {
    guarded(async () => {
      const path = await host.pluginPickFile();
      if (!path) return;
      const r = await host.pluginLoadFile(path);
      showToast(r.ok ? 'Plugin bundle loaded for this session.' : `Load failed: ${r.error ?? 'unknown'}`);
    });
  });

  guarded(refresh);
}
