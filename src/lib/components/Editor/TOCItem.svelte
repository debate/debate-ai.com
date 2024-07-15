<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { ChevronRight, ChevronDown, Edit2 } from 'lucide-svelte';

  export let heading;
  export let maxLevel;
  export let scrollToHeading = (pos) => {};

  const dispatch = createEventDispatcher();

  const LIMIT_HEADING_LENGTH = 100;
  $: headingText = heading?.text?.slice(0, LIMIT_HEADING_LENGTH);
  $: headingText = headingText.length >= LIMIT_HEADING_LENGTH ? headingText.slice(0, headingText.lastIndexOf(' ')) + '…' : headingText;

  $: isExpanded = heading.level < maxLevel;

  let headingElement;
  let isEditing = false;
  let editText = '';

  function toggleExpand() {
    isExpanded = !isExpanded;
  }

  function handleHeadingClick() {
    if (!isEditing) {
      dispatch('loadBlock', { blockIndex: heading.blocks });
    }
  }

  function startEditing(event) {
    event.stopPropagation();
    isEditing = true;
    editText = heading.text;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      finishEditing();
    } else if (event.key === 'Escape') {
      cancelEditing();
    }
  }

  function finishEditing() {
    isEditing = false;
    if (editText.trim() !== heading.text) {
      dispatch('renameHeading', { 
        level: heading.level, 
        oldText: heading.text, 
        newText: editText.trim(),
        blocks: heading.blocks
      });
    }
  }

  function cancelEditing() {
    isEditing = false;
    editText = heading.text;
  }

  onMount(() => {
    if (heading.isSelected && headingElement) {
      headingElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      console.log('Scrolled to selected heading on mount:', headingText);
    }
  });
</script>

<div 
  class="flex items-center group"
  style="padding-left: {heading.level * 4}px; font-size: {13-(heading.level - 1) * (heading.level==4?1.7:1)}pt;"
>
  {#if heading.children.length > 0}
    <button
      on:click={toggleExpand}
      class="mr-1 focus:outline-none"
      aria-label={isExpanded ? "Collapse" : "Expand"}
    >
      {#if isExpanded}
        <ChevronDown size={14} />
      {:else}
        <ChevronRight size={14} />
      {/if}
    </button>
  {:else}
    <div class="w-[14px] mr-1"></div>
  {/if}
  {#if isEditing}
    <input
      bind:value={editText}
      on:blur={finishEditing}
      on:keydown={handleKeydown}
      class="
        text-sm w-full text-left flex-grow
        px-2 py-1 rounded-md
        border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500
      "
      style="font-size: {13-(heading.level - 1) * (heading.level==4?1.5:1)}pt;"
      autofocus
    />
  {:else}
    <button
      bind:this={headingElement}
      class="
        {heading.level === 4 ? 'shadow-sm shadow-slate-300' : ''} 
        {heading.isSelected ? 'active-toc-node bg-[#DED8C4] text-gray-900 font-medium' : 'bg-transparent text-gray-700 hover:opacity-70 hover:bg-[#DED8C4]'}
        text-sm w-full text-left flex-grow
        transition-all duration-200 ease-in-out
        px-2 py-1 rounded-md
      "
      on:click={handleHeadingClick}
      style="font-size: {13-(heading.level - 1) * (heading.level==4?1.5:1)}pt;"
    >
      {headingText}
    </button>
    <button
      on:click={startEditing}
      class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 ml-2 focus:outline-none"
      aria-label="Edit heading"
    >
      <Edit2 size={14} />
    </button>
  {/if}
</div>

{#if heading.children.length > 0 && isExpanded}
  {#each heading.children as childHeading (childHeading.pos)}
    <svelte:self heading={childHeading} {maxLevel} {scrollToHeading} on:loadBlock on:renameHeading />
  {/each}
{/if}