/**
 * @debate/tournaments — upstream Tabroom (debate/debate-tournament-tabroom) as
 * a debate-ai.com package.
 *
 *  - `debate-tournaments`         route table + React UI (client-safe)
 *  - `@debate/tournaments/ui`      the React UI alone
 *  - `@debate/tournaments/routes`  the route table alone
 *  - `@debate/tournaments/ballots` judge ballot types, validation and tool definition
 *  - `@debate/tournaments/server`  the API fetch handler on D1 (server only)
 */
export * from "./routes";
export * from "./ui";
export * from "./ballots";
