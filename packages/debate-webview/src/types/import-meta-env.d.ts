/**
 * The one Vite build-time flag this package reads: `import.meta.env.SSR`,
 * which Vite replaces with a literal `true` in the server (rsc, ssr) builds and
 * `false` in the browser build. Branching on it lets the server build drop
 * browser-only `import()`s entirely (see `routes/doc/ResearchAgentEmbed.tsx`).
 * Declared here because this package doesn't pull in `vite/client`'s types.
 */
interface ImportMetaEnv {
  readonly SSR: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
