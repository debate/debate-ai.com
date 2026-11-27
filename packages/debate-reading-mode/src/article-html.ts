/**
 * @file article-html.ts
 * @description Sanitizes article markup that came from somewhere other than
 * the page itself — a server-side extractor's answer — before it is shown in
 * reading mode. Allowlist based, in a DOM that never runs scripts: only
 * reading tags and a few attributes survive, links open in a new tab, and
 * only `http(s)` links and images (or inline images) keep their address.
 *
 * Browser only (`DOMParser`); the same allowlist as the browser extension's
 * article sanitizer.
 */

const DROP = "script,style,noscript,template,link,meta,iframe,object,embed,canvas,svg,math,form,input,button,select,textarea,dialog,video,audio,base"

const ALLOWED_TAGS = new Set([
  "A", "P", "BR", "HR", "IMG", "FIGURE", "FIGCAPTION", "PICTURE", "SOURCE",
  "H1", "H2", "H3", "H4", "H5", "H6",
  "UL", "OL", "LI", "DL", "DT", "DD",
  "BLOCKQUOTE", "PRE", "CODE", "Q", "CITE",
  "STRONG", "B", "EM", "I", "U", "S", "SUB", "SUP", "MARK", "SMALL", "ABBR", "TIME",
  "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TH", "TD", "CAPTION", "COLGROUP", "COL",
  "DIV", "SPAN", "SECTION", "ARTICLE", "MAIN", "HEADER", "FOOTER",
])

const ALLOWED_ATTRS: Record<string, string[]> = {
  A: ["href", "title"],
  IMG: ["src", "srcset", "alt", "title", "width", "height"],
  SOURCE: ["srcset", "type", "media"],
  TIME: ["datetime"],
  TD: ["colspan", "rowspan"],
  TH: ["colspan", "rowspan", "scope"],
  COL: ["span"],
  COLGROUP: ["span"],
}

const URL_ATTRS = new Set(["href", "src"])

/** A URL safe to render, absolute against `baseUrl`, or `null`. */
export function safeUrl(value: string, baseUrl: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^data:image\/(?:png|jpe?g|gif|webp|avif);/i.test(trimmed)) return trimmed
  try {
    const url = new URL(trimmed, baseUrl)
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null
  } catch {
    return null
  }
}

function srcsetUrls(value: string, baseUrl: string): string | null {
  const parts = value
    .split(",")
    .map((part) => part.trim().split(/\s+/))
    .map(([url, descriptor]) => [safeUrl(url ?? "", baseUrl), descriptor] as const)
    .filter(([url]) => url !== null && !url.startsWith("data:"))
    .map(([url, descriptor]) => (descriptor ? `${url} ${descriptor}` : url))
  return parts.length ? parts.join(", ") : null
}

function clean(node: Node, out: Document, baseUrl: string): Node | null {
  if (node.nodeType === 3) return out.createTextNode(node.nodeValue ?? "")
  if (node.nodeType !== 1) return null
  const el = node as Element

  if (!ALLOWED_TAGS.has(el.tagName)) {
    const fragment = out.createDocumentFragment()
    el.childNodes.forEach((child) => {
      const kept = clean(child, out, baseUrl)
      if (kept) fragment.appendChild(kept)
    })
    return fragment
  }

  const target = out.createElement(el.tagName.toLowerCase())
  for (const attr of ALLOWED_ATTRS[el.tagName] ?? []) {
    const value = el.getAttribute(attr)
    if (value === null) continue
    if (URL_ATTRS.has(attr)) {
      const url = safeUrl(value, baseUrl)
      if (url) target.setAttribute(attr, url)
    } else if (attr === "srcset") {
      const set = srcsetUrls(value, baseUrl)
      if (set) target.setAttribute(attr, set)
    } else {
      target.setAttribute(attr, value)
    }
  }
  if (el.tagName === "A") {
    target.setAttribute("target", "_blank")
    target.setAttribute("rel", "noopener noreferrer nofollow")
  }
  if (el.tagName === "IMG") {
    target.setAttribute("loading", "lazy")
    target.setAttribute("referrerpolicy", "no-referrer")
    if (!target.getAttribute("src")) return null
  }
  el.childNodes.forEach((child) => {
    const kept = clean(child, out, baseUrl)
    if (kept) target.appendChild(kept)
  })
  return target
}

/**
 * The sanitized markup and word count of `html`, with relative links resolved
 * against `baseUrl`; `null` when nothing readable is left.
 */
export function sanitizeArticleHtml(html: string, baseUrl: string): { html: string; wordCount: number } | null {
  const source = new DOMParser().parseFromString(html, "text/html")
  source.querySelectorAll(DROP).forEach((el) => el.remove())
  const out = document.implementation.createHTMLDocument("")
  const holder = out.createElement("div")
  source.body.childNodes.forEach((child) => {
    const kept = clean(child, out, baseUrl)
    if (kept) holder.appendChild(kept)
  })
  const body = holder.innerHTML
  const words = body.replace(/<[^>]*>/g, " ").match(/\S+/g)?.length ?? 0
  if (words === 0) return null
  return { html: body, wordCount: words }
}
