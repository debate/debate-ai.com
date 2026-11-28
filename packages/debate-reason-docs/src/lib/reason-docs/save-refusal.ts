/**
 * What the REASON docs provider does with a save the server refused for good
 * (`DocumentSaveQueue`'s `onRejected`): whether it was a move to undo, and the
 * line the file tree shows under the tree.
 */

import type { SaveRejection } from "./save-queue"

/** True when the refusal dropped a move (`parentId`) — the optimistic
 *  re-parent on screen has to be put back. */
export function isRefusedMove(rejection: SaveRejection): boolean {
  return "parentId" in rejection.patch
}

/** One sentence for the user. The server's own reason (e.g. "A folder can't
 *  be moved into itself.") is used when it sent one. */
export function saveRefusalMessage(rejection: SaveRejection): string {
  const reason = rejection.error?.trim()
  if (isRefusedMove(rejection)) {
    return reason ? `That move wasn't saved: ${withStop(reason)} The file is back where it was.` : "That move wasn't saved, so the file is back where it was."
  }
  if (rejection.status === 404) return "A change wasn't saved because the file no longer exists."
  if (rejection.status === 403) return "A change wasn't saved because the file isn't yours."
  return reason ? `A change wasn't saved: ${withStop(reason)}` : "A change wasn't saved because the server refused it."
}

function withStop(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`
}
