/**
 * @debate-ai/tournaments — upstream Tabroom (debate/debate-tournaments, the `packages/debate-tournaments-tabroom` submodule) as
 * a debate-ai.com package.
 *
 *  - `debate-tournaments`         route table + React UI (client-safe)
 *  - `@debate-ai/tournaments/ui`      the React UI alone
 *  - `@debate-ai/tournaments/routes`  the route table alone
 *  - `@debate-ai/tournaments/ballots` judge ballot types, validation and tool definition
 *  - `@debate-ai/tournaments/sidebar` a tournament's Tabroom sidebar: parser, common links (no DOM, Worker-safe)
 *  - `@debate-ai/tournaments/server`  the API fetch handler on D1 (server only)
 */
export * from "./routes";
export * from "./ui";
export * from "./ballots";
export * from "./sidebar";
