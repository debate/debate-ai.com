/**
 * Per-plugin settings modal — opened from the gear on a plugin's row in
 * Settings → Plugins. Renders the controls the plugin declared in its
 * definition's `settings` array (shape enforced at registration, so the
 * rendering here can trust it) and applies every change immediately,
 * matching how the rest of the settings dialog behaves — the Done
 * button just closes. Rides the shared overlay stack so Escape closes
 * this modal alone, not the settings dialog under it.
 */
import { isTopOverlay, popOverlay, pushOverlay } from './overlay-stack.js';
import {
  pluginSettingsDefs,
  type PluginSettingDef,
  type PluginSettingValue,
} from './plugin-registry.js';
import { getPluginSettingValue, setPluginSettingValue } from './plugin-settings.js';
import { captureFocusForDialog } from './text-prompt.js';

/** Live value for a declared def (the registry guarantees the key is
 *  declared here, so the undefined arm never fires in practice). */
function currentValue(pluginId: string, def: PluginSettingDef): PluginSettingValue {
  return getPluginSettingValue(pluginId, def.key) ?? def.default;
}

export function openPluginSettingsModal(pluginId: string, pluginName: string): void {
  const defs = pluginSettingsDefs(pluginId);
  if (defs.length === 0) return;

  const restoreFocus = captureFocusForDialog();
  const overlayToken = pushOverlay();
  const overlay = document.createElement('div');
  overlay.className = 'pmd-route-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'pmd-route-dialog pmd-plugin-settings-dialog';

  const header = document.createElement('div');
  header.className = 'pmd-route-header';
  header.textContent = `${pluginName} settings`;
  dialog.appendChild(header);

  const rows = document.createElement('div');
  rows.className = 'pmd-plugin-settings-rows';
  for (const def of defs) rows.appendChild(buildRow(pluginId, def));
  dialog.appendChild(rows);

  const buttons = document.createElement('div');
  buttons.className = 'pmd-text-prompt-buttons';
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'pmd-text-prompt-ok';
  done.textContent = 'Done';
  buttons.appendChild(done);
  dialog.appendChild(buttons);

  const close = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    popOverlay(overlayToken);
    restoreFocus();
  };
  done.addEventListener('click', close);
  overlay.appendChild(dialog);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && isTopOverlay(overlayToken)) {
      e.preventDefault();
      close();
    }
  };
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  setTimeout(() => {
    const first = rows.querySelector<HTMLElement>('input, select');
    (first ?? done).focus();
  }, 0);
}

function buildRow(pluginId: string, def: PluginSettingDef): HTMLElement {
  const row = document.createElement('div');
  row.className = 'pmd-plugin-settings-row';
  const label = document.createElement('label');
  label.className = 'pmd-plugin-settings-label';
  const title = document.createElement('span');
  title.className = 'pmd-plugin-settings-title';
  title.textContent = def.label;
  label.append(title, buildControl(pluginId, def));
  row.appendChild(label);
  if (def.description) {
    const desc = document.createElement('p');
    desc.className = 'pmd-settings-row-desc';
    desc.textContent = def.description;
    row.appendChild(desc);
  }
  return row;
}

function buildControl(pluginId: string, def: PluginSettingDef): HTMLElement {
  const current = currentValue(pluginId, def);
  switch (def.type) {
    case 'boolean': {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'pmd-settings-toggle';
      input.checked = current === true;
      input.addEventListener('change', () => {
        setPluginSettingValue(pluginId, def.key, input.checked);
      });
      return input;
    }
    case 'text': {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'pmd-settings-text';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.value = String(current);
      input.addEventListener('change', () => {
        setPluginSettingValue(pluginId, def.key, input.value);
      });
      return input;
    }
    case 'number': {
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'pmd-settings-text';
      input.value = String(current);
      input.addEventListener('change', () => {
        const n = Number.parseFloat(input.value);
        if (Number.isFinite(n)) {
          setPluginSettingValue(pluginId, def.key, n);
        } else {
          // Unparseable entry: snap the field back to the live value
          // rather than storing garbage or silently keeping stale text.
          input.value = String(currentValue(pluginId, def));
        }
      });
      return input;
    }
    case 'select': {
      const select = document.createElement('select');
      select.className = 'pmd-settings-text pmd-plugin-settings-select';
      for (const option of def.options ?? []) {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        if (option === current) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        setPluginSettingValue(pluginId, def.key, select.value);
      });
      return select;
    }
  }
}
