<script lang="ts">
  import { setContext } from 'svelte';
  import { writable } from 'svelte/store';

  export let open = true;
  export let defaultOpen = true;

  const isOpen = writable(open ?? defaultOpen);

  $: isOpen.set(open);

  function toggleSidebar() {
    isOpen.update(v => !v);
  }

  setContext('sidebar', {
    isOpen,
    toggleSidebar
  });
</script>

<div class="flex min-h-screen w-full">
  <slot />
</div>
