/**
 * Mobile settings page (SPEC-mobile-view.md).
 *
 * A second renderer over the SAME `SETTING_METADATA` the desktop
 * dialog uses — entries opt in via the `mobile: true` flag, so there
 * is no parallel settings list to drift. One full-screen scrolling
 * page with section headers (the flagged set is small enough that
 * iOS-style subpages would just add taps); touch-height rows; the
 * same `settings.set()` calls underneath, so persistence and
 * cross-tab sync come free.
 *
 * Renderers cover the kinds the flagged entries actually use:
 * toggle, text, password, number, theme / reduceMotion / saveFormat /
 * mobileLayout (segments), displaySizes + displayTypography (steppers /
 * toggles), readers (rows). Flag a new kind → add its renderer here.
 */

import { confirmDialog } from './text-prompt.js';
import {
  settings,
  SETTING_METADATA,
  evalDependsOn,
  type SettingMeta,
  type Settings,
  type SettingsCategory,
  type ReaderConfig,
  type DisplaySizes,
  type DisplayTypography,
} from './settings.js';

const CATEGORY_LABELS: Partial<Record<SettingsCategory, string>> = {
  general: 'General',
  appearance: 'Appearance',
  accessibility: 'Accessibility',
  editing: 'Editing',
  shortcuts: 'Shortcuts',
  'comments-ai': 'AI',
};

let pageEl: HTMLElement | null = null;
/** Settings subscriptions made by the open page — torn down on
 *  close so reopening doesn't accumulate dead callbacks. */
let pageUnsubs: Array<() => void> = [];

/** Subscribe for the lifetime of the open page. */
function pageSubscribe(fn: () => void): void {
  pageUnsubs.push(settings.subscribe(fn));
}

export function openMobileSettings(): void {
  if (pageEl) return;
  const page = document.createElement('div');
  page.className = 'pmd-mobile-settings';
  pageEl = page;

  const bar = document.createElement('header');
  bar.className = 'pmd-msettings-bar';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'pmd-msettings-back';
  back.textContent = '‹ Back';
  back.addEventListener('click', closeMobileSettings);
  bar.appendChild(back);
  const title = document.createElement('span');
  title.className = 'pmd-msettings-title';
  title.textContent = 'Settings';
  bar.appendChild(title);
  page.appendChild(bar);

  const list = document.createElement('div');
  list.className = 'pmd-msettings-list';
  page.appendChild(list);

  const byCategory = new Map<SettingsCategory, SettingMeta[]>();
  for (const meta of SETTING_METADATA) {
    if (!meta.mobile) continue;
    if (meta.electronOnly) continue;
    const bucket = byCategory.get(meta.category) ?? [];
    bucket.push(meta);
    byCategory.set(meta.category, bucket);
  }
  for (const [category, entries] of byCategory) {
    const header = document.createElement('h2');
    header.className = 'pmd-msettings-section';
    header.textContent = CATEGORY_LABELS[category] ?? category;
    list.appendChild(header);
    for (const meta of entries) {
      list.appendChild(buildRow(meta));
    }
  }

  document.body.appendChild(page);
}

export function closeMobileSettings(): void {
  pageEl?.remove();
  pageEl = null;
  for (const unsub of pageUnsubs) unsub();
  pageUnsubs = [];
}

/** Kinds whose editor is a multi-row block (readers list, per-style
 *  steppers/toggles). These stack the control BELOW the label +
 *  description instead of squeezing it into a right-hand column, so the
 *  description doesn't pile up on a narrow screen. */
const BLOCK_EDITOR_KINDS = new Set<SettingMeta['kind']>([
  'readers',
  'displaySizes',
  'displayTypography',
]);

