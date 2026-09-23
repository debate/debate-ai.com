/**
 * @fileoverview Public entry point for `debate-ai-webui`.
 *
 * The package's one reason to exist is that the debate-ai.com frontend used to
 * be reachable only by loading the Next.js app: anything else that wanted the
 * app's UI — the browser extension, a native wrapper, a docs demo — had to
 * either reimplement it or embed the site in an iframe. Pulling the screens
 * into a package that talks to the API through `debate-api-client` and nothing
 * else makes the UI mountable anywhere React runs.
 *
 * Hosts import {@link DebateWebUI} plus `debate-ai-webui/styles.css`; the
 * screens and primitives are exported for hosts that want to compose their
 * own shell or add a screen of their own.
 *
 * @module debate-ai-webui
 */

export { DebateWebUI } from "./DebateWebUI";
export { BUILT_IN_SCREENS } from "./screens";
export {
  CardSearchScreen,
  RankingsScreen,
  ReuseCheckScreen,
  ToolCatalogScreen,
  VideoLibraryScreen,
} from "./screens";
export { AsyncBoundary, Card, ResultCount, SearchField, SelectField } from "./primitives";
export { useAsync, useDebounced, type AsyncState } from "./useAsync";
export {
  apiBaseUrl,
  createWebUiClient,
  siteUrl,
  unwrap,
  DEFAULT_ORIGIN,
} from "./api";
export {
  decodeVideoRow,
  decodeVideoRows,
  formatViewCount,
  styleLabel,
  videoWatchUrl,
  type VideoRow,
} from "./videos";
export type {
  DebateWebUIProps,
  WebUIContext,
  WebUIScreen,
} from "./types";
