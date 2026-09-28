/**
 * Voice feedback surface: a floating card showing listening state, the
 * mode as a labeled badge (command / dictation / asleep), the armed pen,
 * the last thing heard, and a live input meter; earcons for every state
 * change; a session menu (mic picker, calibrate, reset position, stop).
 *
 * The card floats freely: drag it by its header anywhere in the window
 * and the spot is remembered (localStorage, per machine) — it used to
 * be a pill pinned to the bottom-right corner, where it sat on top of
 * the cloud chip. With no remembered spot it starts at the right edge,
 * clear of the corner chips. Styled in the dropzone pill's visual
 * language (style.css under "Voice card").
 */
import { settings } from '../settings.js';
import type { VoiceLevel, VoiceMode } from './types';

const POSITION_KEY = 'pmd-voice-card-pos';

interface CardPosition {
  left: number;
  top: number;
}

function readPosition(): CardPosition | null {
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<CardPosition>;
    return typeof p.left === 'number' && typeof p.top === 'number' ? { left: p.left, top: p.top } : null;
  } catch {
    return null;
  }
}

function writePosition(pos: CardPosition | null): void {
  try {
    if (pos) localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
    else localStorage.removeItem(POSITION_KEY);
  } catch {
    /* storage unavailable: the spot lasts this session only */
  }
}

/** Keep the whole card on screen (a remembered spot from a bigger
 *  window, or a resize mid-session). */
function clampPosition(pos: CardPosition, el: HTMLElement): CardPosition {
  const w = el.offsetWidth || 168;
  const h = el.offsetHeight || 120;
  const maxLeft = Math.max(0, window.innerWidth - w);
  const maxTop = Math.max(0, window.innerHeight - h);
  return { left: Math.min(maxLeft, Math.max(0, pos.left)), top: Math.min(maxTop, Math.max(0, pos.top)) };
}

export class VoicePill {
  private el: HTMLElement;
  private echoEl: HTMLElement;
  private meterFill: HTMLElement;
  private audio: AudioContext | null = null;
  private menu: HTMLElement | null = null;
  private dismissMenu: (() => void) | null = null;
  private penEl: HTMLElement;
  private modeEl: HTMLElement;
  private handle: HTMLElement;
  private position: CardPosition | null = null;
  private onResize: () => void;

