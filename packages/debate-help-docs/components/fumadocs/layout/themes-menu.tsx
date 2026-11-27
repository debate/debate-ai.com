'use client';
/**
 * @file themes-menu.tsx
 * @description The docs header's "Themes" dropdown, in place of Fumadocs' own
 * light/dark switch.
 *
 * It offers what the app offers: Light, Dark and System, then every colour
 * theme in the app's registry (`THEME_NAMES`, via `themeNames` in
 * debate-webview's `ThemeDropdown`). The choice goes through the app's own
 * `useThemeState` hook, so it is stored exactly as the app stores it —
 * next-themes' `theme` key for the mode, `color-theme` in localStorage and a
 * cookie for the colour theme, the `theme-<name>` class on <html>, and the
 * account sync when signed in — and docs and app always agree. The docs'
 * stylesheet reads the same shadcn variables those classes set
 * (`styles/docs.css`), so every theme applies to Fumadocs' own components too.
 *
 * Two looks: `toolbar` (a large icon over a small label, for the header's
 * button group, wrapped by the caller in a `ToolbarItem` tooltip) and `icon`
 * (a plain icon button, for the narrow header).
 *
 * The icon is Lucide's `swatch-book`.
 */
import { useSyncExternalStore } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, Monitor, Moon, Sun, SwatchBook } from 'lucide-react';
import {
  formatThemeName,
  themeColors,
  themeNames,
  useThemeState,
} from '@debate-ai/webview/components/theme/ThemeDropdown';
import { cn } from '../../../lib/utils';

/** The colour theme the app falls back to when <html> carries no `theme-*` class. */
export const DEFAULT_COLOR_THEME = 'modern-minimal';

/** The modes the menu offers, in order: next-themes' `light`, `dark` and `system`. */
export const THEME_MODE_OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const;

/** The colour theme named by the `theme-<name>` class on `root`, if it is one the app knows. */
export function readActiveColorTheme(root: Element): string {
  for (const name of themeNames) {
    if (root.classList.contains(`theme-${name}`)) return name;
  }
  return DEFAULT_COLOR_THEME;
}

function subscribeToRootClass(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

/**
 * The active colour theme, read off <html>. Every part of the app that picks a
 * theme (this menu, the dock's Themes submenu, the account sync) ends by
 * setting that class, so reading it keeps two menus on one page in step —
 * the header shows one per breakpoint — where each hook's own state would not.
 */
function useActiveColorTheme(): string {
  return useSyncExternalStore(
    subscribeToRootClass,
    () => readActiveColorTheme(document.documentElement),
    () => DEFAULT_COLOR_THEME,
  );
}

const itemClass =
  'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[state=checked]:font-medium';

function Swatches({ name }: { name: string }) {
  const colors = themeColors[name];
  if (!colors) return <span aria-hidden className="size-3 shrink-0" />;
  return (
    <span aria-hidden className="flex shrink-0 items-center gap-1">
      <span className="size-3 rounded-full border border-black/10" style={{ backgroundColor: colors.primary }} />
      <span className="size-3 rounded-full border border-black/10" style={{ backgroundColor: colors.secondary }} />
    </span>
  );
}

export function ThemesMenu({
  variant = 'toolbar',
  className,
  onOpenChange,
}: {
  variant?: 'toolbar' | 'icon';
  className?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const { mounted, mode, setMode, handleThemeChange } = useThemeState();
  const colorTheme = useActiveColorTheme();
  const currentMode = mounted ? (mode ?? 'light') : '';
  const currentColor = mounted ? colorTheme : '';

  return (
    <DropdownMenu.Root onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>
        {variant === 'toolbar' ? (
          <button type="button" aria-label="Themes" data-themes-trigger="" className={className}>
            <SwatchBook aria-hidden />
            <span>Themes</span>
          </button>
        ) : (
          <button
            type="button"
            aria-label="Themes"
            title="Themes"
            data-themes-trigger=""
            className={cn(
              'inline-flex size-8 items-center justify-center rounded-md text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground aria-expanded:bg-fd-accent aria-expanded:text-fd-accent-foreground [&_svg]:size-5',
              className,
            )}
          >
            <SwatchBook aria-hidden />
          </button>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          collisionPadding={8}
          aria-label="Themes"
          data-themes-menu=""
          className="z-[100] max-h-[min(34rem,var(--radix-dropdown-menu-content-available-height))] w-56 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Appearance</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={currentMode} onValueChange={(value) => setMode(value as 'light' | 'dark' | 'system')}>
            {THEME_MODE_OPTIONS.map(({ value, label, Icon }) => (
              <DropdownMenu.RadioItem
                key={value}
                value={value}
                className={itemClass}
                data-theme-mode={value}
                onSelect={(event) => event.preventDefault()}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                <span className="flex-1">{label}</span>
                <DropdownMenu.ItemIndicator>
                  <Check aria-hidden className="size-4" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-border" />
          <DropdownMenu.Label className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Color theme</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={currentColor} onValueChange={handleThemeChange}>
            {themeNames.map((name) => (
              <DropdownMenu.RadioItem key={name} value={name} className={itemClass} data-color-theme={name}>
                <Swatches name={name} />
                <span className="flex-1">{formatThemeName(name)}</span>
                <DropdownMenu.ItemIndicator>
                  <Check aria-hidden className="size-4" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
