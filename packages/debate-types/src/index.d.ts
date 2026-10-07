/**
 * @fileoverview `@debate/types` — every shared Debate AI type, in one place.
 *
 * Declarations only (`.d.ts`): no constants, no functions, nothing that runs. The
 * owning packages keep their runtime code and re-export the types they used
 * to declare, so existing imports keep working while new code can import any
 * type from here.
 *
 * Each object and field carries a doc comment, so hovering one in an editor
 * shows what it means. Domains, one file each:
 *
 * - `timer` — speech/prep timers and debate formats
 * - `flow-record` — the saved flow, flow row and round records
 * - `flow-model` — scouting and decisions in the `ebb` flow editor
 * - `collab` — the replicated (CRDT) shape of a shared round
 * - `round-ui` — settings and the flow page's view state
 * - `cards` — the evidence-card parser's cards, outlines and options
 * - `videos` — the video library feed
 * - `predictions` — prediction-market wire types
 * - `practice` — the Practice vs AI backend
 * - `tournaments` — the D1 slice the tournaments package needs
 * - `documents` — REASON editor documents
 * - `system` — the native wrapper's system info
 */

export * from "./timer";
export * from "./flow-record";
export * from "./flow-model";
export * from "./collab";
export * from "./round-ui";
export * from "./cards";
export * from "./videos";
export * from "./predictions";
export * from "./practice";
export * from "./tournaments";
export * from "./documents";
export * from "./system";
