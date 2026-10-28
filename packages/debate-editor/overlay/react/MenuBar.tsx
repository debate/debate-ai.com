"use client";

/**
 * A compact shadcn `Menubar` — File / Speech / Card / Edit / Format /
 * Color / Insert / AI / View / Panes / Tools / Flow / Plugins —
 * exposing every ribbon command via `runRibbon(id)`, grouped into labeled
 * sections that mirror Debate Editor's own `RIBBON_GROUPS` taxonomy.
 *
 * `DebateEditor` stacks this above Debate Editor's own toolbar
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
 * always reachable here too. View also opens with a Read aloud section whose
 * "Read whole document aloud" item reads every card in turn through the card
 * hover actions' reader (same voice and speed as a card's Read aloud), and
 * turns into "Stop reading document" while it runs.
 *
 * The bar's right end also hosts the engine's Send / Receive card-sharing
 * pills, beside the Settings button (`usePairingPillDock`). The engine mounts
 * them in its body-level `.pmd-pill-tray` at the editor's bottom-left, where
 * they floated over the last lines of the doc; this moves the live nodes
 * (listeners ride along) into the bar while it is mounted, and hands them
 * back to the tray when it unmounts. embed-containment.css drops their
 * popups downward from the bar.
 *
 * The strip is a Radix/shadcn Menubar rather than a row of independent
 * dropdowns: with one menu open, pointing at another trigger switches to it,
 * and ←/→ move between menus. A menu opens with a fade + zoom + slide from
 * its trigger, and its rows then cascade in one after another
 * (`menuItemIntro`); both are skipped under `prefers-reduced-motion`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "../ui/primitives/menubar";
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
      <Menubar
        className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
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
            includesReadAloud={category.includesReadAloud}
            onRun={run}
          />
        ))}
      </Menubar>
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
  includesReadAloud,
  onRun,
}: {
  title: string;
  groupTitles: string[];
  includesPluginCommands?: boolean;
  includesReadAloud?: boolean;
  onRun: (id: string) => void;
}): React.JSX.Element {
  return (
    <MenubarMenu>
      <MenubarTrigger className="shrink-0 px-1.5 py-0.5 text-xs">{title}</MenubarTrigger>
      <MenubarContent className="min-w-[10rem] max-h-[70vh] overflow-y-auto p-0.5">
        {includesReadAloud && <ReadAloudSection />}
        <CategoryContent groupTitles={groupTitles} includesPluginCommands={includesPluginCommands} onRun={onRun} />
      </MenubarContent>
    </MenubarMenu>
  );
}

/** Rows of an open menu cascade in: each fades and slides in from the left,
 *  a beat after the row above it. The stagger is capped so a long menu's
 *  bottom rows aren't left waiting. `fill-mode-both` keeps a row hidden
 *  until its own delay has passed. */
const MENU_ITEM_INTRO =
  "animate-in fade-in-0 slide-in-from-left-1 fill-mode-both duration-200 ease-out motion-reduce:animate-none";
const MENU_ITEM_STAGGER_MS = 12;
const MENU_ITEM_MAX_DELAY_MS = 180;

function menuItemIntro(index: number): React.CSSProperties {
  return {
    ["--tw-animation-delay" as string]: `${Math.min(index * MENU_ITEM_STAGGER_MS, MENU_ITEM_MAX_DELAY_MS)}ms`,
  };
}

/** "Read whole document aloud" / "Stop reading document", following the
 *  reader's state while the menu is open. The reader module is the one the
 *  editor boot already loaded, so the dynamic import adds no weight. */
function ReadAloudSection(): React.JSX.Element {
  const [reading, setReading] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void import("../editor/card-hover-actions.js").then((m) => {
      if (cancelled) return;
      setReading(m.isReadingDocumentAloud());
      const follow = (): void => setReading(m.isReadingDocumentAloud());
      window.addEventListener(m.READ_DOCUMENT_CHANGE_EVENT, follow);
      unlisten = () => window.removeEventListener(m.READ_DOCUMENT_CHANGE_EVENT, follow);
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const toggle = useCallback(() => {
    void import("../editor/card-hover-actions.js").then((m) => m.toggleReadDocumentAloud());
  }, []);

  return (
    <div>
      <MenubarLabel
        className={`px-2 py-0.5 text-[10px] leading-tight uppercase tracking-wide text-muted-foreground ${MENU_ITEM_INTRO}`}
        style={menuItemIntro(0)}
      >
        Read aloud
      </MenubarLabel>
      <MenubarItem
        disabled={reading === null}
        onSelect={toggle}
        className={`px-2 py-0.5 text-xs leading-tight ${MENU_ITEM_INTRO}`}
        style={menuItemIntro(1)}
      >
        {reading ? "Stop reading document" : "Read whole document aloud"}
      </MenubarItem>
      <MenubarSeparator className="my-0.5" />
    </div>
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
    return <MenubarLabel className="text-xs text-muted-foreground">Loading…</MenubarLabel>;
  }

  if (entries.length === 0) {
    return <MenubarItem disabled>No commands available</MenubarItem>;
  }

  // Running row index across every section, for the cascade's delays.
  let row = 0;
  return (
    <>
      {entries.map((section, i) => (
        <div key={section.sectionTitle}>
          {i > 0 && <MenubarSeparator className="my-0.5" />}
          <MenubarLabel
            className={`px-2 py-0.5 text-[10px] leading-tight uppercase tracking-wide text-muted-foreground ${MENU_ITEM_INTRO}`}
            style={menuItemIntro(row++)}
          >
            {section.sectionTitle}
          </MenubarLabel>
          {section.items.length === 0 ? (
            <MenubarItem
              disabled
              className={`px-2 py-0.5 text-xs leading-tight ${MENU_ITEM_INTRO}`}
              style={menuItemIntro(row++)}
            >
              No commands available
            </MenubarItem>
          ) : (
            section.items.map((item) => (
              <MenubarItem
                key={item.id}
                onSelect={() => onRun(item.id)}
                className={`px-2 py-0.5 text-xs leading-tight ${MENU_ITEM_INTRO}`}
                style={menuItemIntro(row++)}
              >
                {item.label}
                {item.shortcut && (
                  <MenubarShortcut className="text-[10px]">{item.shortcut}</MenubarShortcut>
                )}
              </MenubarItem>
            ))
          )}
        </div>
      ))}
    </>
  );
}
