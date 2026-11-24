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
import { AutoMarkButton, MarksMenu } from '../components/guides/highlight-toggle';
import { VoiceReadButton } from '../components/guides/voice-read-button';
import { PageSuggestedQuestions, SuggestQuestionsToggle } from '../components/guides/suggest-questions';
import { ReadingModeButton } from '../components/guides/reading-mode';
import { ReferencesPanelButton } from '../components/guides/references-panel';
import { PageExportMenu } from '../components/guides/export-menu';
import { DOCS_AI_PROVIDERS } from '../lib/fumadocs/ask-ai-providers';
import { sectionPages, sectionTitle } from '../lib/fumadocs/section-pages';
import { isSynergySlayerPage, SYNERGY_SLAYER_CLASS } from '../lib/mdx/remark-debate-highlight';
import { docsConfig } from '../lib/fumadocs/customize-docs';
import { getGithubLastEdit } from 'fumadocs-core/content/github';
import { DocsPageHeader } from '../components/fumadocs/layout/docs-page-header';
import { LastRevised } from '../components/fumadocs/layout/last-revised';
import { getPageBreadcrumbs } from '../lib/fumadocs/page-breadcrumbs';
import { InlinePageToc } from '../components/fumadocs/layout/inline-page-toc';
import { hasInlineToc } from '../lib/fumadocs/inline-toc';
import { HeaderToolbar, ToolbarItem } from '../components/fumadocs/layout/header-toolbar';
import { PageInfoButton } from '../components/guides/page-info';
import { pageStats } from '../lib/fumadocs/page-stats';
import { PageFlowChartButton } from '@debate-ai/videos/page-flow-chart';
import { buttonVariants } from '../components/ui/button';

/** Lookups already made by this Worker isolate, keyed by content path. */
const lastEditCache = new Map<string, Promise<Date | undefined>>();

/**
 * Last-edit timestamp for a page, from the GitHub commits API. Fallback only:
 * the date normally comes from Git at build time (`lastModified` on the loaded
 * page, source.config.ts); builds from a shallow clone have none.
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
  const loaded = await page.data.load();
  const { body: MDX, toc } = loaded;
  const markdownUrl = pageMarkdownUrl(page);
  // Card underlining and highlights, and their toggle, are Synergy Slayer only.
  const synergySlayer = isSynergySlayerPage(page.path);
  // The Synergy-style papers (Synergy Slayer, Synergy Slayer of Critiques,
  // Collective Consciousness) read as finished papers: no "Last revised" line.
  const lastRevised = synergySlayer
    ? undefined
    : ((loaded as { lastModified?: Date }).lastModified ?? (await lastEditFor(page.path)));
  // Reading mode shows every page of the paper (this page's folder) at once.
  const readingPages = synergySlayer ? sectionPages(page.path) : [];
  const readingTitle = synergySlayer ? (sectionTitle(page.path) ?? data.title) : '';
  // The Info button's counts, from the processed Markdown (no work in the browser).
  const stats = pageStats(await page.data.getText('processed'), toc);
  const edited = (loaded as { lastModified?: Date | string }).lastModified ?? lastRevised;
  const lastUpdated = edited ? new Date(edited).toISOString() : undefined;

  // Fumadocs' own header stays off: ours (breadcrumbs with hover dropdowns,
  // then the title) replaces it, and a body `#` heading that repeats the
  // title is dropped at compile time (lib/mdx/remark-drop-title-heading.ts).
  return (
    <DocsPage
      toc={toc}
      full={data.full}
      breadcrumb={{ enabled: false }}
    >
      <DocsBody>
        <DocsPageHeader
          title={data.title}
          breadcrumbs={getPageBreadcrumbs(source.pageTree, page.url)}
        />
        {/* Shown in the header after the search box (inline on small screens):
            large icons with tiny labels, each named again in a tooltip. */}
        <HeaderToolbar>
          <ToolbarItem label="Copy" tip="Copy this page as Markdown, for pasting into an AI">
            <LLMCopyButton markdownUrl={markdownUrl} />
          </ToolbarItem>
          <ToolbarItem label="Ask AI" tip="Ask an AI about this page">
            <AskAIButton
              markdownUrl={markdownUrl}
              title={data.title}
              providers={DOCS_AI_PROVIDERS}
              icon={<Sparkles className="size-3.5" aria-hidden />}
              githubUrl={docsConfig.githubDocs ? `${docsConfig.githubDocs}/${page.path}` : undefined}
            />
          </ToolbarItem>
          {synergySlayer && (
            <>
              <ToolbarItem label="Marks">
                <MarksMenu />
              </ToolbarItem>
              <ToolbarItem label="Auto highlight">
                <AutoMarkButton kind="highlight" />
              </ToolbarItem>
              <ToolbarItem label="Auto underline">
                <AutoMarkButton kind="underline" />
              </ToolbarItem>
              <ToolbarItem label="Voice">
                <VoiceReadButton />
              </ToolbarItem>
              <ToolbarItem label="References">
                <ReferencesPanelButton />
              </ToolbarItem>
              <ToolbarItem label="Questions">
                <SuggestQuestionsToggle />
              </ToolbarItem>
              <ToolbarItem label="Reading mode">
                <ReadingModeButton title={readingTitle} pages={readingPages} />
              </ToolbarItem>
              <ToolbarItem label="Export">
                <PageExportMenu title={data.title} />
              </ToolbarItem>
            </>
          )}
          <ToolbarItem label="Info">
            <PageInfoButton stats={stats} lastUpdated={lastUpdated} showHighlights={synergySlayer} />
          </ToolbarItem>
          {/* Last: the watch page's AI flow chart, drawn from just this page. */}
          <ToolbarItem label="Flow chart">
            <PageFlowChartButton
              pageKey={page.url}
              title={data.title}
              markdownUrl={markdownUrl}
              className={buttonVariants({ size: 'sm', className: 'gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground' })}
            />
          </ToolbarItem>
        </HeaderToolbar>

        {/* Debate Basics pages are long: list their sections up front, in the body. */}
        {hasInlineToc(page.slugs) && <InlinePageToc toc={toc} />}

        {synergySlayer ? (
          <div className={SYNERGY_SLAYER_CLASS}>
            <MDX components={getMDXComponents()} />
          </div>
        ) : (
          <MDX components={getMDXComponents()} />
        )}
        {/* At the end of every page, after the content (none on the papers). */}
        <LastRevised date={lastRevised} />
        {synergySlayer && <PageSuggestedQuestions key={page.url} />}
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

/** Metadata for a /docs URL with no page; the page itself answers 404. */
const NOT_FOUND_METADATA = {
  title: 'Page not found',
  robots: { index: false },
} satisfies Metadata;

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug) ?? movedFeaturePage(params.slug);
  // A miss is a 404, not a fault: the page component calls notFound() and
  // serves it. Throwing here as well would record every stray /docs URL as
  // an error span (NEXT_NOT_FOUND) in Workers observability.
  if (!page) return NOT_FOUND_METADATA;

  return {
    title: page.data.title,
    description: page.data.description,
  } satisfies Metadata;
}