function buildRow(meta: SettingMeta): HTMLElement {
  const row = document.createElement('div');
  row.className = 'pmd-msettings-row';
  if (BLOCK_EDITOR_KINDS.has(meta.kind)) row.classList.add('pmd-msettings-row-block');

  const text = document.createElement('div');
  text.className = 'pmd-msettings-rowtext';
  const label = document.createElement('span');
  label.className = 'pmd-msettings-label';
  label.textContent = meta.label;
  text.appendChild(label);
  const descText = meta.descriptionFn ? meta.descriptionFn() : meta.description;
  if (descText) {
    const desc = document.createElement('span');
    desc.className = 'pmd-msettings-desc';
    desc.textContent = descText;
    text.appendChild(desc);
  }
  row.appendChild(text);
  row.appendChild(buildEditor(meta));

  // dependsOn greying, live (e.g. API-key row follows the AI toggle).
  if (meta.dependsOn) {
    const sync = (): void => {
      row.classList.toggle('pmd-msettings-disabled', !evalDependsOn(meta.dependsOn));
    };
    sync();
    pageSubscribe(sync);
  }
  return row;
}

function buildEditor(meta: SettingMeta): HTMLElement {
  switch (meta.kind) {
    case 'toggle':
      return buildToggle(meta.key);
    case 'text':
    case 'password':
      return buildTextField(meta.key, meta.kind === 'password');
    case 'number':
      return buildNumberField(meta.key);
    case 'theme':
      return buildSegment(meta.key, ['light', 'dark', 'system']);
    case 'reduceMotion':
      return buildSegment(meta.key, ['system', 'on', 'off']);
    case 'saveFormat':
      return buildSegment(meta.key, ['cmir', 'docx'], { cmir: '.cmir', docx: '.docx' });
    case 'aiProvider':
      return buildSegment(meta.key, ['anthropic', 'openrouter'], {
        anthropic: 'Anthropic',
        openrouter: 'OpenRouter',
      });
    case 'mobileLayout':
      return buildMobileLayoutSegment();
    case 'displaySizes':
      return buildDisplaySizeSteppers();
    case 'displayTypography':
      return buildDisplayTypographyEditor();
    case 'readers':
      return buildReadersEditor();
    case 'clod':
      // Desktop adds a separate "Customize Clod" button; on mobile the
      // on/off toggle (plain "Thinking…" vs Clod activities in the
      // AI progress pill) is the part that matters.
      return buildToggle(meta.key);
    default: {
      // A flagged kind without a renderer is a build-time oversight —
      // make it visible instead of silently rendering nothing.
      const missing = document.createElement('span');
      missing.className = 'pmd-msettings-desc';
      missing.textContent = 'Adjust this one on desktop.';
      return missing;
    }
  }
}

function buildToggle(key: keyof Settings): HTMLElement {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'pmd-msettings-switch';
  input.checked = !!settings.get(key);
  input.addEventListener('change', () => {
    settings.set(key as 'aiFeaturesEnabled', input.checked as never);
  });
  pageSubscribe(() => {
    const cur = !!settings.get(key);
    if (input.checked !== cur) input.checked = cur;
  });
  return input;
}

function buildTextField(key: keyof Settings, secret: boolean): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pmd-msettings-textwrap';
  const input = document.createElement('input');
  input.type = secret ? 'password' : 'text';
  input.className = 'pmd-msettings-text';
  input.value = String(settings.get(key) ?? '');
  input.autocapitalize = 'off';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.addEventListener('change', () => {
    settings.set(key as 'anthropicApiKey', input.value.trim() as never);
  });
  wrap.appendChild(input);
  if (secret) {
    const reveal = document.createElement('button');
    reveal.type = 'button';
    reveal.className = 'pmd-msettings-reveal';
    reveal.textContent = '👁';
    reveal.setAttribute('aria-label', 'Show / hide');
    reveal.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
    });
    wrap.appendChild(reveal);
  }
  return wrap;
}

function buildNumberField(key: keyof Settings): HTMLElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'pmd-msettings-number';
  input.value = String(settings.get(key) ?? 0);
  input.addEventListener('change', () => {
    const n = Number(input.value);
    if (Number.isFinite(n)) settings.set(key as 'defaultZoomPct', n as never);
  });
  return input;
}

