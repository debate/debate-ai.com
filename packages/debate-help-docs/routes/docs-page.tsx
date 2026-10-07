/**
 * @file docs-page.tsx
 * @description Dynamic documentation page component that renders MDX content,
 * mounted by the web app at `app/docs/(pages)/[[...slug]]/page.tsx`.
 */
import { pageMarkdownUrl, source } from '../lib/fumadocs/source';
import { DocsBody, DocsPage } from 'fumadocs-ui/page';
import { notFound, permanentRedirect } from 'next/navigation';
import { getMDXComponents } from '../mdx-components';
import type { Metadata } from 'next';
import { AskAIDropdown } from '../components/fumadocs/ai/ask-ai-dropdown';
import { LLMCopyButton } from '../components/fumadocs/ai/llm-copy-button';
import { docsConfig } from '../lib/fumadocs/customize-docs';
import { getGithubLastEdit } from 'fumadocs-core/content/github';

/** Lookups already made by this Worker isolate, keyed by content path. */
const lastEditCache = new Map<string, Promise<Date | undefined>>();

/**
 * Last-edit timestamp for a page, from the GitHub commits API.
 *
 * Only attempted when a `GITHUB_TOKEN` is available: the unauthenticated API
 * allows 60 requests an hour, far fewer than the docs get views. Pages render
 * on request in the app's Worker, so each path is looked up at most once per
 * isolate and the answer reused. Any failure just hides the "last updated"
 * line.
 */
function lastEditFor(path: string): Promise<Date | undefined> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return Promise.resolve(undefined);
  let pending = lastEditCache.get(path);
  if (!pending) {
    pending = getGithubLastEdit({
      owner: 'debate',
      repo: 'debate-ai.com',
      path: `packages/debate-help-docs/content/docs/${path}`,
      token: `Bearer ${token}`,
    }).then(
      (date) => date ?? undefined,
      () => undefined,
    );
    lastEditCache.set(path, pending);
  }
  return pending;
}

/**
 * The page a pre-regrouping feature URL now lives at.
 *
 * Feature pages used to sit flat at `features/<slug>`; they now live one level
 * down in a group folder (`features/<group>/<slug>`). In-app help links and
 * bookmarks still use the flat form, so a `features/<slug>` miss resolves to
 * the one grouped page with that file name, if exactly one exists.
 */
function movedFeaturePage(slug: string[] | undefined) {
  if (slug?.length !== 2 || slug[0] !== 'features') return undefined;
  const matches = source
    .getPages()
    .filter((page) => page.slugs.length === 3 && page.slugs[0] === 'features' && page.slugs[2] === slug[1]);
  return matches.length === 1 ? matches[0] : undefined;
}

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) {
    const moved = movedFeaturePage(params.slug);
    if (moved) permanentRedirect(moved.url);
    notFound();
  }

  const data = page.data as any;
  // The collection is `async` (source.config.ts): the body loads per page.
  const [{ body: MDX, toc }, lastUpdate] = await Promise.all([
    page.data.load(),
    lastEditFor(page.path),
  ]);
  const markdownUrl = pageMarkdownUrl(page);

  // No page header (breadcrumb, title, description): pages open with their own
  // `#` heading, so the page starts with the Copy / Ask AI buttons.
  return (
    <DocsPage
      toc={toc}
      full={data.full}
      lastUpdate={lastUpdate}
      breadcrumb={{ enabled: false }}
    >
      <DocsBody>
        <div className="flex flex-row gap-2 items-center border-b pt-2 pb-6">
          <LLMCopyButton markdownUrl={markdownUrl} />
          <AskAIDropdown
            markdownUrl={markdownUrl}
            githubUrl={docsConfig.githubDocs ? `${docsConfig.githubDocs}/${page.path}` : undefined}
          />
        </div>

        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug) ?? movedFeaturePage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  } satisfies Metadata;
}
