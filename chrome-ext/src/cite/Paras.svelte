<script lang="ts">
  import Para from './Para.svelte';
  import { onMount } from 'svelte';
  import { getContext } from 'svelte';
  import type { Writable } from 'svelte/store';
  import type { ICard, IPara, IRun } from './types';
  import type { EditHistory } from './history';

  export let shrunk: boolean;

  let currentTool: Writable<null | 'highlight' | 'underline' | 'eraser'> =
    getContext('currentTool');

  const card: Writable<ICard> = getContext('card');
  const history: EditHistory = getContext('history');

  let parentElement: HTMLElement;

  // converts text nodes/span nodes/p nodes all to span, so that it is normalized
  function findCorrectParent(node: Node) {
    if (node.nodeName === 'SPAN') {
      return node;
    } else if (node.nodeName === 'P') {
      return findCorrectParent(node.firstChild);
    } else if (node.nodeName === '#text') {
      return findCorrectParent(node.parentNode);
    } else {
      throw new Error('Unexpected node type');
    }
  }
  function selectionDone() {
    if ($currentTool == null) return;
    const selection = window.getSelection();
    if (selection.rangeCount == 0) return;
    const range = selection.getRangeAt(0);
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;
    // check if startContainer and endContainer descendants of parentElement
    if (
      !(
        parentElement.contains(startContainer) &&
        parentElement.contains(endContainer)
      )
    )
      return;
    // normalize startContainer and endContainer
    let startSpan = findCorrectParent(startContainer) as HTMLElement;
    let endSpan = findCorrectParent(endContainer) as HTMLElement;
    // get start p and end p
    let startP = startSpan.parentElement;
    let endP = endSpan.parentElement;
    // get start p index and end p index
    let startPIndex = Array.from(startP.parentElement.children).indexOf(startP);
    let endPIndex = Array.from(endP.parentElement.children).indexOf(endP);
    // get start span index and end span index
    let startSpanIndex = Array.from(startP.children).indexOf(startSpan);
    let endSpanIndex = Array.from(endP.children).indexOf(endSpan);

    // make sure selection is big
    if (
      startPIndex == endPIndex &&
      startSpanIndex == endSpanIndex &&
      startOffset == endOffset
    )
      return;
    history.action('editPara', {
      tool: $currentTool,
      index: {
        startP: startPIndex,
        endP: endPIndex,
        startSpan: startSpanIndex,
        endSpan: endSpanIndex,
        startOffset: startOffset,
        endOffset: endOffset,
      },
    });

    selection.empty();
  }

  onMount(function () {
    document.addEventListener('mouseup', selectionDone);
  });
</script>

<article bind:this={parentElement} class:shrunk>
  {#each $card.paras as para}
    <Para runs={para} />
  {/each}
</article>
