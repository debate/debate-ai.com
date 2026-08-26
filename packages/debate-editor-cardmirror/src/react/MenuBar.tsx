"use client";

/**
 * Top menu bar sitting above the CardMirror ribbon — File / Edit / Card /
 * Format / Insert / AI / View / Tools / Workspace / Plugins dropdowns
 * exposing every ribbon command via `runRibbon(id)`, grouped into labeled
 * sections that mirror CardMirror's own `RIBBON_GROUPS` taxonomy (see
 * menu-bar-categories.ts). Every entry here is one more way to reach a
 * command already bound to a ribbon button and/or the Ctrl/Cmd-Shift-Space
 * command palette — this doesn't replace either, it's the third, browsable
 * path. Two categories aren't sourced from `RIBBON_GROUPS`: Plugins lists
 * whatever the palette's `command` search source pulls from the runtime
 * plugin registry, so a plugin-registered command reachable via the palette
 * is always reachable here too; Workspace lists `WORKSPACE_LINKS` — the
 * app's other tools and pages, the same list the palette's `t` prefix
 * searches — so switching workspaces doesn't require leaving the editor to
 * find the Tools page first.
 */

import { useCallback, useEffect, useState } from "react";
import { Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "debate-ui/src/primitives/dropdown-menu";
import { Button } from "debate-ui/src/primitives/button";
import { MENU_BAR_CATEGORIES } from "./menu-bar-categories.js";
import { WORKSPACE_LINKS } from "../editor/workspace-links.js";

export interface MenuBarProps {
  className?: string;
}

export function MenuBar({ className }: MenuBarProps): React.JSX.Element {
  const run = useCallback((id: string) => {
    void import("../editor/index.js").then((engine) => {
      engine.runRibbon(id as never);
    });
  }, []);

  const openSettings = useCallback(() => {
    void import("../editor/settings-ui.js").then((m) => m.openSettings());
  }, []);

  // Workspace links navigate away from the editor entirely (a different app
  // route), so this is a full navigation rather than a `runRibbon` dispatch.
  const navigate = useCallback((href: string) => {
    window.location.assign(href);
  }, []);

  return (
    <div
      className={
        "dec-menubar flex items-center gap-0.5 border-b border-border bg-muted/40 px-1 h-8 shrink-0" +
        (className ? ` ${className}` : "")
      }
      role="menubar"
      aria-label="Editor commands"
    >
      {MENU_BAR_CATEGORIES.map((category) => (
        <MenuBarCategoryMenu
          key={category.title}
          title={category.title}
          groupTitles={category.groupTitles}
          includesPluginCommands={category.includesPluginCommands}
          isWorkspaceLinks={category.isWorkspaceLinks}
          onRun={run}
          onNavigate={navigate}
        />
      ))}
      <div className="flex-1" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        title="Settings"
        aria-label="Settings"
        onClick={openSettings}
      >
        <Settings className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function MenuBarCategoryMenu({
  title,
  groupTitles,
  includesPluginCommands,
  isWorkspaceLinks,
  onRun,
  onNavigate,
}: {
  title: string;
  groupTitles: string[];
  includesPluginCommands?: boolean;
  isWorkspaceLinks?: boolean;
  onRun: (id: string) => void;
  onNavigate: (href: string) => void;
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          role="menuitem"
          className="px-2 py-1 text-xs font-medium rounded hover:bg-accent hover:text-accent-foreground focus:outline-none focus:bg-accent"
        >
          {title}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[70vh] overflow-y-auto">
        {isWorkspaceLinks ? (
          <WorkspaceLinksContent onNavigate={onNavigate} />
        ) : (
          <CategoryContent groupTitles={groupTitles} includesPluginCommands={includesPluginCommands} onRun={onRun} />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Workspace category content: every `WORKSPACE_LINKS` entry as a menu
 *  item, navigating to the tool's app route on select. Unlike
 *  `CategoryContent`, this needs no lazy engine import — the link list is a
 *  small static module already loaded with MenuBar itself. */
function WorkspaceLinksContent({
  onNavigate,
}: {
  onNavigate: (href: string) => void;
}): React.JSX.Element {
  return (
    <>
      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Go to
      </DropdownMenuLabel>
      {WORKSPACE_LINKS.map((link) => (
        <DropdownMenuItem key={link.href} onSelect={() => onNavigate(link.href)} title={link.description}>
          {link.label}
        </DropdownMenuItem>
      ))}
    </>
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
          {i > 0 && <DropdownMenuSeparator />}
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {section.sectionTitle}
          </DropdownMenuLabel>
          {section.items.length === 0 ? (
            <DropdownMenuItem disabled>No commands available</DropdownMenuItem>
          ) : (
            section.items.map((item) => (
              <DropdownMenuItem key={item.id} onSelect={() => onRun(item.id)}>
                {item.label}
                {item.shortcut && <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>}
              </DropdownMenuItem>
            ))
          )}
        </div>
      ))}
    </>
  );
}
