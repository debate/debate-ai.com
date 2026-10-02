---
title: "REASON Module — CardMirror Research Editor"
---

# REASON Module — CardMirror Research Editor
Relevant source files
- [packages/debate-editor/package.json](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/package.json)
- [packages/debate-editor/src/editor/chrome-host.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/chrome-host.ts)
- [packages/debate-editor/src/editor/embed-containment.css](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/embed-containment.css)
- [packages/debate-editor/src/editor/host/browser-host.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/host/browser-host.ts)
- [packages/debate-editor/src/editor/index.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/index.ts)
- [packages/debate-editor/src/editor/recovery-ui.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/recovery-ui.ts)
- [packages/debate-editor/src/editor/reference-pdf-export.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/reference-pdf-export.ts)
- [packages/debate-editor/src/editor/reference-ui.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/reference-ui.ts)
- [packages/debate-editor/src/editor/style.css](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/style.css)
- [packages/debate-editor/test/chrome-host.test.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/test/chrome-host.test.ts)

The **REASON** (Research Editor for Annotated Summaries in Outline Notation) module is the core document editing environment in the Debate AI platform, implemented by the `debate-editor` package. It provides a high-fidelity, structured editor tailored to debate research documents known as "speech docs," integrating rich hierarchical document schema, lossless Word (.docx) interop, and a React-based UI.

---

## Purpose and Scope

REASON exposes the **CardMirror** ProseMirror engine—the foundational editor engine with a structured schema—and pairs it with a modern React shell that integrates with the site's speech-doc features. It specializes in ensuring perfect round-trip fidelity with Verbatim `.docx` formats (used by competitive debate teams with Word and macros). This module powers the `/reason-editor` route and embedded speech document panels, enabling users to create, modify, and send structured documents in ways that uphold debate-specific constraints and document formats.

---

## Module Architecture Overview

The `debate-editor` merges multiple layered concerns:

- **CardMirror ProseMirror Engine:** The core document model, node/mark schema, codecs for `.docx` and native `.cmir` format, and stable anchors for speech doc referencing.
- **React Shell:** UI components including the main editor view, ribbon/menu bar, outline navigation, and embedded panel containment.
- **Interop and Targeting:** Conversion pipelines for document import/export with DOCX and `.cmir` formats; multi-pane and mobile layout adjustments; speech document send/receive flows.

The diagram below positions key system parts from natural language formats through code entities into application spaces and APIs:

