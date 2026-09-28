/**
 * Arrange Windows, three-pane edition: which slot the speech doc takes,
 * which slot every other document stacks into, and which slot goes
 * empty. Pure, so the shell's moves and the tests share one plan.
 * The speech doc takes the outer slot on the chosen side, the docs
 * take the middle, and the far slot collapses so the two share the
 * full width by the same percentage the single-doc arrangement uses.
 */
export type ArrangeSide = 'left' | 'right';
export type ArrangeSlotId = 'slot1' | 'slot2' | 'slot3';

export interface SlotPlan {
  speechSlot: ArrangeSlotId;
  docsSlot: ArrangeSlotId;
  emptySlot: ArrangeSlotId;
}

export function slotPlanForSpeech(side: ArrangeSide): SlotPlan {
  return side === 'left'
    ? { speechSlot: 'slot1', docsSlot: 'slot2', emptySlot: 'slot3' }
    : { speechSlot: 'slot3', docsSlot: 'slot2', emptySlot: 'slot1' };
}
