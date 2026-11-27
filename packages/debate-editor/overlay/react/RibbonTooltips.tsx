/**
 * shadcn tooltips for the engine's toolbar.
 *
 * The ribbon is imperative DOM driven by the engine, so there is no React
 * element per button to wrap in `<Tooltip>`. Instead the engine's tooltip
 * controller (`ribbon-tooltips.ts`) hands this host the hovered/focused
 * button and its content, and one controlled shadcn `Tooltip` is anchored to
 * a phantom trigger laid over that button. Delay is 0: the tip appears the
 * moment the pointer lands or keyboard focus arrives.
 */
import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";

import { Kbd, KbdGroup } from "../ui/primitives/kbd";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/primitives/tooltip";
import { setRibbonTipRenderer, type RibbonTipContent } from "../editor/ribbon-tooltips";

export interface RibbonTipState {
  content: RibbonTipContent;
  rect: { top: number; left: number; width: number; height: number };
}

/** Splits a formatted shortcut ("Ctrl+Shift+F11", "⌘⇧F11") into key caps;
 *  single letters are upper-cased the way they are printed on a keyboard. */
export function splitShortcut(shortcut: string): string[] {
  return splitCaps(shortcut).map((cap) => (/^[a-z]$/.test(cap) ? cap.toUpperCase() : cap));
}

function splitCaps(shortcut: string): string[] {
  const trimmed = shortcut.trim();
  if (!trimmed) return [];
  if (trimmed.includes("+") && !/^[⌘⇧⌥⌃]/.test(trimmed)) {
    const parts = trimmed.split("+");
    // "Ctrl++" splits to a trailing empty token: that is the literal "+" key.
    const caps: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] !== "") caps.push(parts[i]!);
      else if (i === parts.length - 1 && caps.length > 0) caps.push("+");
    }
    return caps;
  }
  const caps: string[] = [];
  let rest = trimmed;
  while (rest.length > 0 && /^[⌘⇧⌥⌃]/.test(rest)) {
    caps.push(rest[0]!);
    rest = rest.slice(1);
  }
  if (rest) caps.push(...(rest.includes("+") ? splitCaps(rest) : [rest]));
  return caps;
}

let lastShown: RibbonTipState | null = null;
type Listener = () => void;
let current: RibbonTipState | null = null;
const listeners = new Set<Listener>();

function setCurrent(next: RibbonTipState | null): void {
  current = next;
  listeners.forEach((l) => l());
}
function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function RibbonTooltipHost() {
  const state = useSyncExternalStore(subscribe, () => current, () => null);
  // Keep the last content mounted while the closing animation runs.
  const shown = state ?? lastShown;
  if (state) lastShown = state;
  if (!shown) return null;
  const { content, rect } = shown;
  const keys = content.shortcut ? splitShortcut(content.shortcut) : [];
  return (
    <TooltipProvider delayDuration={0} skipDelayDuration={0}>
      <Tooltip open={state !== null}>
        <TooltipTrigger asChild>
          <span
            aria-hidden="true"
            data-ribbon-tooltip-anchor=""
            style={{
              position: "fixed",
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              pointerEvents: "none",
            }}
          />
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          sideOffset={6}
          collisionPadding={8}
          className="z-[1200] max-w-64 px-3 py-2 shadow-md"
          data-ribbon-tooltip=""
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              {content.label ? <span className="text-xs font-semibold">{content.label}</span> : null}
              {keys.length > 0 ? (
                <KbdGroup>
                  {keys.map((key, i) => (
                    <Kbd key={`${key}-${i}`}>{key}</Kbd>
                  ))}
                </KbdGroup>
              ) : null}
            </div>
            {content.description ? (
              <p className="text-background/75 text-xs leading-snug text-pretty">{content.description}</p>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
const HOST_ID = "dec-ribbon-tooltips";

/** Mounts the host and routes the engine's tooltip controller through it.
 *  Returns an uninstall function (used by tests). */
export function installRibbonTooltips(doc: Document = document): () => void {
  const win = doc.defaultView;
  const container = doc.createElement("div");
  container.id = HOST_ID;
  doc.body.appendChild(container);
  const root = createRoot(container);
  root.render(<RibbonTooltipHost />);

  const hide = () => setCurrent(null);
  setRibbonTipRenderer({
    show(target, content) {
      const r = target.getBoundingClientRect();
      setCurrent({ content, rect: { top: r.top, left: r.left, width: r.width, height: r.height } });
    },
    hide,
  });
  win?.addEventListener("scroll", hide, true);
  win?.addEventListener("resize", hide);

  return () => {
    win?.removeEventListener("scroll", hide, true);
    win?.removeEventListener("resize", hide);
    setRibbonTipRenderer(null);
    setCurrent(null);
    lastShown = null;
    root.unmount();
    container.remove();
  };
}