function buildSegment<K extends keyof Settings>(
  key: K,
  values: ReadonlyArray<Settings[K] & string>,
  labels?: Partial<Record<string, string>>,
): HTMLElement {
  const group = document.createElement('div');
  group.className = 'pmd-msheet-segment';
  for (const v of values) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = labels?.[v] ?? v[0]!.toUpperCase() + v.slice(1);
    const sync = (): void => {
      btn.classList.toggle('pmd-mode-active', settings.get(key) === v);
    };
    sync();
    pageSubscribe(sync);
    btn.addEventListener('click', () => settings.set(key, v));
    group.appendChild(btn);
  }
  return group;
}

/** Layout segment with the reload the shell decision needs. */
function buildMobileLayoutSegment(): HTMLElement {
  const group = buildSegment('mobileLayout', ['auto', 'mobile', 'desktop']);
  group.addEventListener('click', (e) => {
    if (!(e.target instanceof HTMLButtonElement)) return;
    void confirmDialog('Reload now to apply the layout change?', { okLabel: 'Reload' }).then(
      (go) => {
        if (go) window.location.reload();
      },
    );
  });
  return group;
}

function buildDisplaySizeSteppers(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pmd-msettings-steppers';
  const sizes = settings.get('displaySizes');
  for (const name of Object.keys(sizes) as Array<keyof DisplaySizes>) {
    const row = document.createElement('div');
    row.className = 'pmd-msettings-stepper';
    const label = document.createElement('span');
    label.textContent = name;
    row.appendChild(label);
    const value = document.createElement('span');
    value.className = 'pmd-msettings-stepper-value';
    const sync = (): void => {
      value.textContent = `${settings.get('displaySizes')[name]} pt`;
    };
    sync();
    pageSubscribe(sync);
    const step = (delta: number): void => {
      const cur = settings.get('displaySizes');
      const next = Math.max(5, Math.min(72, cur[name] + delta));
      settings.set('displaySizes', { ...cur, [name]: next });
    };
    const minus = document.createElement('button');
    minus.type = 'button';
    minus.textContent = '−';
    minus.addEventListener('click', () => step(-1));
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.textContent = '+';
    plus.addEventListener('click', () => step(1));
    row.appendChild(minus);
    row.appendChild(value);
    row.appendChild(plus);
    wrap.appendChild(row);
  }
  return wrap;
}

/** Per-style typography flags (bold/italic/underline/box) + the emphasis
 *  box thickness — the mobile counterpart of the desktop "Style
 *  typography" editor. Reuses the stepper row layout for a consistent
 *  look. */
function buildDisplayTypographyEditor(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pmd-msettings-steppers';

  const flags: Array<[keyof DisplayTypography, string]> = [
    ['citeUnderlined', 'Cite: underlined'],
    ['underlineBold', 'Underline: bold'],
    ['undertagItalic', 'Undertag: italic'],
    ['undertagBold', 'Undertag: bold'],
    ['emphasisBold', 'Emphasis: bold'],
    ['emphasisItalic', 'Emphasis: italic'],
    ['emphasisBox', 'Emphasis: boxed'],
  ];
  for (const [key, labelText] of flags) {
    const row = document.createElement('div');
    row.className = 'pmd-msettings-stepper';
    const label = document.createElement('span');
    label.textContent = labelText;
    row.appendChild(label);
    const sw = document.createElement('input');
    sw.type = 'checkbox';
    sw.className = 'pmd-msettings-switch';
    const sync = (): void => {
      sw.checked = !!settings.get('displayTypography')[key];
    };
    sync();
    pageSubscribe(sync);
    sw.addEventListener('change', () => {
      settings.set('displayTypography', {
        ...settings.get('displayTypography'),
        [key]: sw.checked,
      });
    });
    row.appendChild(sw);
    wrap.appendChild(row);
  }

  // Emphasis box thickness (pt) — a stepper like the size steppers,
  // matching the desktop editor's 0.25–12 pt range / 0.25 step.
  const trow = document.createElement('div');
  trow.className = 'pmd-msettings-stepper';
  const tlabel = document.createElement('span');
  tlabel.textContent = 'Emphasis box thickness';
  trow.appendChild(tlabel);
  const tval = document.createElement('span');
  tval.className = 'pmd-msettings-stepper-value';
  const tsync = (): void => {
    tval.textContent = `${settings.get('displayTypography').emphasisBoxSize} pt`;
  };
  tsync();
  pageSubscribe(tsync);
  const tstep = (delta: number): void => {
    const cur = settings.get('displayTypography');
    const next = Math.max(0.25, Math.min(12, Math.round((cur.emphasisBoxSize + delta) * 4) / 4));
    settings.set('displayTypography', { ...cur, emphasisBoxSize: next });
  };
  const minus = document.createElement('button');
  minus.type = 'button';
  minus.textContent = '−';
  minus.addEventListener('click', () => tstep(-0.25));
  const plus = document.createElement('button');
  plus.type = 'button';
  plus.textContent = '+';
  plus.addEventListener('click', () => tstep(0.25));
  trow.appendChild(minus);
  trow.appendChild(tval);
  trow.appendChild(plus);
  wrap.appendChild(trow);

  return wrap;
}

