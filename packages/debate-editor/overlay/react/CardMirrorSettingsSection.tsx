"use client";

/**
 * One CardMirror settings category, rendered live inside a host page — the
 * piece a site Settings sidebar shows when one of `CARDMIRROR_SETTINGS_TABS`
 * is selected.
 *
 * Wraps `buildEmbeddedSettingsPanel` (`editor/settings-ui.ts`): the rows
 * read and write the same settings store the editor uses, so a change here
 * applies to every open editor at once. Only one category is ever built at a
 * time — the settings UI ties each row's store subscription to the current
 * panel and flushes the previous one when a new panel is built — so mount
 * one of these per page and change `category` rather than mounting several.
 *
 * The host loads the stylesheet (`@debate/editor/styles.css`); this
 * component only lazy-loads the settings modules, so importing it from the
 * package root costs nothing until it renders.
 */

import { useEffect, useRef, useState } from "react";
import type { SettingsCategory } from "../editor/settings.js";

export interface CardMirrorSettingsSectionProps {
  category: SettingsCategory;
  /** Called with the setting keys whose rows rendered — what a host that
   *  mirrors settings to an account should limit itself to, since the editor
   *  hides rows that don't apply on this host. */
  onRowsRendered?: (keys: string[]) => void;
  className?: string;
}

export function CardMirrorSettingsSection({
  category,
  onRowsRendered,
  className,
}: CardMirrorSettingsSectionProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const onRowsRenderedRef = useRef(onRowsRendered);
  onRowsRenderedRef.current = onRowsRendered;

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void import("../editor/settings-ui.js").then((ui) => {
      const host = hostRef.current;
      if (cancelled || !host) return;
      const panel = ui.buildEmbeddedSettingsPanel(category);
      host.appendChild(panel.element);
      setReady(true);
      const keys = [...panel.element.querySelectorAll<HTMLElement>("[data-setting-key]")]
        .map((row) => row.dataset["settingKey"])
        .filter((key): key is string => !!key);
      onRowsRenderedRef.current?.(keys);
      cleanup = () => {
        panel.destroy();
        panel.element.remove();
      };
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [category]);

  return (
    <div className={className}>
      {!ready && <p style={{ fontSize: 14, opacity: 0.7 }}>Loading…</p>}
      <div ref={hostRef} />
    </div>
  );
}
