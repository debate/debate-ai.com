<script lang="ts">
  import type { RunType, Query } from './types';
  import { getContext, onMount, tick } from 'svelte';
  import { writable } from 'svelte/store';
  import type { Writable } from 'svelte/store';
  import { paraButtons } from './transition';

  import Run from './Run.svelte';
  import Icon from './Icon.svelte';
  import Button from './Button.svelte';
  export let copySelfAndChildren: () => Promise<unknown>;
  export let runs: RunType[] = [];
  export let outline_level: number;
  export let index: number;
  let elementType = 'p';
  if (outline_level === 0) {
    elementType = 'h1';
  } else if (outline_level === 1) {
    elementType = 'h2';
  } else if (outline_level === 2) {
    elementType = 'h3';
  } else if (outline_level === 3) {
    elementType = 'h4';
  } else if (outline_level === 4) {
    elementType = 'h5';
  } else if (outline_level === 5) {
    elementType = 'h6';
  }

  let query: Writable<Query> = getContext('query');
  let selectedQuery: Writable<{ paraIndex: number; charIndex: number }> =
    getContext('selectedQuery');
  let displayRuns: (RunType & {
    queryMatches?: number[];
    selectedQueryMatch?: number;
  })[] = [];
  let combinedText = runs.reduce((prev, curr) => prev + curr.text, '');
  function onQueryUpdate() {
    if ($query.onlyOutline && outline_level == null) {
      displayRuns = runs;
      return;
    }
    displayRuns = [];

    let matches = [];
    if ($query.text.length > 0) {
      let queryText = $query.text;
      let formatText = combinedText;
      if (!$query.matchCase) {
        queryText = queryText.toLowerCase();
        formatText = formatText.toLowerCase();
      }
      // get indexes of all matches
      matches = [];
      let charIndex = formatText.indexOf(queryText);
      while (charIndex < formatText.length && charIndex != -1) {
        matches.push(charIndex);
        charIndex = formatText.indexOf(queryText, charIndex + 1);
      }
    }
    let i = 0;
    for (let run of runs) {
      let queryMatches = [];
      let selectedQueryMatch = undefined;
      for (let match of matches) {
        if (match + $query.text.length >= i && match < i + run.text.length) {
          queryMatches.push(match - i);
          if (
            index === $selectedQuery.paraIndex &&
            match === $selectedQuery.charIndex
          ) {
            selectedQueryMatch = queryMatches.length - 1;
          }
        }
      }
      displayRuns.push({
        ...run,
        queryMatches,
        selectedQueryMatch,
      });

      i += run.text.length;
    }
  }
  $: $query, $selectedQuery, onQueryUpdate();
  function getClipboardHTML() {
    let paraNode = document.createElement(elementType);
    paraNode.setAttribute(
      'style',
      `
      font-family: Calibri;
      line-height: 1em;
    `
    );
    for (let run of runs) {
      let runNode = document.createElement('span');
      runNode.setAttribute(
        'style',
        `
        font-weight: ${run.style.bold ? 'bold' : 'normal'};
        text-decoration: ${run.style.underline ? 'underline' : 'none'};
        font-size: ${run.style.size ? run.style.size / 2 : 12}pt;
        background-color: ${run.style.highlight ? 'yellow' : 'none'};
      `
      );
      runNode.innerText = run.text.replaceAll('\n', '').replaceAll('\r', '');
      paraNode.appendChild(runNode);
    }
    return paraNode;
  }
  function getClipboardText() {
    let text = '';
    for (let run of runs) {
      text += run.text;
    }
    return text;
  }
  function copySelf() {
    const clipboardItem = new window.ClipboardItem({
      'text/html': new Blob([getClipboardHTML().outerHTML], {
        type: 'text/html',
      }),
      'text/plain': new Blob([getClipboardText()], { type: 'text/plain' }),
    });
    navigator.clipboard.write([clipboardItem]);
  }
  let loading = false;
  let showButtons = false;
</script>

<!-- TODO make the buttonsContainer detect hover correctly -->
<div class="top" on:click={() => console.log(index)}>
  <div
    class="buttonsContainer"
    class:showButtons
    on:mouseenter={() => (showButtons = true)}
    on:mouseleave={() => (showButtons = false)}
  >
    <div class="buttons" class:loading>
      <Button
        on:click={() => {
          copySelf();
        }}
      >
        <Icon name="copy" />
      </Button>
      <Button
        disabled={loading}
        on:click={async () => {
          loading = true;
          await copySelfAndChildren();
          loading = false;
        }}
      >
        <Icon name="copyBelow" />
      </Button>
    </div>
  </div>
  <svelte:element
    this={elementType}
    class="para"
    on:click={() => console.log(index)}
  >
    {#each displayRuns as run}
      <Run
        text={run.text}
        style={run.style}
        queryMatches={run.queryMatches}
        selectedQueryMatch={run.selectedQueryMatch}
      />
    {/each}
  </svelte:element>
</div>

<style>
  .top {
    position: relative;
    height: auto;
    width: auto;
    transition: background 0.3s;
  }
  .buttonsContainer {
    position: relative;
    pointer-events: none;

    width: 30%;
    height: 100%;
    position: absolute;
    z-index: 1;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }
  .buttons {
    position: absolute;
    display: flex;
    flex-direction: row;
    gap: var(--padding);
    opacity: 0;
    color: var(--text);

    transition: opacity var(--transition-speed);
  }

  .buttons.loading,
  .showButtons .buttons {
    opacity: 1;
  }
  .buttons.loading {
    color: var(--text-weak);
  }
  .para {
    font-size: 1em;
    text-decoration: none;
    font-weight: normal;
    display: block;
    position: relative;
    overflow-wrap: break-word;
    word-break: break-word;
    margin: 0;
    padding: 0;
    padding-top: 2em;
  }
  .para::selection {
    background: hsl(var(--hue), 70%, 50%, 0.3);
  }
</style>
