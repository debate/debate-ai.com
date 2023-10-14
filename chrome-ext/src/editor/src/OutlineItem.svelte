<script lang="ts">
  import type { RunType } from './types';
  import { getContext } from 'svelte';
  import type Loader from './Loader.svelte';
  import Button from './Button.svelte';
  import TurningArrow from './TurningArrow.svelte';

  export let outlineLevel: number = 0;
  $: indent = Math.min(outlineLevel, 3);
  export let toggleFold: () => void;
  export let link: number;
  export let runs: RunType[];
  export let index: number;
  export let selected: boolean = false;
  export let foldedParent: boolean = false;
  let text = '';
  $: {
    text = '';
    for (let run of runs) {
      text += run.text;
    }
  }
  let getDocLoader: () => Loader = getContext('getDocLoader');
</script>

<li
  style={`margin-left: ${indent}em`}
  on:click={() => {
    getDocLoader().teleport(link);
  }}
  class:selected
  class:foldedParent
  class:hasButtons={outlineLevel < 3}
  class:bold={indent < 3}
  class:big={indent < 2}
>
  {#if outlineLevel < 3}
    <button
      class="folder"
      on:click={(e) => {
        e.stopPropagation();
        toggleFold();
      }}
    >
      <TurningArrow direction={foldedParent ? 'left' : 'down'} />
    </button>
  {/if}
  <div class="content">
    <span>
      {text}
    </span>
  </div>
</li>

<style>
  li {
    display: flex;
    flex-direction: row;
    list-style-type: none;
    border-radius: var(--border-radius);
    cursor: default;
    min-height: 1em;
    font-size: 0.8em;
    height: min-content;
  }
  li:hover {
    background-color: var(--back-two-hover);
  }
  li:active,
  li.selected {
    background-color: var(--back-two-active);
  }
  span {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    width: auto;
    overflow-wrap: break-word;
    word-break: break-word;
    overflow: hidden;
  }
  .bold {
    font-weight: var(--bold);
    color: var(--text-strong);
  }
  .big {
    font-size: 1.5em;
  }
  .content {
    padding: var(--padding);
  }
  .folder {
    opacity: 0;
    position: absolute;
    right: var(--padding);
    color: var(--text);
    background: none;
    outline: none;
    width: 2rem;
    height: 2rem;
    border: none;
    padding: 0.5rem;
    line-height: 1;

    font-size: 1rem;
    border-radius: 0 var(--border-radius) var(--border-radius) 0;
  }
  li.foldedParent .folder {
    opacity: 1;
    background: var(--back-two);
  }
  li:hover .folder {
    opacity: 1;
    background: var(--back-two-hover);
    /* dont transition out */
    transition: opacity var(--transition-speed);
  }
  li:active > .folder,
  li.selected:hover > .folder {
    opacity: 1;
    background-color: var(--back-two-active);
  }
</style>
