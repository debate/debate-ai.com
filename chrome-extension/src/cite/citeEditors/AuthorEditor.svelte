<script lang="ts">
  import { onMount, getContext } from 'svelte';
  import type { EditHistory } from '../history';
  import Icon from '../Icon.svelte';
  import Button from '../Button.svelte';
  import { createTransition } from '../transition';

  export let author: {
    name: string;
    isPerson: boolean;
    description: string;
    id: number;
  };
  export let index: number;

  const history: EditHistory = getContext('history');

  let nameElement: HTMLInputElement;
  let isPersonElement: HTMLInputElement;
  onMount(function () {
    if (author.name == '') {
      nameElement.focus();
    }
  });
  function deleteSelf() {
    history.action('deleteAuthor', {
      index: index,
    });
  }
  function editAuthor() {
    history.action('editAuthor', {
      index: index,
      author: {
        name: nameElement.value,
        isPerson: isPersonElement.value,
        description: null,
        id: author.id,
      },
    });
  }
  let transition = createTransition(
    // clip-path: inset(0 0 ${(1 - eased) * 100}% 0);
    (t, eased, info) => {
      return `
      transform: scale(${eased * 100}%);
      height: ${eased * info}px; 
    `;
    },
    'sineOut',
    {
      preRun: (node: HTMLElement) => {
        return node.offsetHeight;
      },
    }
  );
</script>

<div class="top" transition:transition|local>
  <input
    bind:this={nameElement}
    type="text"
    on:input={editAuthor}
    value={author.name}
    on:blur={() => history.preventExtension()}
    placeholder="name"
  />
  <div class="right">
    <input
      type="checkbox"
      hidden
      bind:this={isPersonElement}
      on:input={editAuthor}
      value={author.isPerson}
    />
    <Button
      on:click={() => (author.isPerson = !author.isPerson)}
      tooltip={author.isPerson ? 'Person' : 'Organization'}
    >
      {#if author.isPerson}<Icon name="person" />{:else}<Icon
          name="organization"
        />{/if}
    </Button>
    <Button on:click={deleteSelf}><Icon name="delete" /></Button>
  </div>
</div>

<style>
  div.top {
    position: relative;
    width: 100%;
    height: auto;
    font-size: 1rem;
    font-weight: normal;
    display: flex;
    flex-direction: row;
    padding: 0;
    box-sizing: border-box;
    background: var(--background-secondary);
    align-items: center;
    justify-content: space-between;
    gap: var(--padding);
    color: var(--text);

    overflow: hidden;
  }
  div.right {
    position: relative;
    width: 50%;
    height: auto;
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    width: min-content;
  }
  input[type='text'] {
    border: none;
    outline: none;
    display: block;
    box-sizing: border-box;
    position: relative;
    width: 100%;
    font-size: inherit;
    font-weight: inherit;
    font-family: inherit;
    background: var(--background-select-weak-secondary);
    border-radius: var(--padding);
    padding: var(--padding);
    color: var(--text);
    transition: background var(--transition-duration);
  }
  input[type='text']:focus {
    background: var(--background-select-secondary);
    color: var(--text-strong);
  }
  /* plaholder */
  input[type='text']::placeholder {
    color: var(--text-weak);
  }
</style>
