<script lang="ts">
  import { getContext } from 'svelte';
  import { PanelLeft } from 'lucide-svelte';
  import { cn } from '$lib/utils';
  import type { Writable } from 'svelte/store';

  let className: string | undefined = undefined;
  export { className as class };

  const context = getContext<{toggleSidebar: () => void}>('sidebar');
  const toggleSidebar = context?.toggleSidebar;

  function handleClick() {
    toggleSidebar?.();
  }
</script>

<button
  class={cn(
    'inline-flex h-9 w-9 items-center justify-center rounded-md border border-input',
    'bg-transparent hover:bg-accent hover:text-accent-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    className
  )}
  on:click={handleClick}
>
  <PanelLeft class="h-4 w-4" />
  <span class="sr-only">Toggle Sidebar</span>
</button>
