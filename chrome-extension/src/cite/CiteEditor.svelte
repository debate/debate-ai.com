<script lang="ts">
  import TextEditor from './citeEditors/TextEditor.svelte';
  import DateEditor from './citeEditors/DateEditor.svelte';
  import AuthorsEditor from './citeEditors/AuthorsEditor.svelte';
  import { getContext } from 'svelte';
  import { clickOutside } from './outclick';
  import { citeLabels } from './labels';
  import { createTransition } from './transition';
  import type { Writable } from 'svelte/store';

  export let key: string;
  let currentEditor: Writable<string | null> = getContext('currentEditor');

  let transition = createTransition(
    (t: number, eased: number) => {
      return `
      transform: translateY(${(1 - eased) * 100}%) scale(${eased});
    `;
    },
    'sineOut',
    {
      durationMultiplier: 2,
    }
  );

  let component: any;
  $: {
    if (key == 'authors') {
      component = AuthorsEditor;
    } else if (key == 'date' || key == 'accessDate') {
      component = DateEditor;
    } else {
      component = TextEditor;
    }
  }
  function handleOutclick() {
    $currentEditor = null;
  }
</script>

<div class="center">
  <div
    class="top"
    use:clickOutside
    on:outclick={handleOutclick}
    transition:transition
  >
    <h1>Edit {citeLabels[key]}</h1>
    <div class="content">
      <svelte:component this={component} {key} />
    </div>
  </div>
</div>

<style>
  .top {
    position: relative;
    z-index: 999;
    box-sizing: border-box;
    width: 100vw;
    height: 200px;
    bottom: 0;
    left: 0;
    background: var(--background-secondary);
    box-shadow: var(--shadow-big);
    border-radius: var(--radius-big) var(--radius-big) 0 0;
    display: flex;
    flex-direction: column;
    gap: var(--padding);
    max-width: 600px;
  }
  .center {
    position: fixed;
    display: flex;
    justify-content: center;
    z-index: 1000;
    box-sizing: border-box;
    width: 100vw;
    height: auto;
    bottom: 0;
    left: 0;
  }
  h1 {
    margin: 0;
    font-weight: bold;
    font-size: 1rem;
    padding: var(--padding-big) var(--padding-big) 0 var(--padding-big);
  }
  .content {
    height: 100%;
    overflow: scroll;
    box-sizing: border-box;
    padding: 0 var(--padding-big) var(--padding-big) var(--padding-big);
  }
</style>
