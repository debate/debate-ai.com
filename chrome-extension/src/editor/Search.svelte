<script lang="ts">
  import { getContext } from 'svelte';
  import type { Writable } from 'svelte/store';
  import { register } from './shortcut';
  import type { Query } from './types';

  export let placeholder = '';
  export let matchCase: boolean;
  export let onlyOutline: boolean;
  let query: Writable<Query> = getContext('query');
  let selectedQuery: Writable<{ paraIndex: number; charIndex: number }> =
    getContext('selectedQuery');

  let prevResult: () => void = getContext('prevResult');
  let nextResult: () => void = getContext('nextResult');
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) {
        prevResult();
      } else {
        nextResult();
      }
    } else if (event.key == 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      prevResult();
    } else if (event.key == 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      nextResult();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      textarea.blur();
      $query.text = '';
      value = '';
      $selectedQuery.paraIndex = undefined;
      $selectedQuery.charIndex = undefined;
    }
  }
  let textarea: HTMLElement;
  register('CommandOrControl+F', () => {
    textarea.focus();
  });

  $: {
    if ($selectedQuery.paraIndex != null) {
      textarea.focus();
    }
  }
  let value: string = '';
  let valueUpdateTimeout: NodeJS.Timeout;
  function onValueUpdate() {
    if (valueUpdateTimeout) {
      clearTimeout(valueUpdateTimeout);
    }
    valueUpdateTimeout = setTimeout(() => {
      query.set({
        text: value.replace(/\u00A0/g, ' '),
        matchCase,
        onlyOutline,
      });
    }, 200);
  }
  $: value, onValueUpdate();
</script>

<textarea
  bind:this={textarea}
  {placeholder}
  spellcheck={false}
  on:keydown={handleKeyDown}
  bind:value
/>

<style>
  textarea {
    background-color: var(--back-two);
    border: none;
    border-radius: var(--border-radius);
    cursor: pointer;
    display: block;
    padding: 0.5em;
    line-height: 1em;
    margin: 0;
    color: var(--text);
    width: 100%;
    height: 2em;
    box-sizing: border-box;
    white-space: nowrap;
    resize: none;
    transition: box-shadow var(--transition-speed);
    font-size: 1em;
  }
  textarea::placeholder {
    color: var(--text-weak);
  }
  textarea:hover,
  textarea:focus {
    background-color: var(--back-two-hover);
    color: var(--text-strong);
    outline: none;
  }
  textarea:hover {
    box-shadow: var(--shadow-small);
  }
  textarea:active {
    background-color: var(--back-two-active);
  }
</style>
