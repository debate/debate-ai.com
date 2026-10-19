/**
 * Which detected URLs the admin URL Detection tab offers to open in reader
 * mode (`SourceArticlePanel` from `@debate/research-evidence`).
 *
 * `detected_urls` does not record whether a page was an article, so this goes
 * by the URL alone: a web page with a path, minus the kinds of page that never
 * extract into a readable article (search results, video, social feeds, web
 * apps). It is a guess, not a promise — the reader still says so when
 * qwksearch finds no article text.
 */

/** Hosts whose pages are apps, feeds or video, never articles. */
const NON_ARTICLE_HOSTS = [
  /(^|\.)youtube\.com$/,
  /^youtu\.be$/,
  /(^|\.)google\.[a-z.]+$/,
  /(^|\.)bing\.com$/,
  /(^|\.)duckduckgo\.com$/,
  /(^|\.)search\.brave\.com$/,
  /(^|\.)ecosia\.org$/,
  /(^|\.)x\.com$/,
  /(^|\.)twitter\.com$/,
  /(^|\.)facebook\.com$/,
  /(^|\.)instagram\.com$/,
  /(^|\.)tiktok\.com$/,
  /(^|\.)github\.com$/,
  /(^|\.)tabroom\.com$/,
  /(^|\.)debate-ai\.com$/,
  /(^|\.)ebate\.app$/,
  /^localhost$/,
];

/**
 * Whether `url` looks like an article worth opening in reader mode.
 *
 * Google's article-hosting subdomains (`news.google.com` redirects, `docs`,
 * `drive`) are apps too, so the whole `google.*` family is excluded.
 */
export function isLikelyArticleUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (NON_ARTICLE_HOSTS.some((pattern) => pattern.test(host))) return false;
  // A bare domain is a homepage, not an article.
  return parsed.pathname.replace(/\/+$/, "").length > 0;
}
