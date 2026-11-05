/**
 * @file dev-docs-page.tsx
 * @description A developer docs page, mounted by the web app at
 * `app/docs/dev/[[...slug]]/page.tsx`. Same shape as `docs-page.tsx`, read
 * from the developer source, with relative links between the Markdown files
 * (`./deploy.md`, `../database/app-schema.md`) resolved to their page URLs.
 */
import type { ComponentProps } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsBody, DocsPage } from 'fumadocs-ui/page';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { getMDXComponents } from '../mdx-components';
import { AskAIButton } from 'ask-ai-button';
import { Sparkles } from 'lucide-react';
import { LLMCopyButton } from '../components/fumadocs/ai/llm-copy-button';
import { DOCS_AI_PROVIDERS } from '../lib/fumadocs/ask-ai-providers';
import { devPageMarkdownUrl, devSource, type DevPage } from '../lib/fumadocs/dev-source';

/** `a` that turns a link to a sibling Markdown file into that page's URL. */
function relativeLink(page: DevPage) {
  const Link = defaultMdxComponents.a;
  return function RelativeLink({ href, ...props }: ComponentProps<'a'>) {
    return <Link href={href ? devSource.resolveHref(href, page) : href} {...props} />;
  };
}

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await props.params;
  const page = devSource.getPage(slug);
  if (!page) notFound();

  const { body: MDX, toc } = await page.data.load();
  const markdownUrl = devPageMarkdownUrl(page);

  return (
    <DocsPage toc={toc} full={page.data.full} breadcrumb={{ enabled: false }}>
      <DocsBody>
        <div className="flex flex-row gap-2 items-center border-b pt-2 pb-6">
          <LLMCopyButton markdownUrl={markdownUrl} />
          <AskAIButton
            markdownUrl={markdownUrl}
            title={page.data.title}
            providers={DOCS_AI_PROVIDERS}
            icon={<Sparkles className="size-3.5" aria-hidden />}
          />
        </div>
        <MDX components={getMDXComponents({ a: relativeLink(page) })} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return devSource.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await props.params;
  const page = devSource.getPage(slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  } satisfies Metadata;
}
