"use client";

/**
 * A compact dropdown menu bar — File / Speech / Card / Edit / Format /
 * Color / Insert / AI / View / Panes / Tools / Flow / Plugins —
 * exposing every ribbon command via `runRibbon(id)`, grouped into labeled
 * sections that mirror CardMirror's own `RIBBON_GROUPS` taxonomy.
 *
 * `CardMirrorEditor` stacks this above CardMirror's own toolbar
 * (Google-Docs-style: a text-labeled menu strip above an icon toolbar),
 * gated by its `showToolbar` prop. The two aren't duplicate surfaces for one
 * job — the toolbar is upstream's single left↔right scrolling icon strip,
 * this is the click-to-browse index over every command, including the many
 * the strip has no button for. Its categories (menu-bar-categories.ts) are
 * checked against `RIBBON_GROUPS` at load, so no command group can go
 * missing from it, and a category with nothing available on this host is
 * left off the bar. The component also stays exported from this
 * package for hosts that want a command menu somewhere else on their page
 * (a compact header, a kebab menu beside a document title).
 *
 * One category isn't sourced from `RIBBON_GROUPS`: Plugins lists whatever
 * the palette's `command` search source pulls from the runtime plugin
 * registry, so a plugin-registered command reachable via the palette is
 * always reachable here too.
 *
 * The bar's right end also hosts the engine's Send / Receive card-sharing
 * pills, beside the Settings button (`usePairingPillDock`). The engine mounts
 * them in its body-level `.pmd-pill-tray` at the editor's bottom-left, where
 * they floated over the last lines of the doc; this moves the live nodes
 * (listeners ride along) into the bar while it is mounted, and hands them
 * back to the tray when it unmounts. embed-containment.css drops their
 * popups downward from the bar.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "../ui/primitives/dropdown-menu";
import { Button } from "../ui/primitives/button";
import type { MenuBarCategory } from "./menu-bar-categories.js";

export interface MenuBarProps {
  className?: string;
}

/** Category list is loaded via dynamic `import()` rather than a
 *  module-scope import — `menu-bar-categories.js` pulls in (through its
 *  drift guard over `RIBBON_GROUPS` and its availability check) the
 *  whole ribbon command/table-plugin graph, which is exactly the engine
 *  weight this component otherwise keeps out of the initial render path. A
 *  module-scope import here would force that graph to load — and its
 *  side effects (e.g. prosemirror-tables' selection-type registration) to
 *  run — every time this file is merely imported, including during SSR of
 *  the "use client" boundary. */
export function MenuBar({ className }: MenuBarProps): React.JSX.Element {
  const [categories, setCategories] = useState<MenuBarCategory[] | null>(null);

  // Availability is settings-derived (`cardCutterEnabled`, the collab gate,
  // the bulk-compress gate) and plugins register after boot, so the list is
  // recomputed on a settings change and whenever the bar is pointed at or
  // focused — cheap, and it never shows a category that would open empty.
  const [refreshCategories, setRefreshCategories] = useState<() => void>(() => () => {});

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void Promise.all([import("./menu-bar-categories.js"), import("../editor/settings.js")]).then(
      ([m, settingsMod]) => {
        if (cancelled) return;
        const refresh = (): void => {
          const next = m.MENU_BAR_CATEGORIES.filter(m.isMenuBarCategoryPopulated);
          setCategories((prev) =>
            prev && prev.length === next.length && prev.every((c, i) => c === next[i]) ? prev : next,
          );
        };
        refresh();
        setRefreshCategories(() => refresh);
        unsubscribe = settingsMod.settings.subscribe(refresh);
      },
    );
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const run = useCallback((id: string) => {
    void import("../editor/index.js").then((engine) => {
      engine.runRibbon(id as never);
    });
  }, []);

  const openSettings = useCallback(() => {
    void import("../editor/settings-ui.js").then((m) => m.openSettings());
  }, []);

  const pillDockRef = useRef<HTMLDivElement>(null);
  usePairingPillDock(pillDockRef);

  // The menus scroll sideways in a narrow embed; the pill dock and Settings
  // sit outside that scroller so the pills' popups aren't clipped by it.
  return (
    <div
      className={
        "dec-menubar relative z-[225] flex items-center gap-1 border-b border-border bg-muted/40 px-1 h-8 shrink-0" +
        (className ? ` ${className}` : "")
      }
    >
      <div
        className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overflow-y-hidden"
        role="menubar"
        aria-label="Editor commands"
        onPointerEnter={refreshCategories}
        onFocus={refreshCategories}
      >
        {categories?.map((category) => (
          <MenuBarCategoryMenu
            key={category.title}
            title={category.title}
            groupTitles={category.groupTitles}
            includesPluginCommands={category.includesPluginCommands}
            onRun={run}
          />
        ))}
      </div>
      <div ref={pillDockRef} className="dec-menubar-pills flex shrink-0 items-center gap-1" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        title="Settings"
        aria-label="Settings"
        onClick={openSettings}
      >
        <Settings className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/** The engine's Send / Receive pills, in the order they sit in the dock. */
const PAIRING_PILL_SELECTORS = [".pmd-send-pill", ".pmd-receive-pill"] as const;

/** Keeps the engine's Send / Receive pills in `dockRef` while the bar is
 *  mounted. The engine creates its tray (a direct child of <body>) during
 *  boot, after this bar first renders, and re-parents the Receive pill into
 *  the tray again whenever its home screen closes — so this watches <body>'s
 *  own children until the tray exists, then the tray's children, re-claiming
 *  the pills on every change instead of moving them once. Neither observer
 *  looks into the editor's subtree, so typing never triggers one. On unmount
 *  the pills go back to the tray, which is where the engine expects them. */
function usePairingPillDock(dockRef: React.RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock || typeof MutationObserver === "undefined") return;
    let tray: HTMLElement | null = null;
    const claim = (): void => {
      if (!tray) return;
      for (const [i, selector] of PAIRING_PILL_SELECTORS.entries()) {
        const pill = tray.querySelector<HTMLElement>(`:scope > ${selector}`);
        if (!pill) continue;
        const next = PAIRING_PILL_SELECTORS.slice(i + 1)
          .map((s) => dock.querySelector(`:scope > ${s}`))
          .find((el) => el !== null);
        dock.insertBefore(pill, next ?? null);
      }
    };
    const trayObserver = new MutationObserver(claim);
    const findTray = (): boolean => {
      tray = document.querySelector<HTMLElement>("body > .pmd-pill-tray");
      if (!tray) return false;
      trayObserver.observe(tray, { childList: true });
      claim();
      return true;
    };
    const bodyObserver = new MutationObserver(() => {
      if (findTray()) bodyObserver.disconnect();
    });
    if (!findTray()) bodyObserver.observe(document.body, { childList: true });
    return () => {
      bodyObserver.disconnect();
      trayObserver.disconnect();
      if (!tray) return;
      for (const selector of PAIRING_PILL_SELECTORS) {
        const pill = dock.querySelector<HTMLElement>(`:scope > ${selector}`);
        if (pill) tray.appendChild(pill);
      }
    };
  }, [dockRef]);
}

