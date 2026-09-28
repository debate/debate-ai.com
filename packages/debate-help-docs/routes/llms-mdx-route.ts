/**
 * @file llms-mdx-route.ts
 * @description Serves any docs page's processed Markdown, for the "Copy" and
 * "Ask AI" buttons on that page. Mounted by the web app at
 * `app/docs/llms.mdx/[...slug]/route.ts`.
 *
 * The URL is the page's own slug plus `.mdx` (`features/drill-sets` →
 * `/docs/llms.mdx/features/drill-sets.mdx`); the docs root has no slug of its
 * own and is addressed as `index.mdx`. The extension keeps every URL
 * file-shaped, so a section index (`features`) and the pages inside it
 * (`features/drill-sets`) never need to be both a file and a directory when a
 * response is cached or prerendered by path — which is also why this is a
 * required catch-all rather than an optional one.
 */
import { getLLMText, source } from "../lib/fumadocs/source";
import { notFound } from "next/navigation";

export const revalidate = false;

/** The stand-in slug for the docs root, which fumadocs addresses as `[]`. */
const ROOT_SLUG = "index";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const cleanSlug = slug.map((s, i) =>
    i === slug.length - 1 ? s.replace(/\.mdx$/, "") : s,
  );
  const page = source.getPage(
    cleanSlug.length === 1 && cleanSlug[0] === ROOT_SLUG ? [] : cleanSlug,
  );
  if (!page) notFound();

  return new Response(await getLLMText(page), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export function generateStaticParams() {
  return source.generateParams().map(({ slug }) => {
    const path = slug.length > 0 ? slug : [ROOT_SLUG];
    return { slug: path.map((s, i) => (i === path.length - 1 ? `${s}.mdx` : s)) };
  });
}
