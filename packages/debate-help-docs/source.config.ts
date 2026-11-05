import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
  metaSchema,
  defineCollections,
} from 'fumadocs-mdx/config';
import { remarkMdxFiles } from 'fumadocs-core/mdx-plugins/remark-mdx-files';
import { fileURLToPath } from 'node:url';
import { blogPageSchema } from './lib/blog';
import { remarkDebateHighlight } from './lib/mdx/remark-debate-highlight';
import { rehypeCitationCards } from './lib/mdx/rehype-citation-cards';
import { remarkDropTitleHeading } from './lib/mdx/remark-drop-title-heading';

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