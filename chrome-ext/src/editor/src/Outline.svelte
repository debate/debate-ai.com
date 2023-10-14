<script lang="ts">
  import Loader from './Loader.svelte';
  import OutlineItem from './OutlineItem.svelte';
  import type { ParaType, LoaderState } from './types';
  import { invoke } from './api.js';
  import { outlineAside } from './transition';
  import { getContext, onMount, tick } from 'svelte';
  import type { Writable } from 'svelte/store';

  let getDocLoader: () => Loader = getContext('getDocLoader');

  let docFocus: Writable<ParaType>;
  onMount(async function () {
    // wait until Doc is created
    await tick();
    docFocus = getDocLoader().getFocusStore();
  });
  let items = [];
  let selectedOutline = null;
  function docFocusChange() {
    for (let i = 0; i < items.length; i++) {
      // find the one after selectedOutline
      if (items[i].link > $docFocus.index) {
        selectedOutline = items[i].index - 1;
        return;
      } else if (items[i].link == $docFocus.index) {
        selectedOutline = items[i].index;
        return;
      }
    }
  }
  $: $docFocus, docFocusChange();

  let viewerElement: Element;
  let loader: Loader;
  export let showOutline: boolean;
  $: if (!showOutline) {
    loader?.saveState();
  }

  export let state: {
    loader: LoaderState;
  };
  export function getLoader() {
    return loader;
  }
  async function serverCommand(i: number, j: number) {
    return (await invoke('get_outline_paras', {
      i,
      j,
    })) as ParaType[];
  }
  // key: child.index (the child is folded)
  // value: parent.index[] (there can be multiple folding the same one)
  let foldedChildren: { [child: number]: number[] } = {};

  // key: parent.index
  // value: child.index[] (the children are folded)
  let foldedParents: { [parent: number]: number[] } = {};
  async function toggleFold(index: number) {
    let parent = items[index];
    // if needs to unfold
    if (foldedParents.hasOwnProperty(parent.index)) {
      for (let child of foldedParents[parent.index]) {
        // remove parents from children array
        foldedChildren[child] = foldedChildren[child].filter(
          (item) => item !== parent.index
        );
        // if this was the only parent folding, unfold child
        if (foldedChildren[child].length == 0) {
          delete foldedChildren[child];
        }
      }
      // remove from foldedParents
      delete foldedParents[parent.index];
      foldedParents = foldedParents;
      foldedChildren = foldedChildren;
      // remove skiprange from loader
      loader.removeSkipRange(parent.index);
      // unload items after index
      loader.setMuteObservers(true);
      items = items.slice(0, index + 1);
      await tick();
      loader.updateIndex();
      await loader.loadBottom();
      loader.setMuteObservers(false);
    }
    // else fold
    else {
      // get children
      let loadedItems = items.slice(index);
      let children: number[] = [];
      let i = 1;
      while (i < loadedItems.length) {
        let child = loadedItems[i];
        if (
          parent.outline_level != null &&
          (child.outline_level == null ||
            child.outline_level > parent.outline_level)
        ) {
          children.push(child.index);
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
      // add to folded items
      foldedParents[parent.index] = [];
      for (let child of children) {
        foldedParents[parent.index].push(child);
        if (foldedChildren.hasOwnProperty(child)) {
          foldedChildren[child].push(parent.index);
        } else {
          foldedChildren[child] = [parent.index];
        }
      }
      // add to loader skip range
      loader.addSkipRange(
        parent.index,
        children[0],
        children[children.length - 1]
      );
      foldedParents = foldedParents;
      foldedChildren = foldedChildren;
    }
  }
  // remove all folded items from itemsElement
  function itemsUpdate() {
    let ret = [];
    for (let item of items) {
      if (!foldedChildren.hasOwnProperty(item.index)) {
        ret.push(item);
      }
    }
    items = ret;
  }
  $: items, foldedChildren, itemsUpdate();
</script>

{#if showOutline}
  <div class="top" transition:outlineAside>
    <div bind:this={viewerElement} class="viewer">
      <div class="content">
        <Loader
          bind:this={loader}
          bind:items
          {serverCommand}
          fetchAmount={30}
          bind:state={state.loader}
        >
          {#each items as item, index (item.index)}
            <OutlineItem
              outlineLevel={item.outline_level}
              link={item.link}
              runs={item.runs}
              index={item.index}
              toggleFold={() => toggleFold(index)}
              foldedParent={foldedParents.hasOwnProperty(item.index)}
              selected={item.index === selectedOutline}
            />
          {/each}
        </Loader>
      </div>
    </div>
  </div>
{/if}

<style>
  .top {
    background-color: var(--back-two);
    width: 100%;
    height: 100vh;
    box-sizing: border-box;
    padding-top: var(--topbar-height);
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
</style>
