/**
 * Command registry - the canonical set of commands the keyboard layer can fire.
 *
 * CommandIds are keymap-agnostic: keymaps bind chords to these ids, and
 * command handlers (commands.ts) implement the behavior. Grid-native gestures
 * (Enter, Tab, Esc, arrows, cell editing) are owned by Handsontable and are
 * not commands; the cheatsheet lists them as fixed keys.
 */

export type CommandId =
    | "window.new"
    | "window.close"
    | "flow.new"
    | "flow.open"
    | "flow.save"
    | "flow.saveAs"
    | "flow.reveal"
    | "flow.close"
    | "edit.undo"
    | "edit.redo"
    | "format.toggleBold"
    | "format.toggleHighlight"
    | "format.toggleCard"
    | "format.toggleGroup"
    | "format.toggleKicked"
    | "row.insertAbove"
    | "row.insertBelow"
    | "row.delete"
    | "cell.insert"
    | "cell.insertBelow"
    | "cell.move"
    | "cell.jumpToSource"
    | "cell.sendToDoc"
    | "sheet.next"
    | "sheet.prev"
    | "sheet.moveUp"
    | "sheet.moveDown"
    | "sheet.extendUp"
    | "sheet.extendDown"
    | "sheet.newAff"
    | "sheet.newNeg"
    | "sheet.rename"
    | "sheet.quickSwitch"
    | "round.swapOrder"
    | "sheet.jump1"
    | "sheet.jump2"
    | "sheet.jump3"
    | "sheet.jump4"
    | "sheet.jump5"
    | "sheet.jump6"
    | "sheet.jump7"
    | "sheet.jump8"
    | "sheet.jump9"
    | "settings.open"
    | "info.open"
    | "rfd.toggle"
    | "help.open"
    | "sidebar.toggle"
    | "view.zoomIn"
    | "view.zoomOut"
    | "split.toggle"
    | "split.focusLeft"
    | "split.focusRight"
    | "palette.open"
    | "theme.light"
    | "theme.dark"
    | "theme.system"
    | "collab.share"
    | "collab.shareView"
    | "collab.join"
    | "collab.invite"
    | "collab.inviteView"
    | "collab.end";

export interface CommandDef {
    id: CommandId;
    label: string;
    /**
     * Extra search terms for the palette, ranked below every label match.
     * For a command a debater knows by its mark rather than its name.
     */
    keywords?: string;
}

