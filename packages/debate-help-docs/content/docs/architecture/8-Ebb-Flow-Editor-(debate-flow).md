---
title: "Ebb Flow Editor (debate-flow)"
---

# Ebb Flow Editor (debate-flow)
Relevant source files
- [codecov.yml](https://github.com/debate/debate-ai.com/blob/34937310/codecov.yml)
- [packages/debate-api-client/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-api-client/README.md?plain=1)
- [packages/debate-contributor-progress/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-contributor-progress/README.md?plain=1)
- [packages/debate-flow/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-flow/README.md?plain=1)
- [packages/debate-flow/src/components/flow/HotGrid.tsx](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-flow/src/components/flow/HotGrid.tsx)
- [packages/debate-round-practice-ai/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round-practice-ai/README.md?plain=1)
- [packages/debate-search-evidence/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-search-evidence/README.md?plain=1)

The `debate-flow` package provides the local-first, keyboard-first Ebb flow editor. It is designed to offer a specialized environment for tracking debate arguments, serving as a modern alternative to traditional spreadsheet applications. While `debate-flow` can function as a standalone editor, its primary integration within the `debate-ai.com` platform is through the `EbbFlowEmbed` component, which seamlessly mounts the editor into host pages like the `debate-round` live round editor.

This page offers a high-level overview of the `debate-flow` package, its core components, and its integration within the larger `debate-ai.com` ecosystem. Detailed technical explanations are provided in its child pages.

## System Architecture

The Ebb editor is built around a custom data model optimized for debate structures, leveraging a local-first approach for performance, offline capabilities, and collaborative conflict-free replication.

### Core Data Model

The editor's state is defined by a hierarchy of types that represent a debate round and its components:

- **FlowRound**: The top-level container representing a single debate match, encompassing multiple sheets and their data.
- **FlowSheet**: An individual sheet within a round, such as "Case" or "Off-case 1".
- **CellMeta**: The metadata layer for each editable cell, tracking rich state like text styling (bold, highlight), argument kicks, and links to evidence cards.

These structures form the foundation of the editor's data and enable debate-specific functionality not typically found in generic grids or spreadsheets.

Sources: [packages/debate-round/src/types/flow.ts10-12](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/types/flow.ts#L10-L12)[packages/debate-round/src/panels/DebateRoundPanel.tsx11](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/panels/DebateRoundPanel.tsx#L11-L11)[packages/debate-round/src/layout/EbbFlowToolsMenu.tsx11](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/layout/EbbFlowToolsMenu.tsx#L11-L11)

---

## The Ebb Grid, Data Model & Export

At its core, the Ebb editor implements a specialized grid interface optimized for debate flow authoring. Unlike conventional spreadsheets, the grid incorporates semantics unique to debates and argument flow.

Key features include:

- **FlowRound/FlowSheet/CellMeta Types**: Foundational data types representing debate rounds, sheets, and per-cell metadata are central to the editor's model.
- **Event-Driven Column Layout**: Columns dynamically adapt to the selected debate format (Policy, PF, LD, Parli), reflecting the structural conventions of the flow.
- **Cell Metadata & Meta-Undo**: Cells maintain detailed metadata such as styling, argument kicks, and connection to evidence cards, with undo/redo support specifically for these rich state changes.
- **Codec Serialization**: Custom encoding and decoding logic serializes flow data efficiently for storage and transmission.
- **Context Menu & Zoom**: The grid supports context menus for quick flow operations and zoom controls for readability.
- **XLSX Export**: Users can export flows as `.xlsx` files preserving layout and embedded metadata.

For complete technical details on the data model, rendering layer (HotGrid component), event-driven layout, metadata management, undo stacks, and export functionality, see the child page [Ebb Grid, Data Model & Export](/debate/debate-ai.com/8.1-ebb-grid-data-model-and-export).

Sources: [packages/debate-round/src/types/flow.ts10-12](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/types/flow.ts#L10-L12)[packages/debate-flow/src/components/flow/HotGrid.tsx1-190](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-flow/src/components/flow/HotGrid.tsx#L1-L190)

---

## Ebb Collaboration & CardMirror Bridge

Collaboration and integration are foundational to the Ebb editor's design, enabling multiple users to edit debate flows in real-time and synchronizing evidence seamlessly.

Key aspects of collaboration include:

- **CRDT Replica/Ops Model**: The editor uses a Conflict-free Replicated Data Type (CRDT) approach, with a `Replica` class managing concurrent operations and conflict-free merges.
- **Peer Link Transport**: Various transport layers implement peer-to-peer communication enabling real-time synchronization between collaborators.
- **Handshake, Invite & Presence**: Protocols manage connection invitations, handshakes, and live presence indicators, showing collaborators' cursors and selections.
- **Conflict-Free Merge**: The CRDT ensures all changes converge cleanly without data loss or conflicts.
- **CardMirror Bridge**: Specialized protocol connects the CardMirror evidence editor to Ebb, allowing direct insertion of evidence cards into the flow grid, bridging research and argumentation.

For implementation details on CRDTs, peer link protocols, presence management, conflict resolution, and the CardMirror integration protocol, see [Ebb Collaboration & CardMirror Bridge](/debate/debate-ai.com/8.2-ebb-collaboration-and-cardmirror-bridge).

Sources: [packages/debate-flow/src/components/flow/HotGrid.tsx10-190](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-flow/src/components/flow/HotGrid.tsx#L10-L190) (imports suggest collaboration with replica and peer link modules)

---

## EbbFlowEmbed Host Integration

The `EbbFlowEmbed` component offers host applications, like `debate-ai.com`, a clean way to embed the Ebb flow editor as an isolated, scoped panel with well-defined integration points.

Integration highlights:

- **Mounting Ebb in Host Pages**: `EbbFlowEmbed` mounts the full editor inside designated UI panels, e.g. within `DebateRoundPanel` of the `debate-round` app, providing a seamless embed experience.
- **CSS Scoping**: Styles within the embedded editor are isolated via a CSS class scope (e.g., `.ebb-scope`) to avoid conflicts with global host styles.
- **Theme and Keyboard Scope Isolation**: The embedded editor mediates theme variables and keyboard shortcuts, preserving the host app's contextual integrity and avoiding clashes.
- **EbbFlowToolsMenu Integration**: The host UI exposes an Ebb tools menu (`EbbFlowToolsMenu`), offering flow operations like "New flow", "Open", and "Settings". The menu actions bubble to the embed component and are dispatched when active.
- **User Preferences**: Settings related to Ebb editor behavior and appearance are managed by the host application's preferences system.

This tight integration balances embedding a complex, stateful editor while preserving modularity. For a full description of embedding APIs, CSS scoping strategy, keyboard shortcut management, and the tool menu collaboration, see [EbbFlowEmbed Host Integration](/debate/debate-ai.com/8.3-ebbflowembed-host-integration).

Sources: [packages/debate-round/src/panels/DebateRoundPanel.tsx11](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/panels/DebateRoundPanel.tsx#L11-L11)[packages/debate-round/src/panels/DebateRoundPanel.tsx53](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/panels/DebateRoundPanel.tsx#L53-L53)[packages/debate-round/src/panels/DebateRoundPanel.tsx83-86](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/panels/DebateRoundPanel.tsx#L83-L86)[packages/debate-round/src/layout/EbbFlowToolsMenu.tsx11](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/layout/EbbFlowToolsMenu.tsx#L11-L11)

---

This page serves as a landing overview for the `debate-flow` package and its embed integration. For deep dives on specific subtopics, please visit the corresponding child pages:

- [Ebb Grid, Data Model & Export](/debate/debate-ai.com/8.1-ebb-grid-data-model-and-export) — Detailed types, HotGrid rendering, column layout strategies, metadata undo stacks, codec serialization, context menu behavior, zoom, and XLSX export.
- [Ebb Collaboration & CardMirror Bridge](/debate/debate-ai.com/8.2-ebb-collaboration-and-cardmirror-bridge) — CRDT replica logic, peer link transport layers, connection handshake and presence protocols, conflict-free merge strategies, and the CardMirror bridge protocol.
- [EbbFlowEmbed Host Integration](/debate/debate-ai.com/8.3-ebbflowembed-host-integration) — Embedding Ebb as a scoped panel with CSS and theme isolation, managing keyboard scope, the EbbFlowToolsMenu components, and user preference integration.

Together, these pieces form the foundation for the powerful debate flow editing experience inside `debate-ai.com`.

---

# Summary Diagram: Natural Language Systems to Code Entities in Ebb Flow

Sources: [packages/debate-round/src/types/flow.ts10-12](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/types/flow.ts#L10-L12)[packages/debate-round/src/panels/DebateRoundPanel.tsx11-53](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/panels/DebateRoundPanel.tsx#L11-L53)[packages/debate-round/src/layout/EbbFlowToolsMenu.tsx11](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/layout/EbbFlowToolsMenu.tsx#L11-L11)[packages/debate-flow/src/components/flow/HotGrid.tsx1-190](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-flow/src/components/flow/HotGrid.tsx#L1-L190)

---

# Summary Table

| Major Aspect | Description | Code References |
| --- | --- | --- |
| Data Model | FlowRound/FlowSheet/CellMeta types represent debate flow | `packages/debate-round/src/types/flow.ts` |
| Grid Rendering | HotGrid React component wraps Handsontable for rendering | `packages/debate-flow/src/components/flow/HotGrid.tsx` |
| Collaboration | CRDT replica pattern with peer link transport | `packages/debate-flow/src/lib/collab/replica.ts` (implied) |
| Editor Embedding | EbbFlowEmbed embeds the editor with scoped styles, theme | `packages/debate-round/src/panels/DebateRoundPanel.tsx` |
| Tools Menu Integration | EbbFlowToolsMenu provides flow actions and integrates with embed | `packages/debate-round/src/layout/EbbFlowToolsMenu.tsx` |
| Serialization & Export | Flow codec serialization and XLSX export | Covered in Ebb Grid child page |

---

This overview introduces the `debate-flow` package's concepts and integration points, guiding readers to specialized child pages for thorough exploration.