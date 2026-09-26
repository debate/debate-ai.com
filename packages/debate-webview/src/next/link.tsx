/**
 * @fileoverview `next/link` for hosts that aren't Next — an `<a>` whose
 * in-app `href` is written into the URL fragment. See `./navigation.tsx`.
 */

import { forwardRef, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react"

import { isExternalHref, navigate, toFragmentHref } from "../host/history"

type UrlObject = {
  pathname?: string | null
  query?: Record<string, string | number | boolean | readonly (string | number | boolean)[] | null | undefined> | string | null
  hash?: string | null
}

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | UrlObject
  replace?: boolean
  scroll?: boolean
  prefetch?: boolean | null
  shallow?: boolean
  passHref?: boolean
  legacyBehavior?: boolean
  locale?: string | false
  children?: ReactNode
}

function formatHref(href: string | UrlObject): string {
  if (typeof href === "string") return href
  let query = ""
  if (typeof href.query === "string") query = href.query
  else if (href.query) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(href.query)) {
      if (value == null) continue
      for (const v of Array.isArray(value) ? value : [value]) params.append(key, String(v))
    }
    query = params.toString()
  }
  const hash = href.hash ? `#${href.hash.replace(/^#/, "")}` : ""
  return `${href.pathname ?? ""}${query ? `?${query.replace(/^\?/, "")}` : ""}${hash}`
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, replace, scroll: _scroll, prefetch: _prefetch, shallow: _shallow, passHref: _passHref, legacyBehavior: _legacy, locale: _locale, onClick, target, children, ...rest },
  ref,
) {
  const url = formatHref(href)
  const external = isExternalHref(url)

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (event.defaultPrevented || external) return
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (target && target !== "_self") return
    event.preventDefault()
    navigate(url, { replace })
  }

  return (
    <a ref={ref} href={toFragmentHref(url)} target={target} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
})

export default Link
