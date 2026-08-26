/**
 * The DOM markup `src/editor/index.ts` expects to already exist when it's
 * imported — ported verbatim from CardMirror's original `index.html` body
 * (minus `<script>`/`<head>`, which the host page and this package's own
 * dynamic import supply instead).
 *
 * `index.ts` is side-effecting module code, not an exported `mount()`
 * function: at import time it runs `document.getElementById(...)` (some
 * calls non-null-asserted) and wires listeners synchronously. A handful of
 * ids are load-time REQUIRED (missing one throws and aborts the module):
 * `editor`, `app`, `nav-panel`, `open-btn`, `export-btn`, `settings-btn`,
 * `read-mode-btn`, `word-count-btn`, `word-count-text`,
 * `cursor-color-display`, `cursor-color-text`, `zoom-out-btn`, `zoom-in-btn`,
 * `zoom-reset-btn`, `zoom-pct`. Everything else below is optional (used
 * behind `| null` guards) — kept anyway so the full feature set (quick
 * cards, comments, numbering, collab chip, etc.) works exactly as upstream
 * intends. Two web-edition promo buttons from the original markup
 * (`download-app-btn`, `github-btn` — "download the desktop app" /
 * "CardMirror on GitHub") are dropped: they're optional and don't belong in
 * an embedded product surface.
 *
 * This is CardMirror's OWN ribbon/toolbar — the debate-editor-cardmirror
 * React shell adds a NEW menu bar (`MenuBar.tsx`) ABOVE this markup rather
 * than replacing it, so every ribbon command stays reachable both ways.
 */