export const COMMANDS: Record<CommandId, CommandDef> = {
    "window.new": { id: "window.new", label: "New window" },
    "window.close": { id: "window.close", label: "Close window" },
    "flow.new": { id: "flow.new", label: "New flow" },
    "flow.open": { id: "flow.open", label: "Open flow" },
    "flow.save": { id: "flow.save", label: "Save flow" },
    "flow.saveAs": { id: "flow.saveAs", label: "Save flow as" },
    "flow.reveal": { id: "flow.reveal", label: "Show flow in file manager" },
    "flow.close": { id: "flow.close", label: "Close flow" },
    "edit.undo": { id: "edit.undo", label: "Undo" },
    "edit.redo": { id: "edit.redo", label: "Redo" },
    "format.toggleBold": { id: "format.toggleBold", label: "Toggle bold" },
    "format.toggleHighlight": {
        id: "format.toggleHighlight",
        label: "Toggle highlight",
    },
    "format.toggleCard": { id: "format.toggleCard", label: "Toggle card" },
    "format.toggleGroup": { id: "format.toggleGroup", label: "Toggle group" },
    "format.toggleKicked": {
        id: "format.toggleKicked",
        label: "Toggle kicked",
        keywords: "strikethrough cross out dead slash",
    },
    "row.insertAbove": { id: "row.insertAbove", label: "Insert row above" },
    "row.insertBelow": { id: "row.insertBelow", label: "Insert row below" },
    "row.delete": { id: "row.delete", label: "Delete row" },
    "cell.insert": { id: "cell.insert", label: "Insert cell" },
    "cell.insertBelow": { id: "cell.insertBelow", label: "Insert cell below" },
    "cell.move": { id: "cell.move", label: "Move cells" },
    "cell.jumpToSource": {
        id: "cell.jumpToSource",
        label: "Jump to source in CardMirror",
    },
    "cell.sendToDoc": { id: "cell.sendToDoc", label: "Send to CardMirror" },
    "sheet.next": { id: "sheet.next", label: "Next sheet" },
    "sheet.prev": { id: "sheet.prev", label: "Previous sheet" },
    "sheet.moveUp": { id: "sheet.moveUp", label: "Move sheet up" },
    "sheet.moveDown": { id: "sheet.moveDown", label: "Move sheet down" },
    "sheet.extendUp": {
        id: "sheet.extendUp",
        label: "Extend selection up",
        keywords: "select range sheets multiple",
    },
    "sheet.extendDown": {
        id: "sheet.extendDown",
        label: "Extend selection down",
        keywords: "select range sheets multiple",
    },
    "sheet.newAff": { id: "sheet.newAff", label: "New aff sheet" },
    "sheet.newNeg": { id: "sheet.newNeg", label: "New neg sheet" },
    "sheet.rename": { id: "sheet.rename", label: "Rename active sheet" },
    "sheet.quickSwitch": {
        id: "sheet.quickSwitch",
        label: "Search cells",
    },
    "round.swapOrder": { id: "round.swapOrder", label: "Swap speaking order" },
    "sheet.jump1": { id: "sheet.jump1", label: "Jump to sheet 1" },
    "sheet.jump2": { id: "sheet.jump2", label: "Jump to sheet 2" },
    "sheet.jump3": { id: "sheet.jump3", label: "Jump to sheet 3" },
    "sheet.jump4": { id: "sheet.jump4", label: "Jump to sheet 4" },
    "sheet.jump5": { id: "sheet.jump5", label: "Jump to sheet 5" },
    "sheet.jump6": { id: "sheet.jump6", label: "Jump to sheet 6" },
    "sheet.jump7": { id: "sheet.jump7", label: "Jump to sheet 7" },
    "sheet.jump8": { id: "sheet.jump8", label: "Jump to sheet 8" },
    "sheet.jump9": { id: "sheet.jump9", label: "Jump to sheet 9" },
    "settings.open": { id: "settings.open", label: "Open settings" },
    "info.open": { id: "info.open", label: "Open round info" },
    "rfd.toggle": { id: "rfd.toggle", label: "Toggle RFD" },
    "help.open": { id: "help.open", label: "Keyboard shortcuts" },
    "sidebar.toggle": { id: "sidebar.toggle", label: "Toggle sidebar" },
    "view.zoomIn": { id: "view.zoomIn", label: "Zoom in" },
    "view.zoomOut": { id: "view.zoomOut", label: "Zoom out" },
    "split.toggle": { id: "split.toggle", label: "Toggle split view" },
    "split.focusLeft": { id: "split.focusLeft", label: "Focus left pane" },
    "split.focusRight": { id: "split.focusRight", label: "Focus right pane" },
    "palette.open": { id: "palette.open", label: "Command palette" },
    "theme.light": { id: "theme.light", label: "Theme: Light" },
    "theme.dark": { id: "theme.dark", label: "Theme: Dark" },
    "theme.system": { id: "theme.system", label: "Theme: System" },
    "collab.share": { id: "collab.share", label: "Generate a code to edit" },
    "collab.shareView": { id: "collab.shareView", label: "Generate a code to view" },
    "collab.join": { id: "collab.join", label: "Join with a code" },
    "collab.invite": { id: "collab.invite", label: "Invite a saved partner to edit" },
    "collab.inviteView": { id: "collab.inviteView", label: "Invite a saved partner to view" },
    "collab.end": { id: "collab.end", label: "End shared session" },
};

/** The commands the CardMirror integration owns; dead when it is switched off. */
export const CARDMIRROR_COMMANDS: readonly CommandId[] = ["cell.jumpToSource", "cell.sendToDoc"];

/** The commands shared editing owns; dead while the master switch is off. */
export const COLLAB_COMMANDS: readonly CommandId[] = [
    "collab.share",
    "collab.shareView",
    "collab.join",
    "collab.invite",
    "collab.inviteView",
    "collab.end",
];

/**
 * Whether a command changes the round, which is the one thing a viewer may not
 * do. Exhaustive over `CommandId` on purpose: a new command has to say which
 * it is, so read-only cannot quietly spring a leak the next time one is added.
 *
 * Saving is not editing. A viewer's file is a real `.ebb` on their own disk and
 * writing it out is theirs to do; what they may not do is change the round the
 * host is holding.
 */
