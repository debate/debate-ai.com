/**
 * @fileoverview Thin wrapper around next-themes ThemeProvider that wires up
 * application-wide light/dark mode support.
 */

'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

/**
 * Application theme provider that delegates to next-themes.
 * Accepts all ThemeProviderProps and forwards them along with children.
 * @param children - Child elements that gain access to the theme context.
 * @param props - Additional next-themes ThemeProvider configuration props.
 * @returns The NextThemesProvider wrapping children.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
