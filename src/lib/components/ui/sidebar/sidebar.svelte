<script lang="ts">
  import { getContext } from 'svelte';
  import { cn } from '$lib/utils';
  import type { Writable } from 'svelte/store';

  let className: string | undefined = undefined;
  export { className as class };
  export let side: 'left' | 'right' = 'left';
  export let variant: 'sidebar' | 'floating' | 'inset' = 'sidebar';
  export let collapsible: 'offcanvas' | 'icon' | 'none' = 'offcanvas';

  const context = getContext<{isOpen: Writable<boolean>}>('sidebar');
  const isOpen = context?.isOpen;

  $: sidebarClasses = cn(
    'flex h-full flex-col border-r bg-background transition-all duration-300',
    variant === 'floating' && 'rounded-lg border shadow-md',
    variant === 'inset' && 'ml-2 rounded-lg border shadow-sm',
    collapsible === 'offcanvas' && !$isOpen && '-translate-x-full',
    collapsible === 'icon' && !$isOpen && 'w-16',
    side === 'right' && 'border-l border-r-0',
    className
  );
</script>

<aside
  class={sidebarClasses}
  data-state={$isOpen ? 'open' : 'collapsed'}
  data-side={side}
>
  <slot />
</aside>
