/**
 * @file page.tsx
 * @description Dynamic documentation page component that renders MDX content.
 */
import { source } from '@/lib/fumadocs/source';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/mdx-components';
import type { Metadata } from 'next';
import { AskAIDropdown } from '@/components/fumadocs/ai/ask-ai-dropdown';
import { LLMCopyButton } from '@/components/fumadocs/ai/llm-copy-button';
import { Breadcrumb } from '@/components/fumadocs/layout/breadcrumb';
import { docsConfig } from '@/lib/fumadocs/customize-docs';
import { getGithubLastEdit } from 'fumadocs-core/content/github';

/**
 * Last-edit timestamp for a page, from the GitHub commits API.
 *
 * Only attempted when a `GITHUB_TOKEN` is available: the unauthenticated API
 * allows 60 requests an hour, and a static build renders well over 100
 * pages, so without a token the lookup would fail part-way through and slow
 * the build for nothing. Any failure just hides the "last updated" line.
 */
async function lastEditFor(path: string): Promise<Date | undefined> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return undefined;
  try {
    const date = await getGithubLastEdit({
      owner: 'debate',
      repo: 'debate-ai.com',
      path: `packages/debate-help-docs/content/docs/${path}`,
      token: `Bearer ${token}`,
    });
    return date ?? undefined;
  } catch {
    return undefined;
  }
}

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) {
    notFound();
  }

  const data = page.data as any;
  const MDX = data.body;
  const lastUpdate = await lastEditFor(page.path);

  return (
    <DocsPage toc={data.toc} full={data.full} lastUpdate={lastUpdate}>
      <Breadcrumb tree={source.pageTree} />
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <div className="flex flex-row gap-2 items-center border-b pt-2 pb-6">
          <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
          <AskAIDropdown
            markdownUrl={`${page.url}.mdx`}
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
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  } satisfies Metadata;
}
