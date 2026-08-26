/**
 * Copying a value the user is looking at.
 *
 * The webview grants `navigator.clipboard` only inside the task a click
 * started, and refuses it outright often enough that no flow may depend on it.
 * So a write reports whether it landed rather than throwing, and the caller
 * falls back to selecting the text for the Cmd+C the user can always do.
 */

/** Whether the write landed. Never throws. */
export async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

/** Puts a node's text under the caret, so a manual copy takes one chord. */
export function selectNode(node: Node | null): void {
    if (!node) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
}
