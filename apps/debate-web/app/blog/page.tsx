import { getPosts } from '@debate/help-docs/lib/blog';
import { blogSource } from '@debate/help-docs/lib/fumadocs/source';
import Link from 'next/link';

export default function BlogPage() {
  const posts = getPosts(blogSource.getPages());

  return (
    <main className="mx-auto max-w-3xl py-16">
      <h1 className="text-4xl font-semibold">Blog</h1>

      <div className="mt-10 space-y-8">
        {posts.map((post) => (
          <article key={post.url}>
            <Link href={post.url} className="text-2xl font-medium hover:underline">
              {post.title}
            </Link>
            <p className="text-muted-foreground">
              {post.description}
            </p>
          </article>
        ))}
      </div>
    </main>
  );
}