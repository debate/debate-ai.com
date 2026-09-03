/**
 * Non-visual pieces of ebb's retired start screen, for the host app's own
 * "ebb Flow tools" dropdown (`EbbFlowToolsMenu` in debate-round) to build its
 * menu from without pulling in ebb's UI kit — that kit is styled for
 * `.ebb-scope` (see `EbbFlowEmbed.tsx`'s docstring) and would render unstyled
 * outside it, unlike the host's own `debate-ui` components the dropdown uses
 * instead.
 */

export { useRecentFlows } from "./components/start/useRecentFlows";
export type { RecentEntry, RecentFlows } from "./components/start/useRecentFlows";
export { isDesktop } from "./lib/update/adapter";
