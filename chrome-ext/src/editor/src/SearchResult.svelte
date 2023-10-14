<script lang="ts">
  import SearchResultRun from './SearchResultRun.svelte';
  import type { ParaType, Query } from './types';
  import type Loader from './Loader.svelte';

  import { getContext, onMount, tick } from 'svelte';
  import type { Writable } from 'svelte/store';

  export let link: number;
  export let index: number;
  export let para: ParaType;
  export let queryIndex: number;
  export let selected: boolean;

  let query: Writable<Query> = getContext('query');
  let selectedQuery: Writable<{ paraIndex: number; charIndex: number }> =
    getContext('selectedQuery');
  let startIndex: number;
  let charIndex: number;
  let text = para.runs.reduce((prev, curr) => prev + curr.text, '');

  let displayRuns = [];
  $: {
    let formatText = text;
    if (!$query.matchCase) {
      formatText = text.toLowerCase();
    }
    // will be zero because +1
    charIndex = -1;
    // get the specific index charIndex from queryIndex
    for (let i = 0; i < queryIndex + 1; i++) {
      let queryText = $query.text;
      if (!$query.matchCase) {
        queryText = $query.text.toLowerCase();
      }
      charIndex = formatText.indexOf(queryText, charIndex + 1);
    }
    startIndex = Math.max(0, charIndex - 30);
    while (text[startIndex - 1] !== ' ') {
      if (startIndex >= charIndex) {
        startIndex = Math.max(0, charIndex - 30);
        break;
      }
      startIndex++;
    }
    // then loop through runs and apply
    let i = 0;
    for (let run of para.runs) {
      if (i + run.text.length > startIndex) {
        let startCutoff = 0;
        if (startIndex > i) {
          startCutoff = i - startIndex;
        }
        let queryMatch = undefined;
        if (
          charIndex + $query.text.length >= i &&
          charIndex < i + run.text.length
        ) {
          queryMatch = charIndex - i;
        }

        displayRuns.push({
          ...run,
          queryMatch,
          startCutoff,
        });
      }

      i += run.text.length;
    }
  }
  let element: HTMLElement;
  async function doTeleport() {
    getDocLoader().teleport(para.index);
    if (selected) {
      // reset query
      selectedQuery.set({
        paraIndex: null,
        charIndex: null,
      });
      await tick();
    }
    selectedQuery.set({ paraIndex: para.index, charIndex: charIndex });
  }
  $: {
    if (selected) {
      doTeleport();
    }
  }
  export let selectSelf: () => void;
  function handleClick() {
    if (selected) {
      doTeleport();
    } else {
      selectSelf();
    }
  }

  let getDocLoader: () => Loader = getContext('getDocLoader');
</script>

<li
  on:click={handleClick}
  on:mousedown|preventDefault
  class:selected
  bind:this={element}
>
  <p>
    {#each displayRuns as run}
      <SearchResultRun
        text={run.text}
        style={run.style}
        queryMatch={run.queryMatch}
        startCutoff={run.startCutoff}
      />
    {/each}
    <!-- <span class:ellipses={startIndex != 0}
      >{text.slice(startIndex, charIndex)}</span
    ><mark class:selected
      >{text.slice(charIndex, charIndex + $query.length)}</mark
    ><span>{text.slice(charIndex + $query.length)}</span> -->
  </p>
</li>

<style>
  li {
    list-style-type: none;
    padding: var(--padding);
    display: block;
    position: relative;
    border-radius: var(--border-radius);
    cursor: default;
    min-height: 1em;
    font-size: 0.8em;
  }
  li:hover {
    background-color: var(--back-two-hover);
  }
  li:active {
    background-color: var(--back-two-active);
  }
  li.selected,
  li.selected:hover {
    background-color: var(--back-two-active);
  }
  p {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    width: auto;
    overflow-wrap: break-word;
    word-break: break-word;
    overflow: hidden;
    margin: 0;
  }
  p::before {
    content: '...';
  }
</style>