  constructor(private hooks: { onStop?: () => void; onCalibrate?: () => void } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'pmd-voice-pill pmd-voice-card';
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', 'Voice control session');
    // Header: drag handle carrying the mode dot, the mode badge, and the
    // menu button. Dragging anywhere on it (but the button) moves the card.
    this.handle = document.createElement('div');
    this.handle.className = 'pmd-voice-card-handle';
    this.handle.title = 'Drag to move';
    const dot = document.createElement('span');
    dot.className = 'pmd-voice-dot';
    dot.setAttribute('aria-hidden', 'true');
    this.modeEl = document.createElement('span');
    this.modeEl.className = 'pmd-voice-mode-badge';
    this.modeEl.setAttribute('aria-live', 'polite');
    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'pmd-voice-card-menu-btn';
    menuBtn.textContent = '⋯';
    menuBtn.title = 'Voice session menu';
    menuBtn.setAttribute('aria-label', 'Voice session menu');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMenu();
    });
    this.handle.append(dot, this.modeEl, menuBtn);
    // Body: the armed pen and the last thing heard, several lines deep.
    const body = document.createElement('div');
    body.className = 'pmd-voice-card-body';
    this.penEl = document.createElement('span');
    this.penEl.className = 'pmd-voice-pen';
    this.echoEl = document.createElement('span');
    this.echoEl.className = 'pmd-voice-echo';
    this.echoEl.setAttribute('aria-live', 'polite');
    body.append(this.penEl, this.echoEl);
    const meter = document.createElement('span');
    meter.className = 'pmd-voice-meter';
    meter.setAttribute('aria-hidden', 'true');
    this.meterFill = document.createElement('div');
    meter.appendChild(this.meterFill);
    this.el.append(this.handle, body, meter);
    this.installDrag(menuBtn);
    document.body.appendChild(this.el);
    this.position = readPosition();
    this.applyPosition();
    this.onResize = () => {
      if (this.position) {
        this.position = clampPosition(this.position, this.el);
        this.applyPosition();
      }
    };
    window.addEventListener('resize', this.onResize);
  }

  /** Where the card sits: a remembered spot as fixed left/top, else the
   *  stylesheet's default corner (right edge, above the corner chips). */
  private applyPosition(): void {
    if (this.position) {
      this.el.style.left = `${this.position.left}px`;
      this.el.style.top = `${this.position.top}px`;
      this.el.style.right = 'auto';
      this.el.style.bottom = 'auto';
    } else {
      this.el.style.left = '';
      this.el.style.top = '';
      this.el.style.right = '';
      this.el.style.bottom = '';
    }
  }

  /** Forget the remembered spot and go back to the default corner. */
  resetPosition(): void {
    this.position = null;
    writePosition(null);
    this.applyPosition();
  }

  private installDrag(exclude: HTMLElement): void {
    let drag: { startX: number; startY: number; originLeft: number; originTop: number; moved: boolean } | null = null;
    const onMove = (e: PointerEvent): void => {
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      drag.moved = true;
      this.position = clampPosition({ left: drag.originLeft + dx, top: drag.originTop + dy }, this.el);
      this.applyPosition();
    };
    const onUp = (): void => {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      this.el.classList.remove('pmd-voice-card-dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (moved && this.position) writePosition(this.position);
    };
    this.handle.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button !== 0 || exclude.contains(e.target as Node)) return;
      const rect = this.el.getBoundingClientRect();
      drag = { startX: e.clientX, startY: e.clientY, originLeft: rect.left, originTop: rect.top, moved: false };
      this.el.classList.add('pmd-voice-card-dragging');
      e.preventDefault();
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });
  }

  private toggleMenu(): void {
    if (this.menu) {
      this.closeMenu();
      return;
    }
    const menu = document.createElement('div');
    menu.className = 'pmd-voice-menu';
    menu.setAttribute('role', 'group');
    menu.setAttribute('aria-label', 'Voice session: microphone, calibration, stop');

    const title = document.createElement('div');
    title.className = 'pmd-voice-menu-title';
    title.textContent = 'Microphone';
    menu.appendChild(title);

    const current = settings.get('voiceInputDeviceId');
    const group = `pmd-voice-mic-${Math.random().toString(36).slice(2, 8)}`;
    const addDevice = (value: string, label: string): void => {
      const row = document.createElement('label');
      row.className = 'pmd-voice-menu-row';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = group;
      input.checked = value === current;
      input.addEventListener('change', () => {
        if (input.checked) settings.set('voiceInputDeviceId', value);
      });
      const text = document.createElement('span');
      text.textContent = label;
      row.append(input, text);
      menu.appendChild(row);
    };
    const actions = document.createElement('div');
    actions.className = 'pmd-voice-menu-actions';
    if (this.hooks.onCalibrate) {
      const cal = document.createElement('button');
      cal.type = 'button';
      cal.className = 'pmd-voice-menu-stop pmd-voice-menu-calibrate';
      cal.textContent = 'Calibrate to my voice…';
      cal.addEventListener('click', () => {
        this.closeMenu();
        this.hooks.onCalibrate?.();
      });
      actions.appendChild(cal);
    }
    if (this.position) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'pmd-voice-menu-stop pmd-voice-menu-reset';
      reset.textContent = 'Reset card position';
      reset.addEventListener('click', () => {
        this.closeMenu();
        this.resetPosition();
      });
      actions.appendChild(reset);
    }
    const stop = document.createElement('button');
    stop.type = 'button';
    stop.className = 'pmd-voice-menu-stop';
    stop.textContent = 'Stop voice control';
    stop.addEventListener('click', () => {
      this.closeMenu();
      this.hooks.onStop?.();
    });
    actions.appendChild(stop);

    addDevice('', 'System default');
    menu.appendChild(actions);
    if (navigator.mediaDevices?.enumerateDevices) {
      void navigator.mediaDevices.enumerateDevices().then((devices) => {
        if (this.menu !== menu) return;
        let n = 0;
        for (const d of devices) {
          if (d.kind !== 'audioinput' || d.deviceId === 'default') continue;
          n += 1;
          addDevice(d.deviceId, d.label || `Microphone ${n}`);
        }
        menu.appendChild(actions); // keep the actions last
      });
    }

    document.body.appendChild(menu);
    this.menu = menu;
    this.placeMenu(menu);
    const onDown = (e: MouseEvent): void => {
      if (!menu.contains(e.target as Node) && !this.el.contains(e.target as Node)) this.closeMenu();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') this.closeMenu();
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    this.dismissMenu = () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }

  /** The menu hangs off the card: above it when there is room, below
   *  otherwise, right edges aligned, and never off screen. */
  private placeMenu(menu: HTMLElement): void {
    const card = this.el.getBoundingClientRect();
    const mw = menu.offsetWidth || 220;
    const mh = menu.offsetHeight || 160;
    const left = Math.max(4, Math.min(window.innerWidth - mw - 4, card.right - mw));
    menu.style.left = `${left}px`;
    menu.style.overflowY = 'auto';
    // Above the card, anchored by the menu's BOTTOM edge: the microphone
    // list arrives after this runs, and a bottom anchor makes that growth
    // go upward, away from the card, instead of down over it.
    if (card.top - mh - 6 >= 4 || card.top > window.innerHeight / 2) {
      menu.style.top = 'auto';
      menu.style.bottom = `${Math.max(4, window.innerHeight - card.top + 6)}px`;
      menu.style.maxHeight = `${Math.max(120, card.top - 10)}px`;
    } else {
      menu.style.bottom = 'auto';
      menu.style.top = `${card.bottom + 6}px`;
      menu.style.maxHeight = `${Math.max(120, window.innerHeight - card.bottom - 10)}px`;
    }
  }

  private closeMenu(): void {
    this.dismissMenu?.();
    this.dismissMenu = null;
    this.menu?.remove();
    this.menu = null;
  }

  setListening(on: boolean): void {
    this.el.classList.toggle('pmd-voice-on', on);
    if (!on) {
      this.setEcho('', true);
      this.closeMenu();
    }
  }

  setMode(mode: VoiceMode): void {
    this.el.classList.remove('pmd-voice-mode-command', 'pmd-voice-mode-dictation', 'pmd-voice-mode-asleep');
    this.el.classList.add(`pmd-voice-mode-${mode}`);
    this.modeEl.textContent = mode === 'dictation' ? 'dictating' : mode;
    const hint = mode === 'asleep' ? 'say "wake" to resume' : mode === 'dictation' ? 'release the key to land it' : '';
    this.setEcho(hint, true);
  }

  /** Sticky-pen badge (null = no pen armed). */
  setPen(name: string | null): void {
    this.penEl.textContent = name ? `pen: ${name}` : '';
    this.penEl.hidden = !name;
  }

  setEcho(text: string, ok: boolean): void {
    this.echoEl.textContent = text;
    this.echoEl.classList.toggle('pmd-voice-rejected', !ok);
  }

  setAutoSleepCountdown(remainingMs: number | null): void {
    this.el.classList.toggle('pmd-voice-drowsy', remainingMs !== null);
    this.el.style.setProperty('--voice-drowsy', remainingMs === null ? '1' : String(Math.max(0.35, remainingMs / 10000)));
  }

  setLevel(level: VoiceLevel): void {
    // s16 RMS: quiet room ~100–300, speech at a close mic ~2000–8000.
    const pct = Math.min(100, Math.round((level.rms / 6000) * 100));
    this.meterFill.style.width = `${pct}%`;
    this.el.classList.toggle('pmd-voice-speech', level.speech);
  }

  private beep(freq: number, ms: number, type: OscillatorType = 'sine', delayMs = 0): void {
    this.audio ??= new AudioContext();
    const t0 = this.audio.currentTime + delayMs / 1000;
    const osc = this.audio.createOscillator();
    const gain = this.audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.04, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + ms / 1000);
    osc.connect(gain).connect(this.audio.destination);
    osc.start(t0);
    osc.stop(t0 + ms / 1000);
  }

  earconAccept(): void {
    this.beep(880, 70);
  }

  earconReject(): void {
    this.beep(220, 130, 'square');
  }

  earconMode(to: VoiceMode): void {
    if (to === 'asleep') {
      this.beep(520, 80);
      this.beep(330, 110, 'sine', 90);
    } else if (to === 'dictation') {
      this.beep(440, 60);
    } else {
      this.beep(330, 80);
      this.beep(660, 90, 'sine', 90);
    }
  }

  destroy(): void {
    this.closeMenu();
    window.removeEventListener('resize', this.onResize);
    this.el.remove();
    void this.audio?.close();
  }
}
