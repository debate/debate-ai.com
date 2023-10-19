<script lang="ts">
  import type { IMessage } from '../types';
  import Message from './Message.svelte';
  import { createTransition } from './transition';
  import { messages } from './stores';
  let minimized = false;
  let listTransition = createTransition((t, eased) => {
    return `
      transform: scale(${eased});
    `;
  }, 'sineIn');
  let miniTransition = createTransition((t, eased) => {
    return `
      transform: scale(${eased});
    `;
  }, 'sineOut');
</script>

<div class="top" class:minimized on:click={() => (minimized = !minimized)}>
  {#if $messages.length > 0}
    {#if !minimized}
      <ul transition:listTransition>
        {#each $messages as message (message.id)}
          <Message {...message} />
        {/each}
      </ul>
    {:else}
      <div class="mini" transition:miniTransition />
    {/if}
  {/if}
</div>

<style>
  .top {
    width: 10rem;
    height: auto;
    position: fixed;
    z-index: 9999;
    bottom: 0;
    right: 0;
    display: flex;
    flex-direction: column-reverse;
    padding: var(--padding);
    box-sizing: border-box;
    pointer-events: none;
  }
  .mini {
    transform-origin: center;
    padding: var(--padding-small);
    height: 0.8rem;
    width: 0.8rem;
    color: var(--text-tooltip);
    background-color: var(--background-tooltip);
    border-radius: var(--radius-big);
    position: absolute;
    bottom: var(--padding);
    right: var(--padding);
    box-shadow: var(--shadow);
    pointer-events: all;
  }
  ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--padding-small);
    padding: 0;
    align-items: flex-end;
    margin: 0;
    user-select: none;
    transform-origin: bottom right;
  }
</style>
