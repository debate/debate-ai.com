import { notFound } from 'next/navigation';
import { getPosts } from '@debate-ai/help-docs/lib/blog';
import { blogSource } from '@debate-ai/help-docs/lib/fumadocs/source';

export function generateStaticParams() {
  return getPosts(blogSource.getPages()).map((post) => ({
    slug: post.url.split('/').filter(Boolean).slice(1),
  }));
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const page = blogSource.getPage(slug);

  if (!page) notFound();

  const data = page.data as any;
  const { body: MDX, toc } = await data.load();

  return (
    <main className="mx-auto max-w-3xl py-16">
      <h1 className="text-4xl font-semibold">{page.data.title}</h1>
      <p className="text-muted-foreground">{page.data.description}</p>

      <article className="prose mt-10">
        <MDX />
      </article>
    </main>
  );
}