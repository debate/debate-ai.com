<script lang="ts">
  import { cn } from '$lib/utils';
  import { getContext } from 'svelte';
  import type { Writable } from 'svelte/store';

  let className: string | undefined = undefined;
  export { className as class };
  export let isActive = false;
  export let variant: 'default' | 'outline' = 'default';
  export let size: 'default' | 'sm' | 'lg' = 'default';
  export let tooltip: string | undefined = undefined;

  const context = getContext<{isOpen: Writable<boolean>}>('sidebar');
  const isOpen = context?.isOpen;
</script>

<button
  class={cn(
    'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors',
    'hover:bg-accent hover:text-accent-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isActive && 'bg-accent text-accent-foreground',
    variant === 'outline' && 'border border-input bg-background',
    size === 'sm' && 'h-8 px-1.5 text-xs',
    size === 'lg' && 'h-12 px-4',
    className
  )}
  title={tooltip}
  on:click
>
  <slot />
</button>
