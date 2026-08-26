/**
 * Platform detection. True on macOS / iOS. Used by the keymap layer to pick
 * the platform's primary modifier (Meta/Cmd on Mac, Ctrl elsewhere).
 */
export function isMacPlatform(): boolean {
    if (typeof navigator === "undefined") return false;
    const p = navigator.platform || navigator.userAgent || "";
    return /Mac|iPhone|iPad|iPod/i.test(p);
}