export const EDITS_ROUND: Record<CommandId, boolean> = {
    "window.new": false,
    "window.close": false,
    "flow.new": false,
    "flow.open": false,
    "flow.save": false,
    "flow.saveAs": false,
    "flow.reveal": false,
    "flow.close": false,
    "edit.undo": true,
    "edit.redo": true,
    "format.toggleBold": true,
    "format.toggleHighlight": true,
    "format.toggleCard": true,
    "format.toggleGroup": true,
    "format.toggleKicked": true,
    "row.insertAbove": true,
    "row.insertBelow": true,
    "row.delete": true,
    "cell.insert": true,
    "cell.insertBelow": true,
    "cell.move": true,
    "cell.jumpToSource": false,
    "cell.sendToDoc": false,
    "sheet.next": false,
    "sheet.prev": false,
    // Reordering is the host's round to change; painting a selection is one
    // sidebar's own business, so a viewer may build a range freely.
    "sheet.moveUp": true,
    "sheet.moveDown": true,
    "sheet.extendUp": false,
    "sheet.extendDown": false,
    "sheet.newAff": true,
    "sheet.newNeg": true,
    "sheet.rename": true,
    "sheet.quickSwitch": false,
    "round.swapOrder": true,
    "sheet.jump1": false,
    "sheet.jump2": false,
    "sheet.jump3": false,
    "sheet.jump4": false,
    "sheet.jump5": false,
    "sheet.jump6": false,
    "sheet.jump7": false,
    "sheet.jump8": false,
    "sheet.jump9": false,
    "settings.open": false,
    "info.open": false,
    "rfd.toggle": false,
    "help.open": false,
    "sidebar.toggle": false,
    "view.zoomIn": false,
    "view.zoomOut": false,
    "split.toggle": false,
    "split.focusLeft": false,
    "split.focusRight": false,
    "palette.open": false,
    "theme.light": false,
    "theme.dark": false,
    "theme.system": false,
    "collab.share": false,
    "collab.shareView": false,
    "collab.join": false,
    "collab.invite": false,
    "collab.inviteView": false,
    "collab.end": false,
};

/**
 * Whether a command acts on the flow sheet's selected cells. Exhaustive over
 * `CommandId` on purpose, so a new command has to say which it is.
 *
 * A chord that lands in a chrome text box - rename a sheet, the command
 * palette, the RFD drawer, a settings field - is aimed at that box, not at the
 * grid parked behind it, so `useKeymap` and `dispatchMenuCommand` drop the
 * grid-scoped ones there. The grid's own cell editor is exempt: bolding the
 * cell you are typing in is the gesture, not a misfire.
 *
 * Undo and redo are not on the list. They mean "undo here", so a text box
 * takes them natively (`isNativeEditingChord`, and the Edit menu's own
 * re-dispatch); calling them cell-targeting would only leave the menu item
 * dead for anyone who rebinds them off the native chord.
 */
export const GRID_SCOPED: Record<CommandId, boolean> = {
    "window.new": false,
    "window.close": false,
    "flow.new": false,
    "flow.open": false,
    "flow.save": false,
    "flow.saveAs": false,
    "flow.reveal": false,
    "flow.close": false,
    "edit.undo": false,
    "edit.redo": false,
    "format.toggleBold": true,
    "format.toggleHighlight": true,
    "format.toggleCard": true,
    "format.toggleGroup": true,
    "format.toggleKicked": true,
    "row.insertAbove": true,
    "row.insertBelow": true,
    "row.delete": true,
    "cell.insert": true,
    "cell.insertBelow": true,
    "cell.move": true,
    "cell.jumpToSource": true,
    "cell.sendToDoc": true,
    "sheet.next": false,
    "sheet.prev": false,
    "sheet.moveUp": false,
    "sheet.moveDown": false,
    "sheet.extendUp": false,
    "sheet.extendDown": false,
    "sheet.newAff": false,
    "sheet.newNeg": false,
    "sheet.rename": false,
    "sheet.quickSwitch": false,
    "round.swapOrder": false,
    "sheet.jump1": false,
    "sheet.jump2": false,
    "sheet.jump3": false,
    "sheet.jump4": false,
    "sheet.jump5": false,
    "sheet.jump6": false,
    "sheet.jump7": false,
    "sheet.jump8": false,
    "sheet.jump9": false,
    "settings.open": false,
    "info.open": false,
    "rfd.toggle": false,
    "help.open": false,
    "sidebar.toggle": false,
    "view.zoomIn": false,
    "view.zoomOut": false,
    "split.toggle": false,
    "split.focusLeft": false,
    "split.focusRight": false,
    "palette.open": false,
    "theme.light": false,
    "theme.dark": false,
    "theme.system": false,
    "collab.share": false,
    "collab.shareView": false,
    "collab.join": false,
    "collab.invite": false,
    "collab.inviteView": false,
    "collab.end": false,
};
