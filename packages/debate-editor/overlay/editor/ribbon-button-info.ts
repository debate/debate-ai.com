/**
 * What each toolbar button is called and does, for its tooltip. Keyed by the
 * button's DOM id (the ids in `react/ribbon-template.ts`).
 *
 * `ribbon-tooltips.ts` joins this with the live keyboard shortcut, which it
 * derives from `command` through the user's keybinding overrides, so a rebind
 * in Settings shows up in the tooltip without touching this table. Buttons that
 * register their own label with the controller keep it (state-aware ones such
 * as Autosave need to); `label` here covers the rest, and is shorter than the
 * command-palette names in `RIBBON_COMMAND_LABELS`.
 */

import type { AnyCommandId } from './ribbon-commands.js';

export interface RibbonButtonInfo {
  /** Short action name shown in bold. */
  label: string;
  /** One sentence on what the button does. */
  description: string;
  /** The command whose keybinding the tooltip shows as the shortcut. */
  command?: AnyCommandId;
}

export const RIBBON_BUTTON_INFO: Readonly<Record<string, RibbonButtonInfo>> = {
  "undo-btn": { label: "Undo", description: "Reverse your last change to the document.", command: "undo" },
  "redo-btn": { label: "Redo", description: "Reapply the change you just undid.", command: "redo" },

  "open-btn": { label: "Open", description: "Open a Word or Debate Editor document from your computer.", command: "openFile" },
  "new-btn": { label: "New document", description: "Start a blank document.", command: "newDocument" },
  "export-btn": { label: "Save", description: "Save the document to its file.", command: "save" },
  "autosave-btn": {
    label: "Autosave",
    description: "Save automatically after every edit once the document has a file.",
    command: "toggleAutosave",
  },

  "speech-new-btn": {
    label: "New speech document",
    description: "Create a blank document to build your speech in.",
    command: "newSpeechDocument",
  },
  "speech-mark-btn": {
    label: "Speech document",
    description: "Mark or unmark the active document as the one your cards are sent to.",
    command: "markActiveAsSpeech",
  },
  "speech-send-cursor-btn": {
    label: "Send to speech at cursor",
    description: "Copy the selection into the speech document at its cursor.",
    command: "sendToSpeechAtCursor",
  },
  "speech-send-end-btn": {
    label: "Send to speech at end",
    description: "Append the selection to the end of the speech document.",
    command: "sendToSpeechAtEnd",
  },

  "qc-search-btn": {
    label: "Command bar",
    description: "Search every command, heading, and quick card from one box.",
    command: "openQuickCardSearch",
  },
  "qc-tagpicker-btn": { label: "Quick card tags", description: "Show only the quick cards that carry a chosen tag." },
  "qc-manage-btn": {
    label: "Manage quick cards",
    description: "Rename, tag, reorder, or delete your saved quick cards.",
    command: "manageQuickCards",
  },
  "qc-add-btn": {
    label: "Add quick card",
    description: "Save the selection as a reusable quick card.",
    command: "addQuickCard",
  },

  "style-pocket-btn": { label: "Pocket", description: "Make this line a Pocket, the top-level heading.", command: "setPocket" },
  "style-hat-btn": { label: "Hat", description: "Make this line a Hat, the heading under a Pocket.", command: "setHat" },
  "style-block-btn": { label: "Block", description: "Make this line a Block, a group of cards on one argument.", command: "setBlock" },
  "style-tag-btn": { label: "Tag", description: "Make this line a Tag, the claim a card is read for.", command: "setTag" },
  "style-analytic-btn": {
    label: "Analytic",
    description: "Style this paragraph as an analytic, an argument you wrote yourself.",
    command: "setAnalytic",
  },
  "style-undertag-btn": { label: "Undertag", description: "Add a note line directly under a tag.", command: "setUndertag" },

  "cite-btn": { label: "Cite", description: "Style the selection as the card's citation.", command: "applyCite" },
  "underline-btn": { label: "Underline", description: "Underline the parts of the card you plan to read.", command: "applyUnderline" },
  "emphasis-btn": { label: "Emphasis", description: "Bold and box the words you stress when reading.", command: "applyEmphasis" },
  "normal-btn": { label: "Clear formatting", description: "Remove all card formatting from the selection.", command: "clearToNormal" },

  "highlight-btn": { label: "Highlight", description: "Highlight the selection in the current color.", command: "applyHighlight" },
  "highlight-picker-btn": {
    label: "Highlight color",
    description: "Pick the color the Highlight button uses.",
    command: "openHighlightPicker",
  },
  "shading-btn": { label: "Shading", description: "Shade the background of the selection.", command: "applyShading" },
  "shading-picker-btn": {
    label: "Shading color",
    description: "Pick the color the Shading button uses.",
    command: "openShadingPicker",
  },
  "fontcolor-btn": { label: "Font color", description: "Color the selected text.", command: "applyFontColor" },
  "fontcolor-picker-btn": {
    label: "Font color picker",
    description: "Pick the color the Font color button uses.",
    command: "openFontColorPicker",
  },
  "font-size-input": { label: "Font size", description: "Type a point size and press Enter to apply it." },
  "font-size-picker-btn": {
    label: "Font size list",
    description: "Choose a size from the list of common sizes.",
    command: "openFontSizePicker",
  },
  "font-size-up-btn": { label: "Increase font size", description: "Make the selected text one step larger.", command: "adjustFontSizeUp" },
  "font-size-down-btn": { label: "Decrease font size", description: "Make the selected text one step smaller.", command: "adjustFontSizeDown" },

  "doc-menu-btn": {
    label: "Document tools",
    description: "Condense, shrink, clean up, and repair the whole document or selection.",
    command: "openDocToolsMenu",
  },
  "card-menu-btn": {
    label: "Card tools",
    description: "Cite, convert, and format the card under the cursor.",
    command: "openCardToolsMenu",
  },

  "num-role-btn": {
    label: "Number this card",
    description: "Give the card under the cursor the next number in its list.",
    command: "toggleNumberRole",
  },
  "num-sub-role-btn": {
    label: "Mark as sub-point",
    description: "Make this card a sub-point of the numbered card above it.",
    command: "toggleSubRole",
  },
  "num-restart-btn": {
    label: "Restart numbering",
    description: "Start the count over at this card.",
    command: "toggleNumRestart",
  },
  "num-visibility-btn": { label: "Show card numbers", description: "Show or hide the numbers on numbered cards." },

  "paragraph-integrity-btn": {
    label: "Paragraph integrity",
    description: "Keep paragraph breaks when condensing, so a card can be restored later.",
    command: "toggleParagraphIntegrity",
  },
  "plain-paste-toggle-btn": {
    label: "Paste as text",
    description: "Paste the clipboard as plain text with no source formatting.",
    command: "pasteAsText",
  },

  "read-mode-btn": {
    label: "Read mode",
    description: "Hide everything but the parts you underlined, for reading out loud.",
    command: "toggleReadMode",
  },
  "reader-view-btn": {
    label: "Reading view",
    description: "Switch to a distraction-free layout for reading the document.",
    command: "toggleReaderView",
  },

  "comments-toggle-btn": {
    label: "Show comments",
    description: "Show or hide the comments column beside the document.",
    command: "toggleCommentsVisible",
  },
  "comments-add-btn": {
    label: "Add comment",
    description: "Start a comment thread on the selected text.",
    command: "addCommentToSelection",
  },
  "add-note-btn": {
    label: "Add note",
    description: "Attach a private note to the selected text.",
    command: "addNoteToSelection",
  },
  "manage-flashcards-btn": {
    label: "Flashcards",
    description: "Browse, edit, and study your flashcard decks.",
    command: "manageFlashcards",
  },
  "create-flashcard-btn": {
    label: "Create flashcard",
    description: "Turn the selection into a flashcard to study later.",
    command: "createFlashcard",
  },
  "ask-ai-btn": {
    label: "Ask AI",
    description: "Ask the AI assistant about the selected text.",
    command: "aiAskAboutSelection",
  },

  "reference-btn": {
    label: "Keyboard shortcuts",
    description: "See every shortcut and command in one searchable list.",
    command: "openShortcutsReference",
  },
  "settings-btn": { label: "Settings", description: "Change how the editor looks and behaves.", command: "openSettings" },
  "timer-toggle-btn": { label: "Timer", description: "Show or hide the speech and prep timer." },
};
