// `?raw` is Vite's raw-text import (used by vinext and Vitest alike).
declare module "*?raw" {
  const content: string;
  export default content;
}

// Vite's `import.meta.glob` (vinext and Vitest alike), typed for the lazy form this package uses.
interface ImportMeta {
  glob(pattern: string, options: { query?: string; import?: string; eager?: false }): Record<string, () => Promise<unknown>>;
}
