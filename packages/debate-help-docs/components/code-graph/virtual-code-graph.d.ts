/**
 * Built by `devDocsCodeGraph` in `vite.mjs`: one loader per package under
 * `packages/`, keyed by directory, each resolving to that package's
 * `FileTreeNode[]` (`lib/code-graph/types.ts`). Empty outside the client build.
 */
declare module 'virtual:debate-code-graph' {
  export const codeGraphLoaders: Record<string, () => Promise<{ default: unknown }>>;
}
