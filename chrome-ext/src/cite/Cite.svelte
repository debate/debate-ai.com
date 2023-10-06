<script lang="ts">
  import { getContext, tick } from 'svelte';
  import type { ICard, IFormatter } from '../types';
  import type { Writable } from 'svelte/store';
  import { citeLabels } from './labels';

  const card: Writable<ICard> = getContext('card');
  let currentEditor: Writable<string | null> = getContext('currentEditor');
  export let formatter: IFormatter;

  let label = citeLabels[formatter.key];

  let editorIsOpen = false;
  function toggleEditor() {
    if (!editorIsOpen) {
      $currentEditor = formatter.key;
    }
  }
  async function editorUpdate() {
    // wait until click handlers are done before setting editorIsOpen, so that toggleEditor works
    setTimeout(() => {
      editorIsOpen = $currentEditor == formatter.key;
    });
  }
  $: content = formatter.format($card);
  currentEditor.subscribe(editorUpdate);
</script>

<span class:editorIsOpen class:invalid={content == null} on:click={toggleEditor}
  >{content ?? `Missing ${label}`}</span
>

<style>
  span {
    cursor: default;
    word-wrap: break-word;
    border-radius: var(--radius);
    transition: background var(--transition-duration);
  }
  span:hover {
    background: var(--background-select-weak-secondary);
  }
  span.editorIsOpen {
    background: var(--background-select-secondary);
  }
  span.invalid {
    background: var(--background-error-weak-secondary);
  }
  span.editorIsOpen.invalid {
    background: var(--background-error-secondary);
  }
</style>
