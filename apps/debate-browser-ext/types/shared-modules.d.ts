/**
 * Untyped modules the workspace packages this extension bundles
 * (`debate-webview`, `debate-speech-writer`, `write-language`) import.
 *
 * Those packages declare them in their own `.d.ts` files, but a program only
 * sees ambient declarations inside its own `include`, and this app's typecheck
 * compiles their sources without them. Same shorthand declarations as
 * packages/debate-webview/src/types/{assets,qwksearch-api-client}.d.ts.
 */

/** `prismjs` ships JavaScript with no bundled declarations. */
declare module 'prismjs';

/** qwksearch-api-client's published `types` path points at a file it does not ship. */
declare module 'qwksearch-api-client';
