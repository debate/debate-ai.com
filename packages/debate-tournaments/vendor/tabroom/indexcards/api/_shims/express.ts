// @ts-nocheck
/**
 * debate-tournaments shim for `express` in vendored upstream code.
 *
 * The vendored routers only take `Router` (and types) from express. Express's
 * router is the standalone `router` package, which runs on Workers; the rest
 * of express (http server, body parsing, `send`) is Node-only and not needed,
 * because `src/api/handler.ts` adapts fetch `Request`/`Response` itself.
 */
import Router from 'router';

export { Router };
export type Request = any;
export type Response = any;
export type NextFunction = (err?: unknown) => void;

export default { Router };
