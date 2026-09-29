import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
  metaSchema,
} from 'fumadocs-mdx/config';
import { remarkMdxFiles } from 'fumadocs-core/mdx-plugins/remark-mdx-files';
import { fileURLToPath } from 'node:url';

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

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMdxFiles],
    remarkImageOptions: {
      onError: 'ignore',
    },
  },
});