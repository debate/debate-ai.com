"use client";

import { useCallback, useEffect, useState } from "react";

import { Wordmark } from "../brand/Logo";
import { Kbd } from "../ui/kbd";
import { Skeleton } from "../ui/skeleton";
import { acceptInvite } from "../../lib/collab/inbox";
import { inviteToastFor } from "../../lib/collab/invite";
import { executeCommand } from "../../lib/commands/commands";
import { openFlowFromPicker } from "../../lib/commands/fileCommands";
import { navigateToFlow } from "../../lib/commands/flowNav";
import { openNewWindow } from "../../lib/commands/windowCommands";
import { withinEbbKeyScope } from "../../lib/keymap/scope";
import { openExternal } from "../../lib/openExternal";
import { noteOpened } from "../../lib/persistence/flowSession";
import { relativeTime } from "../../lib/start/format";
import { useCollabStore } from "../../lib/store/useCollabStore";
import { useFlowStore } from "../../lib/store/useFlowStore";
import { getCurrentVersion, isDesktop } from "../../lib/update/adapter";
import { cn } from "../../lib/utils";

import MigrationDialog from "./MigrationDialog";
import { useRecentFlows, type RecentEntry } from "./useRecentFlows";

const LINKS = [
    { label: "Documentation", href: "https://ebb.smodi.net/docs" },
    { label: "GitHub", href: "https://github.com/shreerammodi/ebb" },
    { label: "Shreeram Modi", href: "https://smodi.net", prefix: "Developed by " },
];

function Rule() {
    return <div className="bg-border/60 my-5 h-px w-full" />;
}

/**
 * The start screen, modelled on nvim's.
 *
 * There is no list of flows to manage here, because the filesystem is the
 * library now: the handful of commands that put a flow on screen, the flows you
 * were last in, and where to read more. Every target is one keypress, which is
 * the point - the screen exists to be left quickly.
 */
