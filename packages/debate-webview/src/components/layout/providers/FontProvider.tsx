/**
 * @fileoverview Wraps the whole application shell so every part of it — dock,
 * sidebars, player, page content and anything rendered inside — takes its
 * typeface from one place: the explicit font picked in `UserSettingsPanel`
 * (the `--app-font` custom property on `<html>`) when there is one, otherwise
 * the active colour theme's `--font-sans` from `styles/themes.css`. Switching
 * the theme therefore switches the font across the shell, not just on `<body>`.
 *
 * Renders a `display: contents` element so it adds no box to the layout; the
 * `font-family` rule lives on `[data-font-provider]` in `styles/app.css`.
 */

'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { applyFontFamily, readLocalFontFamily } from '@debate-ai/round';

export function FontProvider({ children }: { children?: ReactNode }) {
  useEffect(() => {
    const apply = () => applyFontFamily(readLocalFontFamily());
    apply();
    window.addEventListener('client-config-changed', apply);
    window.addEventListener('storage', apply);
    return () => {
      window.removeEventListener('client-config-changed', apply);
      window.removeEventListener('storage', apply);
    };
  }, []);

  return (
    <div data-font-provider="" className="contents">
      {children}
    </div>
  );
}
