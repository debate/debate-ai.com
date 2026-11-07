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
import { AskAIButton } from 'ask-ai-button';
import { Sparkles } from 'lucide-react';
import { LLMCopyButton } from '../components/fumadocs/ai/llm-copy-button';
import { HighlightToggle } from '../components/guides/highlight-toggle';
import { VoiceReadButton } from '../components/guides/voice-read-button';
import { PageSuggestedQuestions, SuggestQuestionsToggle } from '../components/guides/suggest-questions';
import { ReadingModeButton } from '../components/guides/reading-mode';
import { DOCS_AI_PROVIDERS } from '../lib/fumadocs/ask-ai-providers';
import { sectionPages, sectionTitle } from '../lib/fumadocs/section-pages';
import { isSynergySlayerPage, SYNERGY_SLAYER_CLASS } from '../lib/mdx/remark-debate-highlight';
import { docsConfig } from '../lib/fumadocs/customize-docs';
import { getGithubLastEdit } from 'fumadocs-core/content/github';
import { DocsPageHeader } from '../components/fumadocs/layout/docs-page-header';
import { getPageBreadcrumbs } from '../lib/fumadocs/page-breadcrumbs';

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
  // Card underlining and highlights, and their toggle, are Synergy Slayer only.
  const synergySlayer = isSynergySlayerPage(page.path);
  // Reading mode shows every page of the paper (this page's folder) at once.
  const readingPages = synergySlayer ? sectionPages(page.path) : [];
  const readingTitle = synergySlayer ? (sectionTitle(page.path) ?? data.title) : '';

  // Fumadocs' own header stays off: ours (breadcrumbs with hover dropdowns,
  // then the title) replaces it, and a body `#` heading that repeats the
  // title is dropped at compile time (lib/mdx/remark-drop-title-heading.ts).
  return (
    <DocsPage
      toc={toc}
      full={data.full}
      lastUpdate={lastUpdate}
      breadcrumb={{ enabled: false }}
    >
      <DocsBody>
        <DocsPageHeader
          title={data.title}
          breadcrumbs={getPageBreadcrumbs(source.pageTree, page.url)}
        />
        <div className="flex flex-row flex-wrap gap-2 items-center border-b pt-2 pb-6">
          <LLMCopyButton markdownUrl={markdownUrl} />
          <AskAIButton
            markdownUrl={markdownUrl}
            title={data.title}
            providers={DOCS_AI_PROVIDERS}
            icon={<Sparkles className="size-3.5" aria-hidden />}
            githubUrl={docsConfig.githubDocs ? `${docsConfig.githubDocs}/${page.path}` : undefined}
          />
          {synergySlayer && (
            <>
              <HighlightToggle />
              <VoiceReadButton />
              <SuggestQuestionsToggle />
              <ReadingModeButton title={readingTitle} pages={readingPages} />
            </>
          )}
        </div>

        {synergySlayer ? (
          <div className={SYNERGY_SLAYER_CLASS}>
            <MDX components={getMDXComponents()} />
          </div>
        ) : (
          <MDX components={getMDXComponents()} />
        )}
        {synergySlayer && <PageSuggestedQuestions key={page.url} />}
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
