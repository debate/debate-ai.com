/**
 * Reserved chords - browser/OS shortcuts that must be intercepted at the
 * capture phase so they never reach the browser's shortcut handler.
 *
 * The capture-phase listener in useKeymap calls preventDefault() for any
 * chord in this set, guaranteeing the app's keybindings win.
 *
 * Platform-conditional: on macOS the browser reserves Meta chords;
 * on Windows/Linux it reserves Ctrl chords.
 */

import { isMacPlatform } from "../platform";

/**
 * The base set of keys that, when combined with the platform's primary
 * modifier (Meta on Mac, Ctrl elsewhere), are reserved by the browser/OS.
 * Derived from the chords FLAT_KEYMAP actually binds.
 */
const RESERVED_KEYS = [
    // -- Window ---------------------------------------------------------------
    "n", // new window (also suppresses the browser's new window)
    // -- Flow files ----------------------------------------------------------
    "s", // save (suppresses browser save-page)
    "S", // save as (Shift encoded in uppercase key)
    // -- Sheets ------------------------------------------------------------
    "a", // new aff sheet
    "r", // rename
    "p", // search palette (also suppresses browser print)
    "P", // command palette (Shift encoded in uppercase key)
    // -- Edit ----------------------------------------------------------------
    "z", // undo (Ctrl+z / Meta+z)
    // -- Format ----------------------------------------------------------------
    "b", // toggle bold
    "H", // toggle highlight (Shift encoded in uppercase key)
    "t", // toggle card
    "g", // toggle group (suppresses browser find-next)
    "k", // toggle kicked (suppresses the browser's address-bar search)
    // -- UI ---------------------------------------------------------------------
    "\\", // sidebar toggle
    ",", // settings
    "j", // rfd toggle
    // -- Rows / cells -------------------------------------------------------
    "Backspace", // row delete
    "o", // insert cell (suppresses browser open-file)
    "O", // insert row (Shift encoded in uppercase key)
    "M", // move cells (suppresses the browser profile switcher)
    // -- Sheet navigation --------------------------------------------------
    "[", // previous sheet (suppresses the browser's history back)
    "]", // next sheet (suppresses the browser's history forward)
    // Move sheet up / down. Chrome reserves Cmd+Shift+[ and Cmd+Shift+] for
    // tab switching at the browser level and never delivers them to the page,
    // so preventDefault cannot reclaim them there; the web build loses these
    // two chords and reaches the commands through the palette instead. The
    // desktop shell's WKWebView does deliver them, which is what these
    // entries are for.
    "{",
    "}",
    // -- Cursor jumps --------------------------------------------------------
    // Cmd+Left and Cmd+Right are the browser's history back and forward, so
    // a rebind onto either would leave the flow on the web build; the grid's
    // own Excel-style jump lives on them by default. Their vertical pair
    // needs no entry: nothing in the browser answers Cmd+Up or Cmd+Down, and
    // a chord the grid handles is a chord the app already won. In a text box
    // all four stay native caret movement - see intercept.ts.
    "ArrowLeft",
    "ArrowRight",
    // -- Sheet jumps -----------------------------------------------------------
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
] as const;

/**
 * Chords to intercept at the capture phase. On Mac these are Meta+key;
 * on Windows/Linux they are Ctrl+key. Includes Meta/Ctrl+Shift+Z (redo),
 * whose shift rides in the uppercase key per the eventToChord rule.
 */
export function reservedChords(): Set<string> {
    const mod = isMacPlatform() ? "Meta" : "Ctrl";
    const chords = new Set<string>();

    for (const key of RESERVED_KEYS) {
        chords.add(`${mod}+${key}`);
    }
    chords.add(`${mod}+Z`);

    return chords;
}
