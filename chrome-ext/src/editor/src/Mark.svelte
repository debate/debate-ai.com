<script lang="ts">
  import { selectMark } from './transition';
  import { onMount } from 'svelte';
  import type Loader from './Loader.svelte';
  import { getContext } from 'svelte';

  export let selected = false;
  let element: HTMLElement;
  let getDocLoader: () => Loader = getContext('getDocLoader');

  let redraw = false;
  function onSelectedChange() {
    if (selected) {
      console.log('pls teleport');
      getDocLoader().onTeleportDone(function () {
        element.scrollIntoView({
          block: 'start',
          inline: 'nearest',
        });
        redraw = !redraw;
      });
    }
  }
  $: selected, onSelectedChange;
  onMount(onSelectedChange);
</script>

{#key redraw}
  {#if selected}
    <mark in:selectMark class:selected bind:this={element}>
      <slot />
    </mark>
  {:else}
    <mark>
      <slot />
    </mark>
  {/if}
{/key}

<style>
  mark {
    font-size: max(15px, 1em);
    background-color: var(--back-mark);
    color: var(--text-strong);
    border-radius: 0.3em;
  }
  mark.selected {
    background-color: var(--back-mark-selected);
  }
</style>
