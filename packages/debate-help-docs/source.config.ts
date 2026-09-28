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