function buildReadersEditor(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pmd-msettings-readers';
  const render = (): void => {
    wrap.textContent = '';
    const readers = settings.get('readers');
    readers.forEach((r: ReaderConfig, i: number) => {
      const row = document.createElement('div');
      row.className = 'pmd-msettings-reader-row';
      const name = document.createElement('input');
      name.type = 'text';
      name.value = r.name;
      name.addEventListener('change', () => {
        const next = settings.get('readers').slice();
        next[i] = { ...next[i]!, name: name.value };
        settings.set('readers', next);
      });
      const wpm = document.createElement('input');
      wpm.type = 'number';
      wpm.value = String(r.wpm);
      wpm.addEventListener('change', () => {
        const n = Number(wpm.value);
        if (!Number.isFinite(n) || n <= 0) return;
        const next = settings.get('readers').slice();
        next[i] = { ...next[i]!, wpm: Math.round(n) };
        settings.set('readers', next);
      });
      // Optional second rate for tags/analytics/cites — blank = the
      // main rate covers everything (parity with the desktop editor).
      const tagWpm = document.createElement('input');
      tagWpm.type = 'number';
      tagWpm.value = r.tagWpm != null ? String(r.tagWpm) : '';
      tagWpm.placeholder = 'same';
      tagWpm.setAttribute('aria-label', `${r.name} tags/cites words per minute`);
      tagWpm.addEventListener('change', () => {
        const trimmed = tagWpm.value.trim();
        const n = Number(trimmed);
        const next = settings.get('readers').slice();
        if (trimmed === '') {
          const { tagWpm: _drop, ...rest } = next[i]!;
          next[i] = rest;
        } else if (!Number.isFinite(n) || n <= 0) {
          tagWpm.value = r.tagWpm != null ? String(r.tagWpm) : '';
          return;
        } else {
          next[i] = { ...next[i]!, tagWpm: Math.round(n) };
        }
        settings.set('readers', next);
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = '✕';
      del.setAttribute('aria-label', `Remove ${r.name}`);
      del.addEventListener('click', () => {
        const next = settings.get('readers').slice();
        next.splice(i, 1);
        settings.set('readers', next);
        render();
      });
      row.appendChild(name);
      row.appendChild(wpm);
      row.appendChild(tagWpm);
      row.appendChild(del);
      wrap.appendChild(row);
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'pmd-msettings-reader-add';
    add.textContent = '+ Add reader';
    add.addEventListener('click', () => {
      settings.set('readers', [...settings.get('readers'), { name: 'Reader', wpm: 250 }]);
      render();
    });
    wrap.appendChild(add);
  };
  render();
  return wrap;
}
