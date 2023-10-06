<script lang="ts">
  import type { ICard } from '../../types';
  import { onMount } from 'svelte';
  import { validateText } from '../citeFormatters';
  import type { Writable } from 'svelte/store';
  import { getContext } from 'svelte';
  import type { EditHistory } from '../history';

  export let key: string;
  const card: Writable<ICard> = getContext('card');
  const history: EditHistory = getContext('history');

  let textarea: HTMLTextAreaElement;
  onMount(function () {
    textarea.focus();
  });

  let valid: boolean;

  function validate() {
    valid = validateText($card[key]);
  }

  function updateCard() {
    history.action('text', {
      text: textarea.value,
      key: key,
    });
  }

  $: $card[key], validate();
</script>

<textarea
  bind:this={textarea}
  placeholder={'Type text here'}
  class:invalid={!valid}
  on:input={updateCard}
  on:blur={() => history.preventExtension()}
  value={$card[key]}
/>

<style>
  textarea {
    font-size: inherit;
    font-weight: inherit;
    font-family: inherit;

    width: 100%;
    height: 100%;

    border-radius: var(--padding);
    padding: var(--padding);
    background: none;
    color: var(--text);
    background: var(--background-select-weak-secondary);
    transition: background var(--transition-duration);
  }
  textarea:focus {
    background: var(--background-select-secondary);
    color: var(--text-strong);
  }
  textarea.invalid {
    background: var(--background-error-weak-secondary);
  }
  textarea::placeholder {
    color: var(--text-weak);
  }
  textarea.invalid::placeholder {
    color: var(--text-error-weak);
  }
</style>
