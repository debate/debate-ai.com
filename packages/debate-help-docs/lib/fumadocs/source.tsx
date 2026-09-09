/**
 * @file source.tsx
 * @description Fumadocs source loader configuration and page structure.
 */
import { docs } from 'fumadocs-mdx:collections/server'
import {
  type InferMetaType,
  type InferPageType,
  type LoaderPlugin,
  loader,
} from 'fumadocs-core/source'
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons'
import { openapiPlugin } from 'fumadocs-openapi/server'
import { withBasePath } from './base-path'

export const source = loader({
  // Routes live at this app's root and reach `/docs/…` through `basePath`
  // (see lib/fumadocs/base-path.ts), so page URLs must not repeat the prefix.
  baseUrl: '/',
  plugins: [pageTreeCodeTitles(), lucideIconsPlugin(), openapiPlugin()],
  source: docs.toFumadocsSource(),
})

function pageTreeCodeTitles(): LoaderPlugin {
  return {
    transformPageTree: {
      file(node) {
        if (
          typeof node.name === 'string' &&
          (node.name.endsWith('()') || node.name.match(/^<\w+ \/>$/))
        ) {
          return {
            ...node,
            name: <code className='text-[0.8125rem]'>{node.name}</code>,
          }
        }
        return node
      },
    },
  }
}


/**
 * Origin-absolute URL of a page's processed Markdown, served by
 * `app/llms.mdx/[...slug]/route.ts`.
 *
 * The prefix is baked in rather than left to `basePath` because the callers
 * (`LLMCopyButton`, `AskAIDropdown`) `fetch` it and resolve it against
 * `window.location.origin` — neither goes through the router. The docs root
 * has no slug of its own, so it is addressed as `index.mdx`.
 *
 * @param page - The page to link to.
 */
export function pageMarkdownUrl(page: InferPageType<typeof source>): string {
  const slugs = page.slugs.length > 0 ? page.slugs : ['index'];
  return withBasePath(`/llms.mdx/${slugs.join('/')}.mdx`);
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText('processed');

  return `# ${page.data.title} (${page.url})

${processed}`;
}

export type Page = InferPageType<typeof source>
export type Meta = InferMetaType<typeof source>
