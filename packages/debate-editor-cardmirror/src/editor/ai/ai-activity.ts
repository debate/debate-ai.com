/**
 * AiActivity — one handle for the "AI is working" affordances: the
 * floating "Thinking…" pill AND the purple tint over the range being
 * worked on. Every AI op that mutates a doc range (repair, formatting
 * repair, card cut, highlight-down, cite creation, image alt-text…)
 * should wrap its in-flight window in one of these so the two cues stay
 * in sync and the user can always see what's being worked on.
 *
 *   const act = new AiActivity(view, { from, to });
 *   act.start();
 *   try { …await the model… act.setRange(newRange); … }
 *   finally { act.stop(); }
 */

import type { EditorView } from 'prosemirror-view';
import { ThinkingTooltip, type TooltipRange } from './thinking-tooltip.js';
import { setAiWorking, type AiWorkingScope } from './ai-working-plugin.js';
import { AiWorkingBox } from './ai-working-box.js';

/** Distinct token per activity so concurrent container-scope boxes in the
 *  ai-working plugin don't overwrite each other. */
let activityCounter = 0;

export class AiActivity {
  private readonly tip = new ThinkingTooltip();
  /** Selection scope draws a single bounding box (overlay); container
   *  scope outlines the enclosing card node (PM decoration). */
  private readonly box: AiWorkingBox | null;
  private readonly token = `aiw-${++activityCounter}`;
  private range: TooltipRange;

  /** `scope` controls the purple box: `container` outlines the enclosing
   *  card (card cutting); `selection` draws one box around the exact
   *  worked-on range (cite/text/formatting repair, image), so it isn't
   *  expanded to the whole card. */
  constructor(
    private readonly view: EditorView,
    range: TooltipRange,
    private readonly scope: AiWorkingScope = 'container',
  ) {
    this.range = range;
    this.box = scope === 'selection' ? new AiWorkingBox() : null;
  }

  start(): void {
    if (this.box) this.box.show(this.view, this.range);
    else setAiWorking(this.view, this.token, this.range, this.scope);
    this.tip.show(this.view, this.range);
  }

  /** Re-anchor both cues after positions are re-mapped (e.g. a repair
   *  pass that already edited the doc). */
  setRange(range: TooltipRange): void {
    this.range = range;
    if (this.box) this.box.setRange(range);
    else setAiWorking(this.view, this.token, range, this.scope);
    this.tip.setRange(range);
  }

  /** Name the current pipeline stage in the pill (card cutter). */
  setStage(stage: string | null): void {
    this.tip.setStage(stage);
  }

  stop(): void {
    this.tip.hide();
    if (this.box) this.box.hide();
    else setAiWorking(this.view, this.token, null);
  }
}
