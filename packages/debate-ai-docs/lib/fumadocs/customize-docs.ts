/**
 * @file customize-docs.ts
 * @description Documentation configuration object and types.
 */
export const docsConfig: DocsConfig = {
  title: "Debate AI Docs",
  description: "Documentation for debate-ai.com — CARDS, FIAT, LEARN, STREAM, and REASON",
  github: "https://github.com/debate/debate-ai.com",
  githubPackages: "https://github.com/debate/debate-ai.com/tree/master/packages",
  githubDocs:
    "https://github.com/debate/debate-ai.com/tree/master/packages/debate-ai-docs/content/docs",
  favicon: "/favicon.ico",
  topLinks: [
    {
      text: "Docs",
      url: "/docs",
    },
    {
      text: "GitHub",
      url: "https://github.com/debate/debate-ai.com",
      external: true,
    },
  ],
};

export interface DocsConfig {
  /** The title of the documentation site */
  title?: string;
  /** A short description of the project */
  description?: string;
  /** URL to the GitHub repository */
  github?: string;
  /** Base URL for editing the docs pages on GitHub */
  githubDocs?: string;
  /** Base URL for the packages directory on GitHub */
  githubPackages?: string;
  /** Path to the favicon */
  favicon?: string;
  /** Path to the OpenAPI specification file */
  apiDocsPath?: string;
  /** Links to be displayed in the navigation bar */
  topLinks?: {
    text: string;
    url: string;
    external?: boolean;
  }[];
}
