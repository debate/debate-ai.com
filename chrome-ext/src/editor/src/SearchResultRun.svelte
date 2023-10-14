<script lang="ts">
  import type { StyleType, Query } from './types';
  import { getContext } from 'svelte';
  import type { Writable } from 'svelte/store';

  let query: Writable<Query> = getContext('query');
  export let text: string;
  export let style: StyleType;
  export let queryMatch: number;
  export let startCutoff: number;
</script>

<span
  class:bold={style.bold}
  class:underline={style.underline}
  class:highlight={style.highlight}
>
  {#if queryMatch != undefined}
    {text.slice(startCutoff, queryMatch)}<mark
      >{text.slice(queryMatch, $query.text.length + queryMatch)}</mark
    >{text.slice($query.text.length + queryMatch)}
  {:else}
    {text.slice(startCutoff)}
  {/if}
</span>

<style>
  span {
    overflow-wrap: break-word;
    color: var(--text);
    display: inline;
    border-radius: 0.3em;
    font-size: 1em;
    line-height: 1.5em;
  }
  .bold {
    font-weight: var(--bold);
    color: var(--text-strong);
  }
  .underline {
    text-decoration: underline;
  }
  .highlight {
    background-color: var(--back-highlight);
    color: var(--text-strong);
  }
  mark {
    background-color: var(--back-mark);
    color: var(--text-strong);
    border-radius: 0.3em;
  }
</style>
