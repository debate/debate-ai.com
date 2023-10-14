<script lang="ts">
  import Loader from './Loader.svelte';
  import Para from './Para.svelte';
  import { tick, onMount } from 'svelte';
  import type { ParaType, LoaderState, Query } from './types';
  import { getContext } from 'svelte';
  import type { Writable } from 'svelte/store';
  import { getSelectionNode, copyToClipboard, getParaHTML } from './selection';
  import { register } from './shortcut';
  let isResizing: Writable<boolean> = getContext('isResizing');

  let query: Writable<Query> = getContext('query');
  let zoom: Writable<number> = getContext('zoom');

  export let showOutline: boolean;
  export let showSearchResults: boolean;
  export let state: {
    loader: LoaderState;
  };

  let viewerElement: HTMLElement;
  let loader: Loader;
  export function getLoader() {
    return loader;
  }
  let items = [];
  async function serverCommand(i: number, j: number) {
    /*return (await invoke('get_paras', {
      i,
      j,
    })) as (ParaType & { charIndex?: number })[]; */
  }
  async function handleZoom(event: WheelEvent) {
    if (event.ctrlKey) {
      event.preventDefault();
      $zoom -= event.deltaY * 0.01;
      $zoom = Math.max(Math.min($zoom, 8), 0.3);
      let ratio =
        (viewerElement.scrollTop + viewerElement.clientHeight / 2) /
        viewerElement.scrollHeight;
      await tick();
      viewerElement.scrollTop =
        viewerElement.scrollHeight * ratio - viewerElement.clientHeight / 2;
    }
  }
  let parasElement: HTMLElement;
  let lastSize: number[] = [undefined, undefined];
  const resizeObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
      if (entry.target === parasElement) {
        let size = [entry.contentRect.width, entry.contentRect.height];
        if (lastSize[0] !== size[0]) {
          let diff = lastSize[1] - size[1];
          let oldHeight = viewerElement.clientHeight;
          let ratio =
            (viewerElement.scrollTop + viewerElement.clientHeight / 2) /
            (viewerElement.scrollHeight + diff);
          viewerElement.scrollTop =
            viewerElement.scrollHeight * ratio - oldHeight / 2;
        }
        lastSize = size;
      }
    }
  });
  register('CommandOrControl+=', function () {
    $zoom += 0.1;
    $zoom = Math.max(Math.min($zoom, 8), 0.3);
    let ratio =
      (viewerElement.scrollTop + viewerElement.clientHeight / 2) /
      viewerElement.scrollHeight;
    viewerElement.scrollTop =
      viewerElement.scrollHeight * ratio - viewerElement.clientHeight / 2;
  });
  register('CommandOrControl+-', function () {
    $zoom -= 0.1;
    $zoom = Math.max(Math.min($zoom, 8), 0.3);
    let ratio =
      (viewerElement.scrollTop + viewerElement.clientHeight / 2) /
      viewerElement.scrollHeight;
    viewerElement.scrollTop =
      viewerElement.scrollHeight * ratio - viewerElement.clientHeight / 2;
  });
  register('CommandOrControl+c', function () {
    let copyNode = getSelectionNode(parasElement, items);
    copyNode && copyToClipboard(copyNode);
  });

  $: {
    if (showSearchResults && $query.text.length > 0 && !showOutline) {
      viewerElement.scrollLeft = viewerElement.scrollWidth;
    }
  }

  onMount(() => {
    resizeObserver.observe(parasElement);
  });
  async function copyParaAndChildren(index: number) {
    let ret = document.createElement('div');
    let loadedItems = items.slice(index);
    let para = items[index];
    ret.appendChild(getParaHTML(para));
    let i = 1;
    while (i < loadedItems.length) {
      let child = loadedItems[i];
      if (
        para.outline_level != null &&
        (child.outline_level == null ||
          child.outline_level > para.outline_level)
      ) {
        ret.appendChild(getParaHTML(child));
      } else {
        break;
      }
      // load more if needed
      if (i + 1 >= loadedItems.length) {
        let currentIndex = loadedItems[loadedItems.length - 1].index;
        let newItems = await serverCommand(
          currentIndex + 1,
          currentIndex + 1 + 30
        );
        // will be added by 1
        i = -1;
        loadedItems = newItems;
      }
      i++;
    }
    copyToClipboard(ret);
  }
  function canRemoveItem(_: any, itemElement: HTMLElement) {
    const selection = window.getSelection();
    return !(selection.rangeCount && selection.containsNode(itemElement, true));
  }
</script>

<svelte:window />
<div
  class="viewer"
  on:wheel={handleZoom}
  bind:this={viewerElement}
  class:showOutline
  class:showSearchResults={showSearchResults && $query.text.length > 0}
  class:isResizing={$isResizing}
>
  <div class="content" style={`font-size: ${$zoom * 16}px;`}>
    <div class="paras-container">
      <div class="paras" bind:this={parasElement}>
        {#if viewerElement}
          <Loader
            bind:this={loader}
            bind:items
            {viewerElement}
            {serverCommand}
            {canRemoveItem}
            shouldTrackFocus={true}
            bind:state={state.loader}
            verbose
          >
            {#each items as item, index (item.index)}
              <Para
                {...item}
                copySelfAndChildren={() => copyParaAndChildren(index)}
              />
            {/each}
          </Loader>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .viewer {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    overflow: scroll;
    padding: 0;
  }
  .content {
    font-size: 16px;
    box-sizing: content-box;
    width: 100vw;
    padding: 0;
    height: auto;
  }

  /* .showSearchResults.showOutline .content {
    padding: 0 0 0 calc(var(--sidebar-width));
  } */
  .paras-container {
    width: 100vw;
    height: auto;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 0;
    transition: padding var(--transition-speed) ease;
  }
  .isResizing .paras-container {
    transition: none;
  }
  .showOutline .paras-container {
    padding-left: var(--sidebar-width);
  }
  .showSearchResults .paras-container {
    padding-right: var(--sidebar-width);
  }
  .showOutline.showSearchResults .paras-container {
    padding: 0 var(--sidebar-width);
  }

  .paras {
    padding: var(--padding);
    box-sizing: border-box;
    width: min(45em, 100%);
  }
</style>