function MenuBarCategoryMenu({
  title,
  groupTitles,
  includesPluginCommands,
  onRun,
}: {
  title: string;
  groupTitles: string[];
  includesPluginCommands?: boolean;
  onRun: (id: string) => void;
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          role="menuitem"
          className="shrink-0 px-1.5 py-0.5 text-xs font-medium rounded hover:bg-accent hover:text-accent-foreground focus:outline-none focus:bg-accent"
        >
          {title}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[10rem] max-h-[70vh] overflow-y-auto p-0.5">
        <CategoryContent groupTitles={groupTitles} includesPluginCommands={includesPluginCommands} onRun={onRun} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Renders each source ribbon group as a labeled section, lazily pulling
 *  labels/keybindings/availability from the engine module on first open
 *  (rather than at MenuBar's own module scope) — the engine bundle is
 *  large and this keeps it out of the initial render path entirely until
 *  the user actually opens a menu. */
function CategoryContent({
  groupTitles,
  includesPluginCommands,
  onRun,
}: {
  groupTitles: string[];
  includesPluginCommands?: boolean;
  onRun: (id: string) => void;
}): React.JSX.Element {
  const [entries, setEntries] = useState<
    { sectionTitle: string; items: { id: string; label: string; shortcut: string }[] }[] | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      import("../editor/ribbon-groups.js"),
      import("../editor/ribbon-commands.js"),
      import("../editor/ribbon-availability.js"),
      includesPluginCommands ? import("../editor/plugin-registry.js") : null,
    ]).then(([groupsMod, cmdMod, availMod, pluginMod]) => {
      if (cancelled) return;
      const sections: { sectionTitle: string; items: { id: string; label: string; shortcut: string }[] }[] =
        groupTitles.map((sectionTitle) => {
          const group = groupsMod.RIBBON_GROUPS.find((g) => g.title === sectionTitle);
          const items = (group?.commands ?? [])
            .filter((id) => availMod.isRibbonCommandAvailable(id))
            .map((id) => ({
              id,
              label: cmdMod.commandLabelFor(id),
              shortcut: cmdMod.formatKeyForDisplay(cmdMod.primaryKeyFor(id)),
            }));
          return { sectionTitle, items };
        });
      if (pluginMod) {
        for (const plugin of pluginMod.registeredPlugins()) {
          const prefix = `${plugin.id}.`;
          const items = pluginMod
            .pluginCommandIds()
            .filter((id) => id.startsWith(prefix))
            .map((id) => ({
              id,
              label: cmdMod.commandLabelFor(id),
              shortcut: cmdMod.formatKeyForDisplay(cmdMod.primaryKeyFor(id)),
            }));
          sections.push({ sectionTitle: plugin.name, items });
        }
      }
      setEntries(sections);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (entries === null) {
    return <DropdownMenuLabel className="text-xs text-muted-foreground">Loading…</DropdownMenuLabel>;
  }

  if (entries.length === 0) {
    return <DropdownMenuItem disabled>No commands available</DropdownMenuItem>;
  }

  return (
    <>
      {entries.map((section, i) => (
        <div key={section.sectionTitle}>
          {i > 0 && <DropdownMenuSeparator className="my-0.5" />}
          <DropdownMenuLabel className="px-2 py-0.5 text-[10px] leading-tight uppercase tracking-wide text-muted-foreground">
            {section.sectionTitle}
          </DropdownMenuLabel>
          {section.items.length === 0 ? (
            <DropdownMenuItem disabled className="px-2 py-0.5 text-xs leading-tight">
              No commands available
            </DropdownMenuItem>
          ) : (
            section.items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onSelect={() => onRun(item.id)}
                className="px-2 py-0.5 text-xs leading-tight"
              >
                {item.label}
                {item.shortcut && (
                  <DropdownMenuShortcut className="text-[10px]">{item.shortcut}</DropdownMenuShortcut>
                )}
              </DropdownMenuItem>
            ))
          )}
        </div>
      ))}
    </>
  );
}
