/**
 * @file dev-llms-mdx-route.ts
 * @description A developer docs page's processed Markdown, for its "Copy"
 * button. Mounted by the web app at `app/docs/dev/llms.mdx/[...slug]/route.ts`;
 * addressed exactly like `llms-mdx-route.ts` (`setup/deploy` →
 * `/docs/dev/llms.mdx/setup/deploy.mdx`, the root as `index.mdx`).
 */
import { notFound } from "next/navigation";
import { devSource, getDevLLMText } from "../lib/fumadocs/dev-source";

export const revalidate = false;

const ROOT_SLUG = "index";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const cleanSlug = slug.map((s, i) => (i === slug.length - 1 ? s.replace(/\.mdx$/, "") : s));
  const page = devSource.getPage(cleanSlug.length === 1 && cleanSlug[0] === ROOT_SLUG ? [] : cleanSlug);
  if (!page) notFound();

  return new Response(await getDevLLMText(page), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
  });
}

export function generateStaticParams() {
  return devSource.generateParams().map(({ slug }) => {
    const path = slug.length > 0 ? slug : [ROOT_SLUG];
    return { slug: path.map((s, i) => (i === path.length - 1 ? `${s}.mdx` : s)) };
  });
}
