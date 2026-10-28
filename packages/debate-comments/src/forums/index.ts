/**
 * @fileoverview The forums' framework-free half: wire types and limits,
 * request validation the API routes share with the form, the browser calls,
 * and date and count labels. The pages are in `./ui`
 * (`@debate-ai/comments/forums/ui`); the queries stay in the app
 * (`apps/debate-web/lib/forums/queries.ts`).
 *
 * @module debate-comments/forums
 */

export * from "./types";
export * from "./validation";
export * from "./format";
export * from "./client";