export default function StartScreen() {
    const setNewFlowOpen = useFlowStore((s) => s.setNewFlowOpen);
    const setSettingsOpen = useFlowStore((s) => s.setSettingsOpen);
    const { entries, refresh } = useRecentFlows();
    const [cursor, setCursor] = useState(0);
    const [version, setVersion] = useState(process.env.NEXT_PUBLIC_EBB_VERSION ?? "");
    const invites = useCollabStore((s) => s.invites);
    const contacts = useFlowStore((s) => s.contacts);

    useEffect(() => {
        // The packaged version is the truth on desktop; the injected constant
        // only covers the browser, where there is no Tauri runtime to ask.
        if (!isDesktop()) return;
        void getCurrentVersion().then(setVersion);
    }, []);

    const open = useCallback((path: string) => navigateToFlow(path), []);

    // A cold launch with a .ebb argument reaches Rust before this component
    // exists; on macOS it can only be observed after this dashboard window
    // has already been created (see windows.rs's bootstrap comment), so it
    // asks here, once, whether this exact window turned out to be that
    // launch after all. Every other open (already running, a second launch,
    // Mod+N) creates its own new window instead and never reaches this.
    useEffect(() => {
        if (!isDesktop()) return;
        let cancelled = false;
        void (async () => {
            // Platform-only module: a static import would pull Tauri's IPC
            // bridge into the web bundle, which has no window manager to ask.
            const { invoke } = await import("@tauri-apps/api/core");
            const path = await invoke<string | null>("drain_boot_open").catch(() => null);
            if (!path || cancelled) return;
            void noteOpened(path);
            open(path);
        })();
        return () => {
            cancelled = true;
        };
    }, [open]);

    // An invitation leads, because it is the one row that expires: the partner
    // who sent it is already flowing. Every invite is its own row, and the key
    // takes the first, which is the one that has been waiting longest.
    const inviteRows = invites.map((invite, i) => ({
        id: `invite-${invite.endpointId}-${invite.roundId}`,
        key: i === 0 ? "i" : "",
        label: inviteToastFor(contacts, invite.endpointId, invite.label),
        run: () => void acceptInvite(invite),
    }));
    const actions = [
        ...inviteRows,
        { id: "new", key: "n", label: "New flow", run: () => setNewFlowOpen(true) },
        { id: "open", key: "o", label: "Open", run: () => void openFlowFromPicker() },
        // A guest with a code has no flow open, so this screen is the only
        // place they can be standing: the sidebar's sharing controls need a
        // round and the palette only mounts on the flow screen. Desktop only,
        // the way every route to a session is - a browser cannot bind an
        // endpoint. The command carries the consent question with it.
        ...(isDesktop()
            ? [
                  {
                      id: "join",
                      key: "j",
                      label: "Join with a code",
                      run: () => executeCommand("collab.join"),
                  },
              ]
            : []),
        { id: "settings", key: "s", label: "Settings", run: () => setSettingsOpen(true) },
    ];

    // The cursor runs over the actions and then the recents as one column, so
    // j/k walks the whole screen the way it walks a buffer.
    const rows = entries ?? [];
    const total = actions.length + rows.length;

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (!withinEbbKeyScope(e.target)) return;
            if (e.altKey) return;
            const target = e.target as HTMLElement | null;
            // Ahead of every branch: a dialog or a text field owns the keyboard
            // while it is open, modifier chords included.
            if (target?.closest("input, textarea, [contenteditable='true'], [role='dialog']")) {
                return;
            }
            // Meta/Ctrl chords are the OS's until proven otherwise; the two the
            // start screen claims are the ones the File menu also offers.
            if (e.metaKey || e.ctrlKey) {
                if (e.key === "n") {
                    e.preventDefault();
                    void openNewWindow();
                } else if (e.key === "o") {
                    e.preventDefault();
                    void openFlowFromPicker();
                }
                return;
            }
            const action = actions.find((a) => a.key === e.key);
            if (action) {
                e.preventDefault();
                action.run();
                return;
            }
            if (/^[1-9]$/.test(e.key)) {
                const entry = rows[Number(e.key) - 1];
                if (entry) {
                    e.preventDefault();
                    open(entry.path);
                }
                return;
            }
            // Down has no letter left: j is Join, an action a debater reaches
            // for by name. k keeps its half, nothing competes for it.
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => (total ? (c + 1) % total : 0));
            } else if (e.key === "k" || e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => (total ? (c - 1 + total) % total : 0));
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (cursor < actions.length) actions[cursor].run();
                else open(rows[cursor - actions.length].path);
            }
        }

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
        // No dependency array on purpose: the handler closes over the cursor
        // and the recents, and re-subscribing on a screen this static is
        // cheaper than the refs it would take to avoid it.
    });

    return (
        <main
            className="flex h-full min-h-0 items-center justify-center overflow-y-auto px-6 py-16"
            data-testid="start-screen"
        >
            <div className="w-full max-w-[34rem] font-mono text-sm">
                <div className="flex flex-col items-center gap-3">
                    <Wordmark animated className="h-10 w-auto" />
                    <div className="text-muted-foreground text-xs tracking-wide">
                        ebb{version && ` v${version}`}
                    </div>
                </div>

                <Rule />

                {actions.map((action, i) => (
                    <Row
                        key={action.id}
                        badge={action.key}
                        active={cursor === i}
                        onHover={() => setCursor(i)}
                        onSelect={action.run}
                        testid={`start-${action.id}`}
                    >
                        <span>{action.label}</span>
                    </Row>
                ))}

                <Rule />

                {entries === null ? (
                    <div className="space-y-2 px-2 py-1.5">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                ) : entries.length === 0 ? (
                    <p className="text-muted-foreground px-2 py-1.5 text-xs">
                        No flows yet. Press <Kbd>n</Kbd> to start one.
                    </p>
                ) : (
                    entries.map((entry, i) => (
                        <RecentRow
                            key={entry.path}
                            entry={entry}
                            index={i}
                            active={cursor === actions.length + i}
                            onHover={() => setCursor(actions.length + i)}
                            onSelect={() => open(entry.path)}
                        />
                    ))
                )}

                <Rule />

                <p className="text-muted-foreground flex flex-wrap justify-center gap-x-2 text-xs">
                    {LINKS.map((link, i) => (
                        <span key={link.href} className="whitespace-nowrap">
                            {i > 0 && <span aria-hidden="true">&middot; </span>}
                            {link.prefix}
                            <a
                                href={link.href}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => openExternal(e, link.href)}
                                className="hover:text-foreground underline underline-offset-2"
                            >
                                {link.label}
                            </a>
                        </span>
                    ))}
                </p>
            </div>
            <MigrationDialog onMigrated={refresh} />
        </main>
    );
}

interface RowProps {
    badge: string;
    active: boolean;
    onHover: () => void;
    onSelect: () => void;
    testid?: string;
    children: React.ReactNode;
}

function Row({ badge, active, onHover, onSelect, testid, children }: RowProps) {
    return (
        <button
            type="button"
            data-testid={testid}
            onMouseEnter={onHover}
            onClick={onSelect}
            className={cn(
                "flex w-full items-center gap-4 rounded px-2 py-1.5 text-left",
                active ? "bg-accent text-accent-foreground" : "",
            )}
        >
            <Kbd className="w-5 justify-center">{badge}</Kbd>
            <span className="min-w-0 flex-1">{children}</span>
        </button>
    );
}

interface RecentRowProps {
    entry: RecentEntry;
    index: number;
    active: boolean;
    onHover: () => void;
    onSelect: () => void;
}

function RecentRow({ entry, index, active, onHover, onSelect }: RecentRowProps) {
    return (
        <Row
            badge={String(index + 1)}
            active={active}
            onHover={onHover}
            onSelect={onSelect}
            testid={`start-recent-${index + 1}`}
        >
            <span className="flex items-baseline gap-2">
                <span className="truncate">{entry.label}</span>
                {entry.detail && (
                    <span className="text-muted-foreground truncate text-xs">{entry.detail}</span>
                )}
                <span className="text-muted-foreground ml-auto shrink-0 pl-2 text-xs">
                    {relativeTime(entry.updatedAt)}
                </span>
            </span>
            <span className="text-muted-foreground/70 block truncate text-xs">{entry.display}</span>
        </Row>
    );
}
