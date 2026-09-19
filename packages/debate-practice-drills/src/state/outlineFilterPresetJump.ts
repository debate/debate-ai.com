/**
 * @fileoverview Pure "which round (if any) should applying a saved Outline
 * filter preset jump to" decision — the part of closing
 * `packages/debate-help-docs/content/docs/features/argument-tree-outline.mdx`'s
 * "applying a preset only sets the round's filter; it doesn't select or
 * scroll to a particular round" Known gap that doesn't touch the DOM.
 * `ArgumentTreePanel` uses this to decide whether (and to which round's
 * card) to `scrollIntoView` when a preset is applied from its global "Saved
 * filter presets" list; the actual scroll stays in the component, which
 * this package's tests don't otherwise render (see `useOutlineFilterPresets`
 * — only its pure `storage`-event predicate is unit-tested, for the same
 * reason).
 *
 * @module state/outlineFilterPresetJump
 */

import type { OutlineFilterPreset } from "debate-round/src/state/outlineFilterPresets";

/**
 * The round a preset should jump to when applied from the panel's global
 * preset list, or `null` when there's nothing to jump to: the preset
 * predates `roundId` tracking, or its origin round's outline has since been
 * cleared.
 */
export function resolvePresetJumpRoundId(
  preset: Pick<OutlineFilterPreset, "roundId">,
  existingRoundIds: readonly string[],
): string | null {
  if (!preset.roundId) return null;
  return existingRoundIds.includes(preset.roundId) ? preset.roundId : null;
}
