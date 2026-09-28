/**
 * @fileoverview Ambient declarations for dependencies that ship broken or no
 * typings. Mirrors debate-webview's `src/types/{assets,qwksearch-api-client}.d.ts`.
 */

/**
 * qwksearch-api-client (through 1.0.25) publishes
 * `"types": "./dist/src/index.d.ts"` but ships no such file, so every import
 * fails typechecking (TS7016) even though the runtime module is fine. This
 * shorthand ambient declaration types the whole module as `any` until the
 * package ships its .d.ts.
 */
declare module "qwksearch-api-client"

/** `prismjs` ships JavaScript with no bundled declarations. */
declare module "prismjs"
