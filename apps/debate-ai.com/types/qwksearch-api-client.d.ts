/**
 * qwksearch-api-client@0.9.217 publishes `"types": "./dist/src/index.d.ts"`
 * but ships no such file, so every import fails typechecking (TS7016) even
 * though the runtime module is fine. This shorthand ambient declaration
 * types the whole module as `any` until the package ships its .d.ts.
 */
declare module "qwksearch-api-client"
