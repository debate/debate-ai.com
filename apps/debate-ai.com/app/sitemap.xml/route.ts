import { NextResponse } from "next/server";
import { getVideoPage } from "@/lib/videos/video-repository";
import { videoRouteHref, videoWatchHref } from "debate-videos";

const BASE_URL = "https://d.ebate.app";

export const dynamic = "force-dynamic";

export async function GET() {
  const videos: unknown[] = [];
  let hasMore = true;
  let offset = 0;
  const limit = 1000;

  while (hasMore) {
    const page = await getVideoPage({ source: "all", limit, offset });
    videos.push(...page.videos);
    hasMore = page.hasMore;
    offset += page.videos.length;
    if (videos.length > 50000) break;
  }

  const urls = new Set<string>();
  for (const video of videos) {
    const canonical = videoRouteHref(video as Parameters<typeof videoRouteHref>[0]);
    const watch = videoWatchHref((video as any)[1] as string);
    urls.add(`${BASE_URL}${canonical}`);
    urls.add(`${BASE_URL}${watch}`);
  }

  const urlEntries = [...urls]
    .sort()
    .map(
      (url) => `  <url>
    <loc>${url}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
