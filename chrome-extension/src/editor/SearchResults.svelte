<script lang="ts">
  import Loader from './Loader.svelte';
  import SearchResult from './SearchResult.svelte';
  import Panel from './Panel.svelte';
  import Checkbox from './Checkbox.svelte';
  import Form from './Form.svelte';
  import { invoke } from './api.js';
  import { getContext } from 'svelte';
  import type { Writable } from 'svelte/store';
  import type { SearchResultType, LoaderState, Query } from './types';
  import { Align } from './types';
  import { tick } from 'svelte';
  import { searchAside } from './transition';

  let viewerElement: HTMLElement;
  let loader: Loader;
  let query: Writable<Query> = getContext('query');

  export function getLoader() {
    return loader;
  }
  export let state: {
    matchCase: boolean;
    onlyOutline: boolean;
    loader: LoaderState;
  };
  async function serverCommand(i: number, j: number) {
    if ($query.text.length > 0) {
      let ret = (await invoke('search', {
        query: {
          text: $query.text,
          match_case: $query.matchCase,
          only_outline: $query.onlyOutline,
        },
        i: i,
        j: j,
      })) as SearchResultType[];
      return ret;
    }
    return [];
  }
  export let showSearchResults: boolean;
  $: $query, onQueryUpdate();
  async function onQueryUpdate() {
    selectedResultIndex = -1;
    if ($query.text.length > 0) {
      // only call teleport if loader already exists (it teleports by itself onMount)
      loader && loader.teleport(0, true);
    }
  }
  let selectedResultIndex: number = -1;
  function select(index: number) {
    selectedResultIndex = index;
  }
  let items = [];
  async function indexResult(newIndex: number) {
    // if element is loaded
    // if (
    //   items.length > 0 &&
    //   newIndex >= items[0].index &&
    //   newIndex < items[items.length - 1].index
    // ) {
    //   let element = loader.getItemsElement().children[
    //     newIndex - items[0].index
    //   ] as HTMLElement;
    //   // if its out of view
    //   if (
    //     element &&
    //     (element.offsetTop < viewerElement.scrollTop ||
    //       element.offsetTop + element.offsetHeight >
    //         viewerElement.scrollTop + viewerElement.clientHeight)
    //   ) {
    //     // teleport to it
    //     await loader.teleport(newIndex);
    //     select(newIndex);
    //   } else {
    //     // else just select it
    //     select(newIndex);
    //   }
    // } else {
    // else teleport to it
    loader.teleport(newIndex);
    // if that was the last item, select the one before it
    // if (items.length == 0) {
    //   newIndex -= 1;
    //   await loader.teleport(newIndex);
    // }
    loader.onTeleportDone(function () {
      select(newIndex);
    });
  }
  export function prevResult() {
    if (selectedResultIndex > 0) {
      indexResult(selectedResultIndex - 1);
    }
  }
  export function nextResult() {
    indexResult(selectedResultIndex + 1);
  }
  $: $query.matchCase = state.matchCase;
  $: $query.onlyOutline = state.onlyOutline;
</script>

<div class="hider">
  {#if $query.text.length > 0}
    <div class="top" transition:searchAside class:showSearchResults>
      <div class="options">
        <Panel icon={'funnel'} align={Align.TopRight} title={'Filter results'}>
          <Form>
            <Checkbox labelText={'Match case'} bind:value={state.matchCase} />
            <Checkbox
              labelText={'Only incude headers'}
              bind:value={state.onlyOutline}
            />
          </Form>
        </Panel>
      </div>
      <div bind:this={viewerElement} class="viewer">
        <div class="content">
          <Loader
            bind:this={loader}
            bind:items
            {viewerElement}
            {serverCommand}
            fetchAmount={30}
            bind:state={state.loader}
          >
            {#each items as item (item.index)}
              <SearchResult
                link={item.link}
                index={item.index}
                para={item.para}
                queryIndex={item.query_index}
                selected={item.index == selectedResultIndex}
                selectSelf={() => select(item.index)}
              />
            {/each}
          </Loader>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .hider {
    width: inherit;
    height: inherit;
    overflow: hidden;
  }
  .top {
    background-color: var(--back-two);
    width: 100%;
    height: 100vh;
    box-sizing: border-box;
    padding-top: var(--topbar-height);
    display: block;
    transition: transform 300ms;
    position: relative;
  }
  .top.showSearchResults {
    opacity: 1;
    pointer-events: auto;
    transform: none;
  }
  .top {
    transform: translateX(100%);
    pointer-events: none;
  }
  .viewer {
    padding: var(--padding);
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    overflow: scroll;
    position: relative;
  }
  .content {
    box-sizing: border-box;
    padding: 0;
    width: 100%;
    height: auto;
  }
  .options {
    position: absolute;
    z-index: 2;
    padding: 0 var(--padding-small);
    width: 100%;
    box-sizing: border-box;
  }
</style>
