/**
 * Host integration surface for ebb's "New flow / Open / Join / Settings /
 * Recent flows" entry points.
 *
 * ebb used to offer these only on its own full-screen start screen, and
 * later only from `RoundHeader`'s toolbar (see `ResumeFlow`'s docstring) —
 * both reachable exclusively while the pinned ebb tab was already the active
 * document. `debate-round`'s `EbbFlowToolsMenu` (in its round workspace's
 * quick-action toolbar) surfaces the same entry points regardless of which
 * tab is active, which means they can fire before `EbbFlowEmbed` has ever
 * mounted. That is safe: every action below either reads/writes
 * `useFlowStore` (or one of the other Zustand singletons behind
 * `executeCommand`'s dialog-driving commands, e.g. `useJoinDialog`,
 * `useCollabConsent`) — plain module-level stores that exist independent of
 * the React tree — or is `navigateToFlow`/`openFlowFromPicker`, which
 * no-op until `NavigatorHost` registers on mount and are only ever invoked
 * here after an async pick, by which point mounting has long since happened.
 * So a caller need only select the ebb tab and call one of these in the same
 * tick; whichever dialog answers it opens already-primed the moment it
 * mounts and reads the flag.
 *
 * @module lib/hostQuickActions
 */

export { useFlowStore } from "./store/useFlowStore";
export { executeCommand } from "./commands/commands";
export { openFlowFromPicker } from "./commands/fileCommands";
export { navigateToFlow } from "./commands/flowNav";
export { isDesktop } from "./update/adapter";
export { useRecentFlows, type RecentEntry } from "../components/start/useRecentFlows";