export const RIBBON_HTML = `
<header id="ribbon">
  <section id="timer-panel" class="ribbon-section pmd-timer-panel" hidden></section>
  <div class="ribbon-section ribbon-left">
    <div id="undo-redo-stack" class="ribbon-button-stack">
      <button id="undo-btn" type="button" title="Undo" aria-label="Undo"><span class="pmd-icon pmd-icon-undo" aria-hidden="true"></span></button>
      <button id="redo-btn" type="button" title="Redo" aria-label="Redo"><span class="pmd-icon pmd-icon-redo" aria-hidden="true"></span></button>
    </div>
    <div id="file-stack" class="ribbon-button-stack">
      <button id="open-btn" type="button" title="Open a document" aria-label="Open"><span class="pmd-icon pmd-icon-open" aria-hidden="true"></span></button>
      <button id="new-btn" type="button" title="New document" aria-label="New document"><span class="pmd-icon pmd-icon-new" aria-hidden="true"></span></button>
      <button id="export-btn" type="button" disabled title="Save" aria-label="Save"><span class="pmd-icon pmd-icon-save" aria-hidden="true"></span></button>
      <button id="autosave-btn" type="button" aria-pressed="false"
              title="Autosave is off — click to turn on" aria-label="Toggle autosave"><span class="pmd-icon pmd-icon-autosave" aria-hidden="true"></span></button>
    </div>
    <div id="speech-stack" class="ribbon-button-stack ribbon-speech-stack">
      <button id="speech-new-btn" type="button"
              title="New speech document" aria-label="New speech document"><span class="pmd-icon pmd-icon-mic" aria-hidden="true"></span></button>
      <button id="speech-mark-btn" type="button"
              aria-pressed="false" title="Mark / unmark the active doc as the speech doc"
              aria-label="Mark active doc as speech doc"><span class="pmd-icon pmd-icon-speech-mark" aria-hidden="true"></span></button>
      <button id="speech-send-cursor-btn" type="button"
              title="Send to speech doc at cursor (\`)" aria-label="Send to speech at cursor"><span class="pmd-icon pmd-icon-send-cursor" aria-hidden="true"></span></button>
      <button id="speech-send-end-btn" type="button"
              title="Send to speech doc at end (Alt-\`)" aria-label="Send to speech at end"><span class="pmd-icon pmd-icon-send-end" aria-hidden="true"></span></button>
    </div>
    <div id="quickcards-stack" class="ribbon-button-stack ribbon-quickcards-stack" role="group" aria-label="Quick Cards">
      <button id="qc-search-btn" type="button"
              title="Toggle command bar" aria-label="Toggle command bar"><span class="pmd-icon pmd-icon-search" aria-hidden="true"></span></button>
      <button id="qc-tagpicker-btn" type="button"
              title="Filter quick cards by tag" aria-label="Quick card tag picker"><span class="pmd-icon pmd-icon-tag" aria-hidden="true"></span></button>
      <button id="qc-manage-btn" type="button"
              title="Manage quick cards" aria-label="Manage quick cards"><span class="pmd-icon pmd-icon-manage" aria-hidden="true"></span></button>
      <button id="qc-add-btn" type="button"
              title="Add quick card from selection" aria-label="Add quick card"><span class="pmd-icon pmd-icon-add" aria-hidden="true"></span></button>
    </div>
    <div id="formatting-panel" class="ribbon-formatting-panel" role="group" aria-label="Formatting panel">
      <button id="style-pocket-btn" class="formatting-panel-btn formatting-panel-pocket" type="button">Pocket</button>
      <button id="style-tag-btn" class="formatting-panel-btn formatting-panel-tag" type="button">Tag</button>
      <button id="style-hat-btn" class="formatting-panel-btn formatting-panel-hat" type="button">Hat</button>
      <button id="style-block-btn" class="formatting-panel-btn formatting-panel-block" type="button">Block</button>
      <button id="style-analytic-btn" class="formatting-panel-btn formatting-panel-analytic" type="button">Analytic</button>
      <button id="style-undertag-btn" class="formatting-panel-btn formatting-panel-undertag" type="button">Undertag</button>
    </div>
    <div id="cite-panel" class="ribbon-cite-panel" role="group" aria-label="Inline marks">
      <button id="cite-btn" class="formatting-panel-btn formatting-panel-cite" type="button">Cite</button>
      <button id="underline-btn" class="formatting-panel-btn formatting-panel-underline" type="button">Underline</button>
      <button id="emphasis-btn" class="formatting-panel-btn formatting-panel-emphasis" type="button">Emphasis</button>
      <button id="normal-btn" class="formatting-panel-btn formatting-panel-normal" type="button">Clear</button>
    </div>
    <div id="color-panel" class="ribbon-color-panel" role="group" aria-label="Colors">
      <div class="ribbon-color-control" data-control="highlight">
        <button id="highlight-btn" class="ribbon-color-main" type="button" title="Highlight (F11)">
          <span class="ribbon-color-glyph pmd-icon pmd-icon-highlight" aria-hidden="true"></span>
          <span class="ribbon-color-bar" id="highlight-bar"></span>
        </button>
        <button id="highlight-picker-btn" class="ribbon-color-arrow" type="button" title="Highlight color"
                aria-haspopup="true" aria-expanded="false"><span class="pmd-icon pmd-icon-chevron-down" aria-hidden="true"></span></button>
      </div>
      <div class="ribbon-color-control" data-control="shading">
        <button id="shading-btn" class="ribbon-color-main" type="button" title="Background color">
          <span class="ribbon-color-glyph pmd-icon pmd-icon-shading" aria-hidden="true"></span>
          <span class="ribbon-color-bar" id="shading-bar"></span>
        </button>
        <button id="shading-picker-btn" class="ribbon-color-arrow" type="button" title="Background color"
                aria-haspopup="true" aria-expanded="false"><span class="pmd-icon pmd-icon-chevron-down" aria-hidden="true"></span></button>
      </div>
      <div class="ribbon-color-control" data-control="fontcolor">
        <button id="fontcolor-btn" class="ribbon-color-main" type="button" title="Font color">
          <span class="ribbon-color-glyph" id="fontcolor-glyph">A</span>
          <span class="ribbon-color-bar" id="fontcolor-bar"></span>
        </button>
        <button id="fontcolor-picker-btn" class="ribbon-color-arrow" type="button" title="Font color"
                aria-haspopup="true" aria-expanded="false"><span class="pmd-icon pmd-icon-chevron-down" aria-hidden="true"></span></button>
      </div>
      <div class="ribbon-color-control ribbon-font-size-control" data-control="fontsize">
        <input id="font-size-input" class="ribbon-font-size-input" type="text"
               inputmode="numeric" autocomplete="off" spellcheck="false"
               aria-label="Font size at cursor" title="Font size — Enter to apply" />
        <button id="font-size-picker-btn" class="ribbon-color-arrow" type="button" title="Font size"
                aria-haspopup="true" aria-expanded="false"><span class="pmd-icon pmd-icon-chevron-down" aria-hidden="true"></span></button>
      </div>
      <button id="font-size-up-btn" class="ribbon-font-size-step" type="button"
              title="Increase font size" aria-label="Increase font size"
              ><span>A</span><span class="ribbon-font-size-step-arrow ribbon-font-size-step-up-arrow pmd-icon pmd-icon-chevron-up" aria-hidden="true"></span></button>
      <button id="font-size-down-btn" class="ribbon-font-size-step" type="button"
              title="Decrease font size" aria-label="Decrease font size"
              ><span>A</span><span class="ribbon-font-size-step-arrow pmd-icon pmd-icon-chevron-down" aria-hidden="true"></span></button>
    </div>
    <div id="doc-menu-panel" class="ribbon-doc-menu-panel" role="group" aria-label="Document utilities">
      <button id="doc-menu-btn" class="ribbon-doc-menu-btn" type="button"
              title="Document utilities" aria-haspopup="true" aria-expanded="false">Doc <span class="ribbon-doc-menu-arrow pmd-icon pmd-icon-chevron-down" aria-hidden="true"></span></button>
      <button id="card-menu-btn" class="ribbon-doc-menu-btn" type="button"
              title="Card utilities" aria-haspopup="true" aria-expanded="false">Card <span class="ribbon-doc-menu-arrow pmd-icon pmd-icon-chevron-down" aria-hidden="true"></span></button>
    </div>
    <div id="format-menu-panel" class="ribbon-format-menu-panel" role="group" aria-label="Formatting utilities">
      <button id="table-menu-btn" class="ribbon-doc-menu-btn ribbon-format-table-btn" type="button"
              title="Table operations" aria-haspopup="true" aria-expanded="false">Table <span class="ribbon-doc-menu-arrow pmd-icon pmd-icon-chevron-down" aria-hidden="true"></span></button>
      <button id="insert-image-btn" class="ribbon-format-inline-btn ribbon-format-image-btn" type="button"
              title="Insert image at cursor" aria-label="Insert image"><span class="pmd-icon pmd-icon-image" aria-hidden="true"></span></button>
      <div class="ribbon-format-inline-row" role="group" aria-label="Inline marks">
        <button id="superscript-btn" class="ribbon-format-inline-btn" type="button"
                title="Superscript">x<sup>2</sup></button>
        <button id="subscript-btn" class="ribbon-format-inline-btn" type="button"
                title="Subscript">x<sub>2</sub></button>
        <button id="strikethrough-btn" class="ribbon-format-inline-btn" type="button"
                title="Strikethrough"><s>S</s></button>
      </div>
    </div>
    <div id="numbering-panel" class="ribbon-numbering-panel" role="group" aria-label="Card numbering">
      <button id="num-role-btn" class="ribbon-doc-ops-btn ribbon-numbering-btn" type="button"
              aria-pressed="false" title="Number this card">1.</button>
      <button id="num-sub-role-btn" class="ribbon-doc-ops-btn ribbon-numbering-btn" type="button"
              aria-pressed="false" title="Mark as substructure">a)</button>
      <button id="num-restart-btn" class="ribbon-doc-ops-btn ribbon-numbering-btn" type="button"
              aria-pressed="false" title="Restart numbering here">↻</button>
      <button id="num-visibility-btn" class="ribbon-doc-ops-btn ribbon-numbering-btn" type="button"
              aria-pressed="true" title="Show or hide card numbering"><span class="pmd-icon pmd-icon-list" aria-hidden="true"></span></button>
    </div>
    <div id="doc-ops-panel" class="ribbon-doc-ops-panel" role="group" aria-label="Document operations">
      <button id="paragraph-integrity-btn" class="ribbon-doc-ops-btn" type="button"
              aria-pressed="true" title="Paragraph Integrity"><span class="pmd-icon pmd-icon-paragraph-integrity" aria-hidden="true"></span></button>
      <button id="plain-paste-toggle-btn" class="ribbon-doc-ops-btn" type="button"
              aria-pressed="false" title="Paste Text (F2) — paste the clipboard as unformatted text">T</button>
    </div>
    <div id="view-ops-panel" class="ribbon-doc-ops-panel" role="group" aria-label="View tools">
      <button id="read-mode-btn" class="ribbon-doc-ops-btn" type="button"
              title="Read mode" aria-label="Read mode"><span class="pmd-icon pmd-icon-read-mode" aria-hidden="true"></span></button>
      <button id="nav-pane-toggle-btn" class="ribbon-doc-ops-btn" type="button"
              aria-pressed="true" title="Show / hide the navigation pane"
              aria-label="Toggle nav pane"><span class="pmd-icon pmd-icon-nav-toggle" aria-hidden="true"></span></button>
    </div>
    <div id="comments-ops-panel" class="ribbon-doc-ops-panel ribbon-doc-ops-panel-3col" role="group" aria-label="Comments">
      <button id="comments-toggle-btn" class="ribbon-doc-ops-btn" type="button"
              aria-pressed="false" title="Show/hide comments" aria-label="Show or hide comments"><span class="pmd-icon pmd-icon-comments" aria-hidden="true"></span></button>
      <button id="comments-add-btn" class="ribbon-doc-ops-btn" type="button"
              title="Add a comment on the selection" aria-label="Add comment"><span class="pmd-icon pmd-icon-plus" aria-hidden="true"></span></button>
      <button id="add-note-btn" class="ribbon-doc-ops-btn" type="button"
              title="Add a private note on the selection" aria-label="Add note"><span class="pmd-icon pmd-icon-note" aria-hidden="true"></span></button>
      <button id="manage-flashcards-btn" class="ribbon-doc-ops-btn" type="button"
              title="Manage flashcards" aria-label="Manage flashcards"><span class="pmd-icon pmd-icon-manage" aria-hidden="true"></span></button>
      <button id="create-flashcard-btn" class="ribbon-doc-ops-btn" type="button"
              title="Create flashcard from selection" aria-label="Create flashcard from selection"><span class="pmd-icon pmd-icon-flashcard" aria-hidden="true"></span></button>
      <button id="ask-ai-btn" class="ribbon-doc-ops-btn" type="button" hidden
              title="Ask AI about selection" aria-label="Ask AI about selection"><span class="pmd-icon pmd-icon-ai" aria-hidden="true"></span></button>
    </div>
    <div id="custom-ribbon-panel" class="ribbon-doc-ops-panel ribbon-doc-ops-panel-3col" role="group" aria-label="Custom buttons" hidden></div>
  </div>
  <div class="ribbon-section ribbon-center">
    <div id="doc-name-chip" class="pmd-doc-name-chip" title="" hidden>
      <span class="pmd-doc-name-chip-text" id="doc-name-chip-text"></span>
    </div>
  </div>
  <div class="ribbon-section ribbon-right">
    <div class="ribbon-right-grid">
      <button id="reference-btn" type="button" title="Keyboard shortcuts" aria-label="Keyboard shortcuts"><span class="pmd-icon pmd-icon-shortcuts" aria-hidden="true"></span></button>
      <button id="settings-btn" type="button" title="Settings" aria-label="Settings"><span class="pmd-icon pmd-icon-settings" aria-hidden="true"></span></button>
      <button id="timer-toggle-btn" type="button" aria-pressed="false"
              title="Show / hide the timer panel" aria-label="Toggle timer panel"><span class="pmd-icon pmd-icon-timer" aria-hidden="true"></span></button>
    </div>
  </div>
</header>
<div id="nav-panel"></div>
<div id="speech-doc-banner" hidden>
  <span class="pmd-speech-doc-banner-icon pmd-icon pmd-icon-mic" aria-hidden="true"></span>
  <span class="pmd-speech-doc-banner-label">Speech document</span>
</div>
<main id="app">
  <div class="pmd-editor-row">
    <section id="editor"></section>
    <aside id="comments-column" class="pmd-comments-column" aria-label="Comments" hidden></aside>
  </div>
</main>
<button id="nav-pane-pull-tab" type="button"
        title="Show navigation pane" aria-label="Show navigation pane"><span class="pmd-icon pmd-icon-chevron-right" aria-hidden="true"></span></button>
<div id="status-bar">
  <button id="word-count-btn" class="status-bar-btn" type="button"
          title="Word Count Selection" aria-label="Word count selection summary">Σ</button>
  <div id="word-count-display" class="status-segment" title="Read-aloud word count and read time">
    <span id="word-count-text">—</span>
  </div>
  <div id="cursor-color-display" class="status-segment" hidden
       title="Highlight and shading colors stored on the run at the cursor">
    <span id="cursor-color-text">—</span>
  </div>
  <div id="collab-chip" class="status-segment" hidden
       title="Collaboration session status"></div>
  <div class="status-spacer"></div>
  <button id="notice-chip" class="status-segment" type="button" hidden></button>
  <button id="update-chip" class="status-segment" type="button" hidden></button>
  <div class="zoom-controls" title="Zoom">
    <button id="zoom-out-btn" type="button" aria-label="Zoom out"><span class="pmd-icon pmd-icon-minus" aria-hidden="true"></span></button>
    <span id="zoom-pct">100%</span>
    <button id="zoom-in-btn" type="button" aria-label="Zoom in"><span class="pmd-icon pmd-icon-plus" aria-hidden="true"></span></button>
    <button id="zoom-reset-btn" type="button" aria-label="Reset zoom to 100%" title="Reset to 100%"><span class="pmd-icon pmd-icon-reset" aria-hidden="true"></span></button>
  </div>
</div>
`;