**Sources:**[packages/debate-editor/src/editor/index.ts1-151](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/index.ts#L1-L151)[packages/debate-editor/src/editor/chrome-host.ts1-31](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/chrome-host.ts#L1-L31)[packages/debate-editor/src/editor/recovery-ui.ts1-169](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/recovery-ui.ts#L1-L169)[apps/debate-ai.com/app/reason-editor/page.tsx1-165](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/app/reason-editor/page.tsx#L1-L165)[apps/debate-ai.com/app/api/topic-starters/route.ts1-18](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/app/api/topic-starters/route.ts#L1-L18)

---

## Core Components

### 1. CardMirror Schema & ProseMirror Engine

At the heart of the REASON module is the **CardMirror schema and engine**, which manages the document node hierarchy and data interchange:

- The document schema defines a strict nested structure optimized for debate content: **pockets → hats → blocks → cards → tags/citations/body**[packages/debate-editor/src/editor/index.ts16-20](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/index.ts#L16-L20)
- Supports full fidelity round-trip conversion between Microsoft Word `.docx` files created with the Verbatim macro and internal `.cmir` JSON codec format [packages/debate-editor/src/editor/index.ts17-18](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/index.ts#L17-L18)
- Handles damaged or orphaned document recovery gracefully via the Crash Recovery UI sidebar, letting users save or discard auto-saved drafts [packages/debate-editor/src/editor/recovery-ui.ts1-169](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/recovery-ui.ts#L1-L169)
- Provides stable heading IDs and Word-compatible bookmark anchors for reliable cross-referencing between documents.
- Supports native ProseMirror features: undo/redo history, plugins, command keymaps, and mobile layout adjustments.

For full technical detail on node types, import/export codecs, and document repair, see **[CardMirror Schema & ProseMirror Engine](/debate/debate-ai.com/7.1-cardmirror-schema-and-prosemirror-engine)**.

---

### 2. React Editor Shell, Menu Bar & Outline Navigation

The engine is wrapped by a React-based editor shell delivering the user interface and interaction layer:

- The `CardMirrorEditor` React component mounts the ProseMirror `EditorView` inside the `.dec-cardmirror-root` container, ensuring that permanent Chrome UI elements are properly scoped — this prevents UI pollution when embedded in other layouts [packages/debate-editor/src/editor/chrome-host.ts29-31](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/chrome-host.ts#L29-L31)
- Features a comprehensive **ribbon-menu bar** with approximately 500 commands organized into 30 thematic categories, providing everything from text style commands to document-level operations [packages/debate-editor/src/editor/index.ts2-151](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/index.ts#L2-L151)
- Includes a **collapsible outline navigation panel** to navigate the document's complex hierarchical structure [packages/debate-editor/src/editor/index.ts100](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/index.ts#L100-L100)
- Uses isolated stylesheets (often within iframes) to prevent CSS leakage and maintain a consistent visual layout even within embedded contexts (like the `/settings/editor-panel` iframe) [packages/debate-editor/src/editor/index.ts8-10](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/index.ts#L8-L10)
- Provides UI helpers for quick card search, card cutter workflow, and plugin registry integration.
- Supports multi-pane panels with state handoff, mobile plugin, and benchmarks integration.

For a detailed look at these React components, UI layout, and menu bar structure, see **[React Editor Shell, Menu Bar & Outline Nav](/debate/debate-ai.com/7.2-react-editor-shell-menu-bar-and-outline-nav)**.

---

### 3. Documents, Topic Starters & Speech Document Targets

The REASON module integrates deeply with user documents, debate topic starters, and speech document workflows:

- The `reason-editor` page (`apps/debate-ai.com/app/reason-editor/page.tsx`) manages document CRUD operations: creating, listing, moving, deleting, and saving through API calls to `/api/doc/documents`[apps/debate-ai.com/app/reason-editor/page.tsx27-165](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/app/reason-editor/page.tsx#L27-L165)
- Displays a **FileTree** for user document organization alongside an **OpenTabsPanel** managing open editors simultaneously, allowing easy tab switching and workflow continuity.
- Supports **Topic Starters**, debate-specific content templates, fetched and listed via API endpoint `/api/topic-starters`, which are backed by the `topic_starter_items` Drizzle database schema [apps/debate-ai.com/app/api/topic-starters/route.ts1-18](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/app/api/topic-starters/route.ts#L1-L18)
- Implements **Speech Document Targeting**, where any open document can be marked as the active speech document to which content is sent live either at the cursor position or appended to the end. This supports workflows that send evidence and notes directly into a live speech draft [packages/debate-editor/src/editor/index.ts37-46](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/src/editor/index.ts#L37-L46)
- Maintains a **Speech Send Log Panel** enabling cloud-save and tracking of all send operations for auditing and undo support.
- Documents use native CardMirror document IDs with encryption and crash recovery integration.

For end-to-end details on document management, topic starters integration, and speech doc flows, see **[Documents, Topic Starters & Speech Document Targets](/debate/debate-ai.com/7.3-documents-topic-starters-and-speech-document-targets)**.

---

# Summary

The REASON module provides a tightly integrated research editing environment in Debate AI built around CardMirror’s ProseMirror engine and schema. It bridges the complexity of structured debate documents with seamless DOCX interoperability, all accessed via a React shell UI suited both for embedded flow speech panels and the standalone `/reason-editor` page.

- **CardMirror Engine:** Core document model, schema, and codecs preserving Verbatim fidelity.
- **React Shell:** Rich UI with menu bars, outline navigation, multi-pane support, and embedded style containment.
- **Document & Speech Integration:** User document management, topic starter integration, and live speech-document targeting with cloud sync.

These layers cohesively power debate research workflows and speech preparation, supporting both desktop and embedded web use cases.

---

# Child Pages for Details

- **[CardMirror Schema & ProseMirror Engine](/debate/debate-ai.com/7.1-cardmirror-schema-and-prosemirror-engine)** — in-depth on node/mark schema, DOCX/CMIR codecs, document repair, embed containment, quick card search, and PDF export.
- **[React Editor Shell, Menu Bar & Outline Nav](/debate/debate-ai.com/7.2-react-editor-shell-menu-bar-and-outline-nav)** — details on the React `CardMirrorEditor` component, ribbon menu bar with command categories, multi-pane shell layout, style isolation, and outline (nav pane) implementation.
- **[Documents, Topic Starters & Speech Document Targets](/debate/debate-ai.com/7.3-documents-topic-starters-and-speech-document-targets)** — the `/reason-editor` page managing user documents and topic starters, plus speech document send/receive flow with cloud save and legacy verbatim shortcuts.

---

**Sources:**

- packages/debate-editor/src/editor/index.ts:1-151
- packages/debate-editor/src/editor/chrome-host.ts:1-31
- packages/debate-editor/src/editor/recovery-ui.ts:1-169
- packages/debate-editor/package.json:1-69
- apps/debate-ai.com/app/reason-editor/page.tsx:1-184
- apps/debate-ai.com/app/api/topic-starters/route.ts:1-18