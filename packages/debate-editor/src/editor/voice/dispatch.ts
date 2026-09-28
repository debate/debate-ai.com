/**
 * Voice command dispatch (voice v2, spec §3): every verb routes through
 * the EXISTING command layer (getRibbonCommand — the same code paths as
 * the F-keys and ribbon), never raw mark application, so context
 * resolution and docx round-trip identity are inherited.
 *
 * The mouse supplies the span. A mark word with a selection marks it;
 * with no selection it arms the sticky pen for the next dictation (or
 * disarms it when it is already armed). Structure words act on the
 * selection or the cursor's paragraph.
 */
import { TextSelection } from 'prosemirror-state';
import type { Transaction } from 'prosemirror-state';
import type { Node as PMNode, ResolvedPos, Schema } from 'prosemirror-model';
import { undo as historyUndo } from 'prosemirror-history';
import { newHeadingId } from '../../schema/index.js';
import { deleteSelectionKeepingLeadingCursor } from '../boundary-cursor-keymap.js';
import { getRibbonCommand, type RibbonContext, type RibbonCommandId } from '../ribbon-commands.js';
import { enterAsKey } from '../enter-style.js';
import type { EditorView } from 'prosemirror-view';
import { patchVoiceState, sealUtterance, voiceDispatcher, voicePluginKey, type ViewLike } from './plugin.js';
import type { PenName, VoiceEvent } from './types';

export interface VoiceUi {
  /** Echo the parse (accepted or not) in the pill. */
  echo(text: string, ok: boolean): void;
  /** Guidance ("select something first") — softer than a rejection. */
  hint(text: string): void;
}

export interface DispatchDeps {
  ribbonCtx: RibbonContext;
  ui: VoiceUi;
  /** Undo through the editor's own undo path (collab-aware). Falls back
   *  to prosemirror-history when absent (tests). */
  undo?: () => boolean;
  /** Start a held dictation programmatically — `replace` deletes the
   *  selection and hands the next dictation the space. Optional. */
}

/** Mark names each pen can have produced. */
export const PEN_MARK_NAMES: Record<PenName, string[]> = {
  underline: ['underline_mark', 'underline_direct'],
  highlight: ['highlight'],
  emphasis: ['emphasis_mark'],
};

export const PEN_COMMAND: Record<PenName, RibbonCommandId> = {
  underline: 'applyUnderline',
  highlight: 'applyHighlight',
  emphasis: 'applyEmphasis',
};

const MARK_VERBS: Record<string, PenName> = { line: 'underline', box: 'emphasis', glow: 'highlight' };

/** A fresh empty card with a real (non-null) tag id. Exported for tests. */
export function newCardNode(schema: Schema): PMNode | null {
  const cardType = schema.nodes['card'];
  const tagType = schema.nodes['tag'];
  if (!cardType || !tagType) return null;
  return cardType.createAndFill(null, tagType.create({ id: newHeadingId() }));
}

function enclosing($pos: ResolvedPos, typeNames: string[]): { pos: number; node: PMNode } | null {
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (typeNames.includes(node.type.name)) return { pos: $pos.before(d), node };
  }
  return null;
}

function runRibbon(view: ViewLike, deps: DispatchDeps, id: RibbonCommandId, dispatch: (tr: Transaction) => void): boolean {
  return getRibbonCommand(id, deps.ribbonCtx)(view.state, dispatch);
}

/** Apply `pen` to the selection through the ribbon command. */
export function applyPen(view: ViewLike, deps: DispatchDeps, pen: PenName, dispatch: (tr: Transaction) => void): boolean {
  return runRibbon(view, deps, PEN_COMMAND[pen], dispatch);
}

/** Remove every pen's marks from the selection. */
function clearMarks(view: ViewLike, dispatch: (tr: Transaction) => void): boolean {
  const { from, to } = view.state.selection;
  const tr = view.state.tr;
  let any = false;
  for (const names of Object.values(PEN_MARK_NAMES)) {
    for (const nm of names) {
      const mt = view.state.schema.marks[nm];
      if (mt && view.state.doc.rangeHasMark(from, to, mt)) {
        tr.removeMark(from, to, mt);
        any = true;
      }
    }
  }
  if (any) dispatch(tr);
  return any;
}

/**
 * Apply one command-kind VoiceEvent. All transactions go through the
 * utterance dispatcher (atomicity) and the utterance is sealed before
 * returning.
 */
export async function applyVoiceCommand(
  view: ViewLike,
  event: Extract<VoiceEvent, { kind: 'command' }>,
  deps: DispatchDeps,
): Promise<void> {
  const dispatch = voiceDispatcher(view, event.utteranceId);
  const st = voicePluginKey.getState(view.state);
  const sel = view.state.selection;
  const { verb } = event;
  let ok = true;
  let echoText = event.raw;

  const markVerb = MARK_VERBS[verb];
  if (markVerb) {
    if (!sel.empty) {
      ok = applyPen(view, deps, markVerb, dispatch);
    } else {
      // No span: arm / disarm the sticky pen for the next dictation.
      const armed = st?.pen === markVerb ? null : markVerb;
      patchVoiceState(view, { pen: armed });
      echoText = armed ? `${event.raw} — pen armed` : `${event.raw} — pen off`;
    }
  } else {
    switch (verb) {
      case 'bare':
        if (!sel.empty) ok = clearMarks(view, dispatch);
        else patchVoiceState(view, { pen: null });
        break;
      case 'shrink':
        ok = runRibbon(view, deps, 'shrink', dispatch);
        break;
      case 'condense':
        ok = runRibbon(view, deps, 'condenseDefault', dispatch);
        break;
      case 'chunk':
        ok = runRibbon(view, deps, 'selectCurrentHeading', dispatch);
        break;
      case 'ship':
        ok = runRibbon(view, deps, 'sendToSpeechAtEnd', dispatch);
        break;
      case 'tag':
        ok = runRibbon(view, deps, 'setTag', dispatch);
        break;
      case 'cite':
        ok = runRibbon(view, deps, 'applyCite', dispatch);
        break;
      case 'card': {
        const filled = newCardNode(view.state.schema);
        if (!filled) {
          ok = false;
          break;
        }
        const after = enclosing(sel.$from, ['card', 'analytic_unit']);
        const insertAt = after ? after.pos + after.node.nodeSize : sel.$from.after(1);
        const tr = view.state.tr.insert(insertAt, filled);
        tr.setSelection(TextSelection.create(tr.doc, insertAt + 2)).scrollIntoView();
        dispatch(tr);
        break;
      }
      case 'return':
        // Enter, the way the key does it (styled paragraphs after headings
        // and all). A live EditorView goes through when there is one; the
        // handlers only need state + dispatch otherwise.
        ok = enterAsKey(view.state, dispatch, 'dom' in view ? (view as unknown as EditorView) : undefined);
        break;
      case 'undo':
        ok = deps.undo ? deps.undo() : historyUndo(view.state, view.dispatch.bind(view));
        break;
      case 'delete':
        if (sel.empty) {
          deps.ui.hint('select something to delete first');
          ok = false;
        } else {
          dispatch(deleteSelectionKeepingLeadingCursor(view.state));
        }
        break;
      default:
        ok = false;
        echoText = `(unknown) ${event.raw}`;
    }
  }

  sealUtterance(view);
  deps.ui.echo(echoText, ok);
  patchVoiceState(view, {
    appendLog: { utteranceId: event.utteranceId, kind: 'command', text: event.raw },
  });
}
