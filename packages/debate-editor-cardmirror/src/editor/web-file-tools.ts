/**
 * Web single-file document tools (Clean / Convert / Compress) — the browser
 * counterpart to the desktop folder-recursive modals. The web edition can't walk
 * a directory, so each tool takes ONE file: pick it, run the transform behind a
 * progress modal, then let the user Save the result.
 *
 * Two-phase modal:
 *  1. Working — a compositor-driven `transform: rotate` spinner that keeps
 *     turning even while the CPU-bound transform (Clean especially) blocks the
 *     main thread. We let the modal paint (two rAFs) before starting the work.
 *  2. Ready — a Save button. Saving MUST be initiated from a user gesture:
 *     `showSaveFilePicker` throws otherwise, and the picker runs long after the
 *     original click's transient activation has expired. The Save button click
 *     is that fresh gesture.
 */

import { getHost } from './host/index.js';
import { alertDialog } from './text-prompt.js';
import { showToast } from './toast.js';
import type { FileFilter } from './host/types.js';

export interface WebFileToolResult {
  bytes: Uint8Array;
  /** Suggested output filename for the Save picker. */
  outputName: string;
  filter: FileFilter;
  /** Extra line shown on the "ready to save" step (e.g. a size reduction). */
  resultNote?: string;
}

export interface WebFileTool {
  /** Human label for error messages, e.g. "Clean". */
  label: string;
  /** Present-participle shown while working, e.g. "Cleaning". */
  verb: string;
  /** Accepted input extensions. */
  accept: RegExp;
  /** Message shown when the picked file doesn't match `accept`. */
  acceptMsg: string;
  /** Transform the picked bytes into the output + its save metadata. */
  run: (bytes: Uint8Array, name: string) => Promise<WebFileToolResult>;
}

/** Run a single-file web tool end to end: pick → validate → transform (behind a
 *  progress modal) → user clicks Save (fresh gesture) → Save-As → toast. */
export async function runWebFileTool(tool: WebFileTool): Promise<void> {
  const host = getHost();
  const input = await host.openFile().catch((err: unknown) => {
    void alertDialog(`Couldn't open the file: ${err instanceof Error ? err.message : err}`);
    return null;
  });
  if (!input) return;
  if (!tool.accept.test(input.name)) {
    void alertDialog(tool.acceptMsg);
    return;
  }
  const modal = createToolModal(`${tool.verb} “${input.name}”…`);
  let result: WebFileToolResult;
  try {
    // Let the modal actually paint before the main-thread-blocking transform.
    await nextPaint();
    result = await tool.run(input.bytes, input.name);
  } catch (err) {
    modal.close();
    void alertDialog(`${tool.label} failed: ${err instanceof Error ? err.message : err}`);
    return;
  }
  modal.toReady({
    heading: `Ready to save “${result.outputName}”.`,
    note: result.resultNote,
    // Runs from the Save button's click — the gesture showSaveFilePicker needs.
    onSave: async () => {
      let saved: Awaited<ReturnType<typeof host.saveAs>>;
      try {
        saved = await host.saveAs(result.outputName, result.bytes, {
          filters: [result.filter],
        });
      } catch (err) {
        console.warn('saveAs failed:', err);
        void alertDialog(`Save failed: ${err instanceof Error ? err.message : err}`);
        return; // keep the modal open so they can retry
      }
      if (!saved) return; // user cancelled the OS picker — leave the modal up
      modal.close();
      showToast(`Saved “${saved.name}”.`);
    },
  });
}

/** Two rAFs ≈ one committed paint, so the modal is on screen before we block. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function createToolModal(workingText: string): {
  close: () => void;
  toReady: (opts: {
    heading: string;
    note?: string;
    onSave: () => void | Promise<void>;
  }) => void;
} {
  const overlay = document.createElement('div');
  overlay.className = 'pmd-route-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'pmd-route-dialog pmd-file-tool-progress';
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  const close = (): void => overlay.remove();

  // Phase 1 — working.
  const spinner = document.createElement('div');
  spinner.className = 'pmd-file-tool-spinner';
  spinner.setAttribute('aria-hidden', 'true');
  const workLabel = document.createElement('div');
  workLabel.className = 'pmd-file-tool-progress-label';
  workLabel.setAttribute('role', 'status');
  workLabel.textContent = workingText;
  dialog.append(spinner, workLabel);

  const toReady = (opts: {
    heading: string;
    note?: string;
    onSave: () => void | Promise<void>;
  }): void => {
    dialog.replaceChildren();
    const heading = document.createElement('div');
    heading.className = 'pmd-file-tool-progress-label';
    heading.textContent = opts.heading;
    dialog.appendChild(heading);
    if (opts.note) {
      const note = document.createElement('div');
      note.className = 'pmd-file-tool-note';
      note.textContent = opts.note;
      dialog.appendChild(note);
    }
    const buttons = document.createElement('div');
    buttons.className = 'pmd-file-tool-buttons';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'pmd-file-tool-btn pmd-file-tool-btn-primary';
    saveBtn.textContent = 'Save…';
    saveBtn.addEventListener('click', () => void opts.onSave());
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'pmd-file-tool-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', close);
    buttons.append(saveBtn, cancelBtn);
    dialog.appendChild(buttons);
    // Escape cancels once we're on the Save step (nothing is mid-flight).
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
    saveBtn.focus();
  };

  return { close, toReady };
}
