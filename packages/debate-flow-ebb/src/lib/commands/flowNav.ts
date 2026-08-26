/**
 * Router access for commands fired outside React.
 *
 * The keyboard layer and the native menu both run commands from module scope,
 * where there is no hook to reach Next's router with. `NavigatorHost` registers
 * the live router here on mount, mirroring how `hotInstance.ts` registers the
 * live grid, so a command can route without every caller threading a router
 * down to it.
 */

export interface FlowNavigator {
    /** Open the flow at an absolute path. */
    openPath(path: string, opts?: { isNew?: boolean }): void;
    /** Leave the editor for the start screen. */
    toStart(): void;
}

let navigator: FlowNavigator | null = null;

export function setFlowNavigator(next: FlowNavigator | null): void {
    navigator = next;
}

/** No-ops before the host mounts, which is the same shape as every command. */
export function navigateToFlow(path: string, opts?: { isNew?: boolean }): void {
    navigator?.openPath(path, opts);
}

export function navigateToStart(): void {
    navigator?.toStart();
}

/** The URL for a flow. The path is the identity, so it rides in the query. */
export function flowRouteFor(path: string): string {
    return `/flow?path=${encodeURIComponent(path)}`;
}
