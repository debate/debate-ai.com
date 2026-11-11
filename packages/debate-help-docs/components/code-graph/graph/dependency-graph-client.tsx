'use client';

/**
 * The interactive dependency graph: search, node-kind toggles, help panel and
 * the Mermaid view. Vendored from code-tree-graph without its remote-repo
 * loader (a server action) and npm metadata fetch.
 */
import { useMemo, useState, useEffect, type ReactNode } from "react";
import { Boxes, FunctionSquare, Package, Search, Share2, X, HelpCircle } from "lucide-react";
import { MermaidClient } from "./mermaid";
import { buildChart, buildNodeTooltips, getGraphHierarchy, type FileInfo, type GraphDisplayOptions } from "./dependency-graph-shared";

export function DependencyGraphClient({
  files,
  showLegend,
  initialOptions,
  helpContent,
}: {
  files: FileInfo[];
  showLegend: boolean;
  initialOptions: GraphDisplayOptions;
  helpContent?: ReactNode;
}) {
  const [options, setOptions] = useState(initialOptions);
  const [search, setSearch] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  const chart = useMemo(() => buildChart(files, options), [files, options]);
  // No npm metadata lookup here (upstream posts to an /api/npm-meta route this
  // site doesn't have): External nodes show the package name only.
  const nodeTooltips = useMemo(() => buildNodeTooltips(files, options), [files, options]);
  const hierarchy = useMemo(() => getGraphHierarchy(files, options), [files, options]);

  useEffect(() => {
    (window as any).__c4Hierarchy = hierarchy;
    
    (window as any).toggleCollapse = (nodeId: string) => {
      // Find the node to toggle its icon
      const node = document.querySelector(`[id*="-${nodeId}-"]`);
      if (node) {
        // Toggle the +/- icon text
        node.querySelectorAll('tspan, span, div, text').forEach((el) => {
          if (el.textContent?.endsWith(' ➕')) {
             el.textContent = el.textContent.replace(' ➕', ' ➖');
          } else if (el.textContent?.endsWith(' ➖')) {
             el.textContent = el.textContent.replace(' ➖', ' ➕');
          }
        });
      }

      const h = (window as any).__c4Hierarchy;
      if (!h || !h[nodeId]) return;

      const directChildren = h[nodeId] || [];
      if (directChildren.length === 0) return;

      // Determine collapse state from the first child
      let isCollapsed = false;
      for (const cId of directChildren) {
        const cEl = document.querySelector(`[id*="-${cId}-"]`) as HTMLElement;
        if (cEl) {
          isCollapsed = cEl.style.display !== 'none';
          break;
        }
      }

      const display = isCollapsed ? 'none' : '';
      
      const toggleDescendants = (id: string) => {
        const children = h[id] || [];
        for (const cId of children) {
          const el = document.querySelector(`[id*="-${cId}-"]`) as HTMLElement;
          if (el) el.style.display = display;
          
          // Also hide/show edges connected to this child in mermaid
          // Mermaid C4 flowchart edges don't nicely match by class/id, so we just let them disconnect.
          // Recursively toggle
          toggleDescendants(cId);
        }
      };

      toggleDescendants(nodeId);
    };
  }, [hierarchy]);


  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search graph nodes..."
              className="w-full min-w-0 border-none bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500 sm:w-56"
            />
          </div>
          {showLegend ? (
            <div className="flex flex-wrap gap-2">
              {helpContent && (
                <button
                  type="button"
                  onClick={() => {
                    setShowHelp(!showHelp);
                  }}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                    showHelp
                      ? "border-sky-400 bg-sky-500/15 text-sky-200"
                      : "border-slate-700 bg-slate-950/70 text-slate-300 hover:border-slate-500 hover:text-slate-100"
                  }`}
                >
                  <HelpCircle size={14} />
                  Help
                </button>
              )}

              <div className="mx-1 h-8 w-px bg-slate-800" />

              {[
                {
                  key: "showNpmImports",
                  label: "External",
                  icon: Package,
                },
                {
                  key: "showTypes",
                  label: "Types",
                  icon: Boxes,
                },
                {
                  key: "showPrivateFunctions",
                  label: "Private",
                  icon: FunctionSquare,
                },
                {
                  key: "showExportedFunctions",
                  label: "Exported",
                  icon: Share2,
                },
              ].map((toggle) => {
                const active = options[toggle.key as keyof GraphDisplayOptions] as boolean;
                const Icon = toggle.icon;
                return (
                  <button
                    key={toggle.key}
                    type="button"
                    onClick={() => setOptions((prev) => ({ ...prev, [toggle.key]: !active }))}
                    aria-pressed={active}
                    className={
                      active
                        ? "inline-flex items-center gap-2 rounded-full border border-sky-400 bg-sky-500/15 px-3 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20"
                        : "inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
                    }
                  >
                    <Icon size={14} />
                    {toggle.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {showHelp && helpContent && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-sky-300">
              <HelpCircle size={16} />
              Instructions & Tips
            </div>
            <button onClick={() => setShowHelp(false)} className="text-slate-500 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="text-sm text-slate-300">
            {helpContent}
          </div>
        </div>
      )}

      <details open>
        <summary className="cursor-pointer select-none rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:text-white">
          Code Dependency Graph
        </summary>
        <div className="relative mt-2">
          <MermaidClient chart={chart} nodeTooltips={nodeTooltips} highlightQuery={search} />
        </div>
      </details>
    </div>
  );
}
