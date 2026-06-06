import { r as reactExports, t as toSameOriginAppPath, f as toBrowserNavigationHref, y as stripBasePath } from "../index.js";
import { a as addLocalePrefix, g as getDomainLocaleUrl, b as addQueryParam, u as urlQueryToSearchParams, c as appendSearchParamsToUrl } from "./template-DGSplFaZ.js";
import "../__vite_rsc_assets_manifest.js";
import "node:async_hooks";
const RouterContext = reactExports.createContext(null);
function isValidModulePath(p) {
  if (typeof p !== "string" || p.length === 0) return false;
  if (!p.startsWith("/") && !p.startsWith("./")) return false;
  if (p.startsWith("//")) return false;
  if (p.includes("://")) return false;
  if (p.includes("..")) return false;
  return true;
}
const __basePath = "";
function createRouterEvents() {
  const listeners = /* @__PURE__ */ new Map();
  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, /* @__PURE__ */ new Set());
      listeners.get(event).add(handler);
    },
    off(event, handler) {
      listeners.get(event)?.delete(handler);
    },
    emit(event, ...args) {
      listeners.get(event)?.forEach((handler) => handler(...args));
    }
  };
}
const routerEvents = createRouterEvents();
function resolveUrl(url) {
  if (typeof url === "string") return url;
  let result = url.pathname ?? "/";
  if (url.query) {
    const params = urlQueryToSearchParams(url.query);
    result = appendSearchParamsToUrl(result, params);
  }
  return result;
}
function resolveNavigationTarget(url, as, locale) {
  return applyNavigationLocale(as ?? resolveUrl(url), locale);
}
function getDomainLocales() {
  return window.__NEXT_DATA__?.domainLocales;
}
function getCurrentHostname() {
  return window.location?.hostname;
}
function getDomainLocalePath(url, locale) {
  return getDomainLocaleUrl(url, locale, {
    basePath: __basePath,
    currentHostname: getCurrentHostname(),
    domainItems: getDomainLocales()
  });
}
function applyNavigationLocale(url, locale) {
  if (!locale || typeof window === "undefined") return url;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) return url;
  const domainLocalePath = getDomainLocalePath(url, locale);
  if (domainLocalePath) return domainLocalePath;
  return addLocalePrefix(url, locale, window.__VINEXT_DEFAULT_LOCALE__ ?? "");
}
function isExternalUrl(url) {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//");
}
function resolveHashUrl(url) {
  if (typeof window === "undefined") return url;
  if (url.startsWith("#")) return stripBasePath(window.location.pathname, __basePath) + window.location.search + url;
  try {
    const parsed = new URL(url, window.location.href);
    return stripBasePath(parsed.pathname, __basePath) + parsed.search + parsed.hash;
  } catch {
    return url;
  }
}
function isHashOnlyChange(href) {
  if (href.startsWith("#")) return true;
  if (typeof window === "undefined") return false;
  try {
    const current = new URL(window.location.href);
    const next = new URL(href, window.location.href);
    return current.pathname === next.pathname && current.search === next.search && next.hash !== "";
  } catch {
    return false;
  }
}
function scrollToHash(hash) {
  if (!hash || hash === "#") {
    window.scrollTo(0, 0);
    return;
  }
  const el = document.getElementById(hash.slice(1));
  if (el) el.scrollIntoView({ behavior: "auto" });
}
function saveScrollPosition() {
  const state = window.history.state ?? {};
  window.history.replaceState({
    ...state,
    __vinext_scrollX: window.scrollX,
    __vinext_scrollY: window.scrollY
  }, "");
}
function restoreScrollPosition(state) {
  if (state && typeof state === "object" && "__vinext_scrollY" in state) {
    const { __vinext_scrollX: x, __vinext_scrollY: y } = state;
    requestAnimationFrame(() => window.scrollTo(x, y));
  }
}
let _ssrContext = null;
let _getSSRContext = () => _ssrContext;
let _setSSRContextImpl = (ctx) => {
  _ssrContext = ctx;
};
function _registerRouterStateAccessors(accessors) {
  _getSSRContext = accessors.getSSRContext;
  _setSSRContextImpl = accessors.setSSRContext;
}
function setSSRContext(ctx) {
  _setSSRContextImpl(ctx);
}
function extractRouteParamNames(pattern) {
  const names = [];
  const bracketMatches = pattern.matchAll(/\[{1,2}(?:\.\.\.)?([\w-]+)\]{1,2}/g);
  for (const m of bracketMatches) names.push(m[1]);
  if (names.length > 0) return names;
  const colonMatches = pattern.matchAll(/:([\w-]+)[+*]?/g);
  for (const m of colonMatches) names.push(m[1]);
  return names;
}
function getPathnameAndQuery() {
  if (typeof window === "undefined") {
    const _ssrCtx = _getSSRContext();
    if (_ssrCtx) {
      const query = {};
      for (const [key, value] of Object.entries(_ssrCtx.query)) query[key] = Array.isArray(value) ? [...value] : value;
      return {
        pathname: _ssrCtx.pathname,
        query,
        asPath: _ssrCtx.asPath
      };
    }
    return {
      pathname: "/",
      query: {},
      asPath: "/"
    };
  }
  const resolvedPath = stripBasePath(window.location.pathname, __basePath);
  const pathname = window.__NEXT_DATA__?.page ?? resolvedPath;
  const routeQuery = {};
  const nextData = window.__NEXT_DATA__;
  if (nextData && nextData.query && nextData.page) {
    const routeParamNames = extractRouteParamNames(nextData.page);
    for (const key of routeParamNames) {
      const value = nextData.query[key];
      if (typeof value === "string") routeQuery[key] = value;
      else if (Array.isArray(value)) routeQuery[key] = [...value];
    }
  }
  const searchQuery = {};
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of params) addQueryParam(searchQuery, key, value);
  return {
    pathname,
    query: {
      ...searchQuery,
      ...routeQuery
    },
    asPath: resolvedPath + window.location.search + window.location.hash
  };
}
var NavigationCancelledError = class extends Error {
  cancelled = true;
  constructor(route) {
    super(`Abort fetching component for route: "${route}"`);
    this.name = "NavigationCancelledError";
  }
};
var HardNavigationScheduledError = class extends Error {
  hardNavigationScheduled = true;
  constructor(message) {
    super(message);
    this.name = "HardNavigationScheduledError";
  }
};
let _navigationId = 0;
let _activeAbortController = null;
function scheduleHardNavigationAndThrow(url, message) {
  if (typeof window === "undefined") throw new HardNavigationScheduledError(message);
  window.location.href = url;
  throw new HardNavigationScheduledError(message);
}
async function navigateClient(url) {
  if (typeof window === "undefined") return;
  const root = window.__VINEXT_ROOT__;
  if (!root) {
    window.location.href = url;
    return;
  }
  _activeAbortController?.abort();
  const controller = new AbortController();
  _activeAbortController = controller;
  const navId = ++_navigationId;
  function assertStillCurrent() {
    if (navId !== _navigationId) throw new NavigationCancelledError(url);
  }
  try {
    let res;
    try {
      res = await fetch(url, {
        headers: { Accept: "text/html" },
        signal: controller.signal
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw new NavigationCancelledError(url);
      throw err;
    }
    assertStillCurrent();
    if (!res.ok) scheduleHardNavigationAndThrow(url, `Navigation failed: ${res.status} ${res.statusText}`);
    const html = await res.text();
    assertStillCurrent();
    const match = html.match(/<script>window\.__NEXT_DATA__\s*=\s*(.*?)<\/script>/);
    if (!match) scheduleHardNavigationAndThrow(url, "Navigation failed: missing __NEXT_DATA__ in response");
    const nextData = JSON.parse(match[1]);
    const { pageProps } = nextData.props;
    let pageModuleUrl = nextData.__vinext?.pageModuleUrl;
    if (!pageModuleUrl) {
      const moduleMatch = html.match(/import\("([^"]+)"\);\s*\n\s*const PageComponent/);
      const altMatch = html.match(/await import\("([^"]+pages\/[^"]+)"\)/);
      pageModuleUrl = moduleMatch?.[1] ?? altMatch?.[1] ?? void 0;
    }
    if (!pageModuleUrl) scheduleHardNavigationAndThrow(url, "Navigation failed: no page module URL found");
    if (!isValidModulePath(pageModuleUrl)) {
      console.error("[vinext] Blocked import of invalid page module path:", pageModuleUrl);
      scheduleHardNavigationAndThrow(url, "Navigation failed: invalid page module path");
    }
    const pageModule = await import(
      /* @vite-ignore */
      pageModuleUrl
    );
    assertStillCurrent();
    const PageComponent = pageModule.default;
    if (!PageComponent) scheduleHardNavigationAndThrow(url, "Navigation failed: page module has no default export");
    const React = (await import("../index.js").then((n) => n.R)).default;
    assertStillCurrent();
    let AppComponent = window.__VINEXT_APP__;
    const appModuleUrl = nextData.__vinext?.appModuleUrl;
    if (!AppComponent && appModuleUrl) if (!isValidModulePath(appModuleUrl)) console.error("[vinext] Blocked import of invalid app module path:", appModuleUrl);
    else try {
      AppComponent = (await import(
        /* @vite-ignore */
        appModuleUrl
      )).default;
      window.__VINEXT_APP__ = AppComponent;
    } catch {
    }
    assertStillCurrent();
    let element;
    if (AppComponent) element = React.createElement(AppComponent, {
      Component: PageComponent,
      pageProps
    });
    else element = React.createElement(PageComponent, pageProps);
    element = wrapWithRouterContext(element);
    window.__NEXT_DATA__ = nextData;
    root.render(element);
  } finally {
    if (navId === _navigationId) _activeAbortController = null;
  }
}
async function runNavigateClient(fullUrl, resolvedUrl) {
  try {
    await navigateClient(fullUrl);
    return "completed";
  } catch (err) {
    routerEvents.emit("routeChangeError", err, resolvedUrl, { shallow: false });
    if (err instanceof NavigationCancelledError) return "cancelled";
    if (typeof window !== "undefined" && !(err instanceof HardNavigationScheduledError)) window.location.href = fullUrl;
    return "failed";
  }
}
function buildRouterValue(pathname, query, asPath, methods) {
  const _ssrState = _getSSRContext();
  const nextData = typeof window !== "undefined" ? window.__NEXT_DATA__ : void 0;
  const locale = typeof window === "undefined" ? _ssrState?.locale : window.__VINEXT_LOCALE__;
  const locales = typeof window === "undefined" ? _ssrState?.locales : window.__VINEXT_LOCALES__;
  const defaultLocale = typeof window === "undefined" ? _ssrState?.defaultLocale : window.__VINEXT_DEFAULT_LOCALE__;
  const domainLocales = typeof window === "undefined" ? _ssrState?.domainLocales : nextData?.domainLocales;
  return {
    pathname,
    route: typeof window !== "undefined" ? nextData?.page ?? pathname : pathname,
    query,
    asPath,
    basePath: __basePath,
    locale,
    locales,
    defaultLocale,
    domainLocales,
    isReady: true,
    isPreview: false,
    isFallback: typeof window !== "undefined" && nextData?.isFallback === true,
    ...methods,
    events: routerEvents
  };
}
function useRouter() {
  const [{ pathname, query, asPath }, setState] = reactExports.useState(getPathnameAndQuery);
  reactExports.useEffect(() => {
    const onNavigate = ((_e) => {
      setState(getPathnameAndQuery());
    });
    window.addEventListener("vinext:navigate", onNavigate);
    return () => window.removeEventListener("vinext:navigate", onNavigate);
  }, []);
  const push = reactExports.useCallback(async (url, as, options) => {
    let resolved = resolveNavigationTarget(url, as, options?.locale);
    if (isExternalUrl(resolved)) {
      const localPath = toSameOriginAppPath(resolved);
      if (localPath == null) {
        window.location.assign(resolved);
        return true;
      }
      resolved = localPath;
    }
    const full = toBrowserNavigationHref(resolved, window.location.href, __basePath);
    if (isHashOnlyChange(resolved)) {
      const eventUrl = resolveHashUrl(resolved);
      routerEvents.emit("hashChangeStart", eventUrl, { shallow: options?.shallow ?? false });
      const hash2 = resolved.includes("#") ? resolved.slice(resolved.indexOf("#")) : "";
      window.history.pushState({}, "", resolved.startsWith("#") ? resolved : full);
      _lastPathnameAndSearch = window.location.pathname + window.location.search;
      scrollToHash(hash2);
      setState(getPathnameAndQuery());
      routerEvents.emit("hashChangeComplete", eventUrl, { shallow: options?.shallow ?? false });
      window.dispatchEvent(new CustomEvent("vinext:navigate"));
      return true;
    }
    saveScrollPosition();
    routerEvents.emit("routeChangeStart", resolved, { shallow: options?.shallow ?? false });
    routerEvents.emit("beforeHistoryChange", resolved, { shallow: options?.shallow ?? false });
    window.history.pushState({}, "", full);
    _lastPathnameAndSearch = window.location.pathname + window.location.search;
    if (!options?.shallow) {
      const result = await runNavigateClient(full, resolved);
      if (result === "cancelled") return true;
      if (result === "failed") return false;
    }
    setState(getPathnameAndQuery());
    routerEvents.emit("routeChangeComplete", resolved, { shallow: options?.shallow ?? false });
    const hash = resolved.includes("#") ? resolved.slice(resolved.indexOf("#")) : "";
    if (hash) scrollToHash(hash);
    else if (options?.scroll !== false) window.scrollTo(0, 0);
    window.dispatchEvent(new CustomEvent("vinext:navigate"));
    return true;
  }, []);
  const replace = reactExports.useCallback(async (url, as, options) => {
    let resolved = resolveNavigationTarget(url, as, options?.locale);
    if (isExternalUrl(resolved)) {
      const localPath = toSameOriginAppPath(resolved);
      if (localPath == null) {
        window.location.replace(resolved);
        return true;
      }
      resolved = localPath;
    }
    const full = toBrowserNavigationHref(resolved, window.location.href, __basePath);
    if (isHashOnlyChange(resolved)) {
      const eventUrl = resolveHashUrl(resolved);
      routerEvents.emit("hashChangeStart", eventUrl, { shallow: options?.shallow ?? false });
      const hash2 = resolved.includes("#") ? resolved.slice(resolved.indexOf("#")) : "";
      window.history.replaceState({}, "", resolved.startsWith("#") ? resolved : full);
      _lastPathnameAndSearch = window.location.pathname + window.location.search;
      scrollToHash(hash2);
      setState(getPathnameAndQuery());
      routerEvents.emit("hashChangeComplete", eventUrl, { shallow: options?.shallow ?? false });
      window.dispatchEvent(new CustomEvent("vinext:navigate"));
      return true;
    }
    routerEvents.emit("routeChangeStart", resolved, { shallow: options?.shallow ?? false });
    routerEvents.emit("beforeHistoryChange", resolved, { shallow: options?.shallow ?? false });
    window.history.replaceState({}, "", full);
    _lastPathnameAndSearch = window.location.pathname + window.location.search;
    if (!options?.shallow) {
      const result = await runNavigateClient(full, resolved);
      if (result === "cancelled") return true;
      if (result === "failed") return false;
    }
    setState(getPathnameAndQuery());
    routerEvents.emit("routeChangeComplete", resolved, { shallow: options?.shallow ?? false });
    const hash = resolved.includes("#") ? resolved.slice(resolved.indexOf("#")) : "";
    if (hash) scrollToHash(hash);
    else if (options?.scroll !== false) window.scrollTo(0, 0);
    window.dispatchEvent(new CustomEvent("vinext:navigate"));
    return true;
  }, []);
  const back = reactExports.useCallback(() => {
    window.history.back();
  }, []);
  const reload = reactExports.useCallback(() => {
    window.location.reload();
  }, []);
  const prefetch = reactExports.useCallback(async (url) => {
    if (typeof document !== "undefined") {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = url;
      link.as = "document";
      document.head.appendChild(link);
    }
  }, []);
  return reactExports.useMemo(() => buildRouterValue(pathname, query, asPath, {
    push,
    replace,
    back,
    reload,
    prefetch,
    beforePopState: (cb) => {
      _beforePopStateCb = cb;
    }
  }), [
    pathname,
    query,
    asPath,
    push,
    replace,
    back,
    reload,
    prefetch
  ]);
}
let _beforePopStateCb;
let _lastPathnameAndSearch = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";
if (typeof window !== "undefined") window.addEventListener("popstate", (e) => {
  const browserUrl = window.location.pathname + window.location.search;
  const appUrl = stripBasePath(window.location.pathname, __basePath) + window.location.search;
  const isHashOnly = browserUrl === _lastPathnameAndSearch;
  if (_beforePopStateCb !== void 0) {
    if (!_beforePopStateCb({
      url: appUrl,
      as: appUrl,
      options: { shallow: false }
    })) return;
  }
  _lastPathnameAndSearch = browserUrl;
  if (isHashOnly) {
    const hashUrl = appUrl + window.location.hash;
    routerEvents.emit("hashChangeStart", hashUrl, { shallow: false });
    scrollToHash(window.location.hash);
    routerEvents.emit("hashChangeComplete", hashUrl, { shallow: false });
    window.dispatchEvent(new CustomEvent("vinext:navigate"));
    return;
  }
  const fullAppUrl = appUrl + window.location.hash;
  routerEvents.emit("routeChangeStart", fullAppUrl, { shallow: false });
  routerEvents.emit("beforeHistoryChange", fullAppUrl, { shallow: false });
  (async () => {
    if (await runNavigateClient(browserUrl, fullAppUrl) === "completed") {
      routerEvents.emit("routeChangeComplete", fullAppUrl, { shallow: false });
      restoreScrollPosition(e.state);
      window.dispatchEvent(new CustomEvent("vinext:navigate"));
    }
  })();
});
function wrapWithRouterContext(element) {
  const { pathname, query, asPath } = getPathnameAndQuery();
  const routerValue = buildRouterValue(pathname, query, asPath, {
    push: Router.push,
    replace: Router.replace,
    back: Router.back,
    reload: Router.reload,
    prefetch: Router.prefetch,
    beforePopState: Router.beforePopState
  });
  return reactExports.createElement(RouterContext.Provider, { value: routerValue }, element);
}
const Router = {
  push: async (url, as, options) => {
    let resolved = resolveNavigationTarget(url, as, options?.locale);
    if (isExternalUrl(resolved)) {
      const localPath = toSameOriginAppPath(resolved);
      if (localPath == null) {
        window.location.assign(resolved);
        return true;
      }
      resolved = localPath;
    }
    const full = toBrowserNavigationHref(resolved, window.location.href, __basePath);
    if (isHashOnlyChange(resolved)) {
      const eventUrl = resolveHashUrl(resolved);
      routerEvents.emit("hashChangeStart", eventUrl, { shallow: options?.shallow ?? false });
      const hash2 = resolved.includes("#") ? resolved.slice(resolved.indexOf("#")) : "";
      window.history.pushState({}, "", resolved.startsWith("#") ? resolved : full);
      _lastPathnameAndSearch = window.location.pathname + window.location.search;
      scrollToHash(hash2);
      routerEvents.emit("hashChangeComplete", eventUrl, { shallow: options?.shallow ?? false });
      window.dispatchEvent(new CustomEvent("vinext:navigate"));
      return true;
    }
    saveScrollPosition();
    routerEvents.emit("routeChangeStart", resolved, { shallow: options?.shallow ?? false });
    routerEvents.emit("beforeHistoryChange", resolved, { shallow: options?.shallow ?? false });
    window.history.pushState({}, "", full);
    _lastPathnameAndSearch = window.location.pathname + window.location.search;
    if (!options?.shallow) {
      const result = await runNavigateClient(full, resolved);
      if (result === "cancelled") return true;
      if (result === "failed") return false;
    }
    routerEvents.emit("routeChangeComplete", resolved, { shallow: options?.shallow ?? false });
    const hash = resolved.includes("#") ? resolved.slice(resolved.indexOf("#")) : "";
    if (hash) scrollToHash(hash);
    else if (options?.scroll !== false) window.scrollTo(0, 0);
    window.dispatchEvent(new CustomEvent("vinext:navigate"));
    return true;
  },
  replace: async (url, as, options) => {
    let resolved = resolveNavigationTarget(url, as, options?.locale);
    if (isExternalUrl(resolved)) {
      const localPath = toSameOriginAppPath(resolved);
      if (localPath == null) {
        window.location.replace(resolved);
        return true;
      }
      resolved = localPath;
    }
    const full = toBrowserNavigationHref(resolved, window.location.href, __basePath);
    if (isHashOnlyChange(resolved)) {
      const eventUrl = resolveHashUrl(resolved);
      routerEvents.emit("hashChangeStart", eventUrl, { shallow: options?.shallow ?? false });
      const hash2 = resolved.includes("#") ? resolved.slice(resolved.indexOf("#")) : "";
      window.history.replaceState({}, "", resolved.startsWith("#") ? resolved : full);
      _lastPathnameAndSearch = window.location.pathname + window.location.search;
      scrollToHash(hash2);
      routerEvents.emit("hashChangeComplete", eventUrl, { shallow: options?.shallow ?? false });
      window.dispatchEvent(new CustomEvent("vinext:navigate"));
      return true;
    }
    routerEvents.emit("routeChangeStart", resolved, { shallow: options?.shallow ?? false });
    routerEvents.emit("beforeHistoryChange", resolved, { shallow: options?.shallow ?? false });
    window.history.replaceState({}, "", full);
    _lastPathnameAndSearch = window.location.pathname + window.location.search;
    if (!options?.shallow) {
      const result = await runNavigateClient(full, resolved);
      if (result === "cancelled") return true;
      if (result === "failed") return false;
    }
    routerEvents.emit("routeChangeComplete", resolved, { shallow: options?.shallow ?? false });
    const hash = resolved.includes("#") ? resolved.slice(resolved.indexOf("#")) : "";
    if (hash) scrollToHash(hash);
    else if (options?.scroll !== false) window.scrollTo(0, 0);
    window.dispatchEvent(new CustomEvent("vinext:navigate"));
    return true;
  },
  back: () => window.history.back(),
  reload: () => window.location.reload(),
  prefetch: async (url) => {
    if (typeof document !== "undefined") {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = url;
      link.as = "document";
      document.head.appendChild(link);
    }
  },
  beforePopState: (cb) => {
    _beforePopStateCb = cb;
  },
  events: routerEvents
};
export {
  _registerRouterStateAccessors,
  applyNavigationLocale,
  Router as default,
  isExternalUrl,
  isHashOnlyChange,
  setSSRContext,
  useRouter,
  wrapWithRouterContext
};
