<script lang="ts">
  import type { ICard } from '../../types';
  import { validateAuthors } from '../citeFormatters';
  import AuthorEditor from './AuthorEditor.svelte';
  import type { Writable } from 'svelte/store';
  import { getContext } from 'svelte';
  import type { EditHistory } from '../history';
  import { transitionDuration } from '../transition';
  import TextButton from '../TextButton.svelte';

  export let key: string;
  const card: Writable<ICard> = getContext('card');
  const history: EditHistory = getContext('history');

  function addAuthor() {
    history.action('addAuthor', {});
    setTimeout(function () {
      (element.parentNode as HTMLElement).scrollBy({
        top: (element.parentNode as HTMLElement).scrollHeight,
        behavior: 'smooth',
      });
    }, transitionDuration);
  }
  let valid: boolean;
  function validate() {
    valid = validateAuthors($card[key]);
  }

  let element: HTMLElement;
  $: $card[key], validate();
</script>

<div class="top levelOne" class:invalid={!valid} bind:this={element}>
  <ul>
    <!-- id must be based on index, otherwise authors will refresh every time you edit -->
    {#each $card[key] as author, index (author.id)}
      <li>
        <AuthorEditor {index} bind:author />
      </li>
    {/each}
    <TextButton on:click={addAuthor}>Add author</TextButton>
  </ul>
</div>

<style>
  div.top {
    width: 100%;
    height: auto;
    font-size: 1rem;
    font-weight: normal;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
