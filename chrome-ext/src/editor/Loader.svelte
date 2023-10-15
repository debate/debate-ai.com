<script lang="ts">
  import { onMount, onDestroy, tick, getContext } from 'svelte';
  import { writable } from 'svelte/store';
  import type { LoaderState } from './types';

  export let items: any[];
  export let serverCommand: (i: number, j: number) => Promise<any[]>;
  export let canRemoveItem = (item: any, itemElement: HTMLElement) => true;
  export let fetchAmount = 10;
  export let loaderHeight = 500;
  export let shouldTrackFocus = false;
  export let state: LoaderState = null;

  export let verbose = false;
  export let viewerElement: HTMLElement = null;
  let topLoaderElement: HTMLElement;
  let bottomLoaderElement: HTMLElement;
  let itemsElement: HTMLElement;

  let startIndex = 0;
  let endIndex = 0;
  let muteObserver = false;
  let topLoadShowing = true;
  let bottomLoadShowing = true;
  // TODO ? make it compatible with bad indexes

  export function reset() {
    items = [];
    startIndex = 0;
    endIndex = 0;
    topLoadShowing = true;
    bottomLoadShowing = true;
  }
  export function getItemsElement() {
    return itemsElement;
  }

  export function updateIndex() {
    startIndex = items[0]?.index;
    endIndex = items[items.length - 1]?.index + 1;
  }

  let skipRanges: { [id: number]: { start: number; end: number } } = [];
  // sort ranges by there start and end (list because there can be duplicate)
  let forwardRangeSort: { [start: number]: number[] } = {};
  let backwardRangeSort: { [end: number]: number[] } = {};
  export function addSkipRange(id: number, start: number, end: number) {
    skipRanges[id] = { start, end };
    if (forwardRangeSort.hasOwnProperty(start)) {
      forwardRangeSort[start].push(id);
    } else {
      forwardRangeSort[start] = [id];
    }
    if (backwardRangeSort.hasOwnProperty(end)) {
      backwardRangeSort[end].push(id);
    } else {
      backwardRangeSort[end] = [id];
    }
    // sort both forward and backward
    forwardRangeSort = Object.keys(forwardRangeSort)
      .sort()
      .reduce((obj, key) => {
        obj[key] = forwardRangeSort[key];
        return obj;
      }, {});
    backwardRangeSort = Object.keys(backwardRangeSort)
      .sort()
      .reduce((obj, key) => {
        obj[key] = backwardRangeSort[key];
        return obj;
      }, {});
  }
  export function removeSkipRange(id: number) {
    let range = skipRanges[id];
    // remove from forwardRangeSort
    forwardRangeSort[range.start] = forwardRangeSort[range.start].filter(
      (value) => value !== id
    );
    if (forwardRangeSort[range.start].length == 0) {
      delete forwardRangeSort[range.start];
    }
    // remove from backwardRangeSort
    backwardRangeSort[range.end] = backwardRangeSort[range.end].filter(
      (value) => value !== id
    );
    if (backwardRangeSort[range.end].length == 0) {
      delete backwardRangeSort[range.end];
    }

    delete skipRanges[id];
  }

  let observer = new IntersectionObserver(
    (entries) => {
      verbose && console.log('observer muted: ', muteObserver);
      if (muteObserver) return;
      let shouldLoadBottom = false;
      let shouldLoadTop = false;
      for (let entry of entries) {
        if (entry.isIntersecting) {
          shouldLoadBottom = entry.target == bottomLoaderElement;
          shouldLoadTop = entry.target == topLoaderElement;
        }
      }
      // prioritize loadBottom first
      if (shouldLoadBottom) {
        verbose && console.log('bottom loader in view');
        loadBottom();
      } else if (shouldLoadTop) {
        verbose && console.log('top loader in view');
        loadTop();
      }
      topLoadShowing = shouldLoadTop;
      bottomLoadShowing = shouldLoadBottom;
    },
    {
      root: viewerElement,
      rootMargin: '0px',
      threshold: 0,
    }
  );

  let topOffset = 40; // how much space to put at top when teleporting;

  function isFocused(index: number) {
    let childElement = itemsElement.children[index] as HTMLElement;
    return (
      childElement &&
      childElement.offsetTop -
        viewerElement.scrollTop +
        childElement.offsetHeight >
        topOffset &&
      childElement.offsetTop - viewerElement.scrollTop < topOffset
    );
  }
  let currentFocusIndex = 0;
  let currentFocus = writable(null);
  function focusUpdate() {
    verbose && console.log('currentFocus', currentFocusIndex);
    $currentFocus = items[currentFocusIndex];
  }
  export function getFocusStore() {
    return currentFocus;
  }
  export function getFocus() {
    return $currentFocus;
  }
  let trackFocus: () => void = function () {
    // check if currentFocusIndex is still focused
    if (isFocused(currentFocusIndex)) {
      return;
    }
    // else spread out from current focus to find next focus
    let i = 0;
    while (
      currentFocusIndex + i < itemsElement.children.length ||
      currentFocusIndex - i > 0
    ) {
      i += 1;
      if (isFocused(currentFocusIndex + i)) {
        currentFocusIndex += i;
        focusUpdate();
        return;
      }
      if (isFocused(currentFocusIndex - i)) {
        currentFocusIndex -= i;
        focusUpdate();
        return;
      }
    }
    // if nobody is focused, check if its closer to top or bottom and set those
    if (
      viewerElement.scrollTop >
      viewerElement.scrollHeight - viewerElement.scrollTop
    ) {
      currentFocusIndex = 0;
    } else {
      currentFocusIndex = itemsElement.children.length - 1;
    }
  };
  onMount(async function () {
    /*
    if (!viewerElement) {
      viewerElement = topLoaderElement.parentElement.parentElement;
    }
    observer.observe(topLoaderElement);
    observer.observe(bottomLoaderElement);

    if (state) {
      console.log(state);
      startIndex = state.startIndex;
      endIndex = state.endIndex;
      items = await serverCommand(startIndex, endIndex);
      await tick();
      viewerElement.scrollTop = state.scrollTop;
    } else {
      teleport(0, true);
    }

    if (shouldTrackFocus) {
      currentFocusIndex = 0;
      trackFocus();
      viewerElement.addEventListener('scroll', trackFocus);
    }*/

  });
  export function saveState() {
    state = {
      startIndex: startIndex,
      endIndex: endIndex,
      scrollTop: viewerElement.scrollTop,
    };
  }
  export function setMuteObservers(state: boolean) {
    muteObserver = state;
  }
  onDestroy(function () {
    if (trackFocus) {
      viewerElement.removeEventListener('scroll', trackFocus);
    }
  });
  async function loadItemsTop(amount: number) {
    let loadRanges = [
      {
        start: startIndex - amount,
        end: startIndex,
      },
    ];
    verbose && console.log('original range', loadRanges[0]);

    let current = loadRanges[0];
    let keys: number[] = Object.keys(backwardRangeSort).map(Number);
    keys.reverse();
    for (let end of keys) {
      let rangeIds = backwardRangeSort[end];
      // if end of range is in current load range (i == end)
      if (end > current.start && end < current.end) {
        // find the range with biggest end start difference
        let biggest = skipRanges[rangeIds[0]];
        for (let j = 1; j < rangeIds.length; j++) {
          let test = skipRanges[rangeIds[j]];
          if (biggest.end - biggest.start < test.end - test.start) {
            biggest = test;
          }
        }
        verbose && console.log('removing range: ', biggest);
        // split current into 2 and add it
        let nextLen =
          current.end - current.start - (current.end - (biggest.end + 1));
        current.start = biggest.end + 1;
        loadRanges.push({
          start: biggest.start - nextLen,
          end: biggest.start,
        });
        current = loadRanges[loadRanges.length - 1];
        verbose && console.log('loadRanges: ', loadRanges);
      }
    }
    loadRanges.reverse();
    let newItems: any[] = [];
    verbose &&
      loadRanges.length != 1 &&
      console.log('loading ranges: ', loadRanges);
    for (let range of loadRanges) {
      let start = Math.max(0, range.start);
      let end = Math.max(0, range.end);
      verbose && console.log('loading: ', start, end);
      newItems = newItems.concat(await serverCommand(start, end));
    }

    startIndex -= loadRanges[loadRanges.length - 1].end - loadRanges[0].start;
    verbose && console.log('newItems: ', newItems);
    return newItems;
  }
  async function loadItemsBottom(amount: number) {
    /*
    let loadRanges = [
      {
        start: endIndex,
        end: endIndex + amount,
      },
    ];

    let current = loadRanges[0];
    let keys: number[] = Object.keys(forwardRangeSort).map(Number);
    for (let start of keys) {
      let rangeIds = forwardRangeSort[start];
      console.log(forwardRangeSort, start);
      // if start of range is in current load range (i == start)
      if (start > current.start && start < current.end) {
        // find the range with biggest end start difference
        let biggest = skipRanges[rangeIds[0]];
        for (let j = 1; j < rangeIds.length; j++) {
          let test = skipRanges[rangeIds[j]];
          if (biggest.end - biggest.start < test.end - test.start) {
            biggest = test;
          }
        }
        // split current into 2 and add it
        let nextLen =
          current.end - current.start - (biggest.start - current.start);
        current.end = biggest.start;
        loadRanges.push({
          start: biggest.end + 1,
          end: biggest.end + 1 + nextLen,
        });
        current = loadRanges[loadRanges.length - 1];
      }
    }
    let newItems: any[] = [];
    verbose &&
      loadRanges.length != 1 &&
      console.log('loading ranges: ', loadRanges);

    for (let range of loadRanges) {
      let start = Math.max(0, range.start);
      let end = Math.max(0, range.end);
      verbose && console.log('loading: ', start, end);
      newItems = newItems.concat(await serverCommand(start, end));
    }

    endIndex += loadRanges[loadRanges.length - 1].end - loadRanges[0].start;

    verbose && console.log('newItems: ', newItems);
    return newItems;*/
  }
  async function extendItemsBottom() {
    if (
      bottomLoaderElement.offsetTop - viewerElement.scrollTop <
      viewerElement.clientHeight
    ) {
      let newItems = await loadItemsBottom(fetchAmount);
      if (newItems.length == 0) return;
      items = [...items, ...newItems];
      await tick();
      extendItemsBottom();
    }
  }
  async function extendItemsTop() {
    if (
      topLoaderElement.offsetTop -
        viewerElement.scrollTop +
        topLoaderElement.clientHeight >
      0
    ) {
      let newItems = await loadItemsTop(fetchAmount);
      if (newItems.length == 0) return;
      let oldHeight = itemsElement.clientHeight;
      items = [...items, ...newItems];
      await tick();
      viewerElement.scrollTop += itemsElement.clientHeight - oldHeight;
      extendItemsTop();
    }
  }
  async function loadTop() {
    verbose && console.log('loading top');
    let newItems = await loadItemsTop(fetchAmount);
    if (newItems.length == 0) return;
    // remove out of view items
    let itemsHeightChange = 0;
    for (let i = itemsElement.children.length - 1; i >= 0; i--) {
      let child = itemsElement.children[i] as HTMLElement;
      let childTop = child.offsetTop - viewerElement.scrollTop;
      if (
        childTop > viewerElement.clientHeight &&
        canRemoveItem(items[i], child)
      ) {
        items.pop();
        itemsHeightChange -= child.clientHeight;
      } else {
        break;
      }
    }
    let oldHeight = itemsElement.clientHeight;
    items = [...newItems, ...items];
    endIndex = items[items.length - 1]?.index + 1;
    await tick();
    itemsHeightChange += oldHeight - itemsElement.clientHeight;
    viewerElement.scrollTop -= itemsHeightChange;
    await extendItemsTop();
    verbose && console.log(items);
  }
  export async function loadBottom() {
    verbose && console.log('loading bottom');
    let newItems = await loadItemsBottom(fetchAmount);
    if (newItems.length == 0) return;
    // remove out of view items
    let itemsHeightChange = 0;
    for (let i = 0; i < itemsElement.children.length; i++) {
      let child = itemsElement.children[i] as HTMLElement;
      // if child is outside of viewerElement
      let childBottom =
        child.offsetTop - viewerElement.scrollTop + child.clientHeight;

      if (childBottom < 0 && canRemoveItem(items[i], child)) {
        items.shift();
        itemsHeightChange -= child.clientHeight;
      } else {
        break;
      }
    }

    items = [...items, ...newItems];
    startIndex = items[0]?.index;
    await tick();
    viewerElement.scrollTop += itemsHeightChange;
    await extendItemsBottom();
    verbose && console.log('loaded items: ', items);
  }

  // prevent teleports from being called at the same time
  let teleportQueue = [];
  export function teleport(index: number, force?: boolean) {
    let args = {
      index,
      force,
    };
    teleportQueue.push(args);
    verbose &&
      console.log('teleport queue increased to: ', teleportQueue.length);
    // if teleportQueue was empty, start a new chain
    if (teleportQueue.length == 1) {
      teleportChain(args.index, args.force);
    }
  }
  let teleportDoneCallbacks = [];
  export function onTeleportDone(callback: () => void) {
    // if teleportQueue empty, teleport is done
    if (teleportQueue.length == 0) {
      callback();
    } else {
      // add callback to queue
      teleportDoneCallbacks.push(callback);
    }
  }
  async function teleportChain(index: number, force?: boolean) {
    await pureTeleport(index, force);
    teleportQueue.shift();
    verbose &&
      console.log('teleport queue decreased to: ', teleportQueue.length);
    // if there are more teleports in the queue, call them
    if (teleportQueue.length > 0) {
      let args = teleportQueue[0];
      teleportChain(args.index, args.force);
    } else {
      // if there are no more teleports in the queue, call teleportDoneCallbacks
      for (let callback of teleportDoneCallbacks) {
        callback();
      }
      teleportDoneCallbacks = [];
    }
  }
  export async function pureTeleport(index: number, force?: boolean) {
    verbose && console.log('teleporting to: ', index);
    if (!force && items.length > 0 && index >= startIndex && index < endIndex) {
      // if this forces it to load anything, just do normal teleport
      let item = itemsElement.children[index - startIndex] as HTMLElement;
      if (
        item &&
        !(item.offsetTop < loaderHeight) &&
        !(
          item.offsetTop + viewerElement.clientHeight >
          bottomLoaderElement.offsetTop
        )
      ) {
        verbose && console.log('doing fake teleport');
        verbose && console.trace();
        viewerElement.scrollTop = item.offsetTop - topOffset + 1;
        if (shouldTrackFocus) {
          currentFocusIndex = 0;
          focusUpdate();
        }
        return true;
      }
    }
    verbose && console.log('doing real teleport');
    muteObserver = true;
    verbose && console.log('muting obvservers');
    reset();
    startIndex = index;
    endIndex = index;
    await loadBottom();
    // defaults to top of loader
    viewerElement.scrollTop =
      Math.max(
        (itemsElement.children[0] as HTMLElement)?.offsetTop,
        loaderHeight
      ) -
      topOffset +
      1;
    verbose && console.log('set viewer scrollTop: ', viewerElement.scrollTop);
    muteObserver = false;
    verbose && console.log('unmuting obvservers');
    if (shouldTrackFocus) {
      currentFocusIndex = 0;
      focusUpdate();
    }
    return true;
  }
</script>

<div
  class="loader top"
  style={`height:${loaderHeight}px`}
  bind:this={topLoaderElement}
/>

<div class="items" bind:this={itemsElement}>
  <slot />
</div>

<div
  class="loader bottom"
  style={`height:${loaderHeight}px`}
  bind:this={bottomLoaderElement}
/>
<div class="spacefiller" style={`height:${viewerElement?.clientHeight}px`} />

<style>
  .loader {
    width: auto;
    /* border: 2px solid red; */
    box-sizing: border-box;
  }
</style>
