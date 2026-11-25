import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
  metaSchema,
  defineCollections,
} from 'fumadocs-mdx/config';
import lastModified from 'fumadocs-mdx/plugins/last-modified';
import { remarkMdxFiles } from 'fumadocs-core/mdx-plugins/remark-mdx-files';
import { fileURLToPath } from 'node:url';
import { blogPageSchema } from './lib/blog';
import { remarkDebateHighlight } from './lib/mdx/remark-debate-highlight';
import { rehypeCitationCards } from './lib/mdx/rehype-citation-cards';
import { remarkDropTitleHeading } from './lib/mdx/remark-drop-title-heading';
import { gitLastModified } from './lib/mdx/git-last-modified';

export const docs = defineDocs({
  // Absolute, because fumadocs-mdx resolves `dir` against the root of whatever
  // build loads this config — the web app's, whose Vite plugin compiles these
  // docs (apps/debate-ai.com/vite.config.ts), not this package's.
  dir: fileURLToPath(new URL('./content/docs', import.meta.url)),
  docs: {
    schema: frontmatterSchema,
    // Only frontmatter is bundled eagerly; each page's compiled MDX, TOC and
    // Markdown load when that page is rendered (`page.data.load()`). Eager,
    // every /docs request pulled all ~9 MB of compiled pages into the
    // Worker isolate, which is shared with the rest of the site and capped at
    // 128 MB.
    async: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

// The developer docs (`dev-docs/`): their own collection, loader and page
// tree (lib/fumadocs/dev-source.tsx), served unlisted at /docs/dev. Kept out of
// `docs` so none of their pages reach the user docs' sidebar, search, sitemap
// or llms.txt.
export const devDocs = defineDocs({
  dir: fileURLToPath(new URL('./dev-docs', import.meta.url)),
  docs: {
    schema: frontmatterSchema,
    // Lazy for the same reason as `docs`: the schema pages alone are large.
    async: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export const blog = defineCollections({
  type: 'doc',
  dir: fileURLToPath(new URL('./content/blog', import.meta.url)),
  schema: blogPageSchema,
});

export default defineConfig({
  // Every docs page's last Git commit date, exposed as `lastModified` on
  // `await page.data.load()` and shown as "Last revised" (routes/docs-page.tsx,
  // routes/dev-docs-page.tsx). Our own Git reader rather than the plugin's
  // `'git'` mode, so a shallow clone gives no dates instead of the build date
  // on every page, and a shallow clone (Cloudflare Workers Builds) fetches its
  // history first (lib/mdx/git-last-modified.ts). Blog posts get it too
  // (apps/debate-web/app/blog/[slug]/page.tsx).
  plugins: [
    lastModified({
      versionControl: gitLastModified(fileURLToPath(new URL('.', import.meta.url)), { deepen: true }),
      filter: (collection) => collection === 'docs' || collection === 'devDocs' || collection === 'blog',
    }),
  ],
  mdxOptions: {
    remarkPlugins: [remarkMdxFiles, remarkDebateHighlight, remarkDropTitleHeading],
    // After the defaults, so the processed Markdown (llms.txt, Copy Markdown)
    // keeps citations as plain text.
    rehypePlugins: [rehypeCitationCards],
    remarkImageOptions: {
      onError: 'ignore',
    },
  },
});