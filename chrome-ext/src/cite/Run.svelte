<script lang="ts">
  import { getContext } from 'svelte';
  import type { Readable, Writable } from 'svelte/store';
  let currentTool: Writable<null | 'highlight' | 'underline' | 'eraser'> =
    getContext('currentTool');
  export let run: {
    text: string;
    underline: boolean;
    highlight: boolean;
  };
</script>

<span
  class:underline={run.underline}
  class:highlight={run.highlight}
  class:highlight-underline={run.underline && run.highlight}>{run.text}</span
>

<style>
  span {
    white-space: pre-wrap;
    transition: background 0.1s;
    line-height: 1.6em;
  }
  .underline {
    text-decoration: underline;
    color: var(--text-strong);
  }
  .highlight {
    background-color: var(--background-highlight);
    border-radius: var(--radius);
  }
  span::selection {
    background-color: var(--background-select);
  }
  :global(.shrunk) span:not(.underline) {
    font-size: 0.5rem;
  }
</style>
