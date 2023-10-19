<script lang="ts">
  import type { Writable } from 'svelte/store';
  import { getContext } from 'svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import TextButton from './TextButton.svelte';
  import type { ICard } from 'src/types';
  import { cardToHtml } from './clipboard';
  import {
    getCollections,
    uploadCard as uploadCardToArguflow,
    type Collection,
    addCardToCollection,
  } from './arguflow';
  import { messenger } from './stores';
  import { createTransition } from './transition';

  const card: Writable<ICard> = getContext('card');
  const shrunk: Writable<boolean> = getContext('shrunk');

  export let closePopup: () => void;

  let bookmark = false;

  let isPrivate = false;

  async function uploadCard() {
    let html = cardToHtml($card, $shrunk, false, false);
    messenger.addMessage('Uploading...');
    try {
      let cardData = await uploadCardToArguflow(
        html.innerHTML,
        $card.url,
        isPrivate
      );
      let collectionIds: string[] = [];
      for (let id of Object.keys(includeArr)) {
        if (includeArr[id]) {
          collectionIds.push(id);
        }
      }
      if (collectionIds.length > 0) {
        messenger.addMessage('Adding to collections...');
        for (let id of collectionIds) {
          console.log(id, cardData.card_metadata.id);
          await addCardToCollection(cardData.card_metadata.id, id);
        }
      }
      if (cardData.duplicate) {
        messenger.addMessage('Done, card is a duplicate');
      } else {
        messenger.addMessage('Done!');
      }
      closePopup();
    } catch (err) {
      messenger.addError('upload', err);
    }
  }
  let includeArr: { [key: string]: boolean } = {};
  let currentPage = 1;
</script>

<h1>Upload to Arguflow</h1>
<div class="content" class:bookmark>
  {#if bookmark}
    <div class="bookmark">
      {#await getCollections(currentPage)}
        <div class="loader">Loading...</div>
      {:then resp}
        <div class="collectionsScroll">
          <div class="collections">
            {#each resp.collections as collection}
              <button
                class="collection"
                on:click={() =>
                  (includeArr[collection.id] = !includeArr[collection.id])}
              >
                <label for={collection.name}>{collection.name}</label>
                {#if includeArr[collection.id]}
                  <Icon name="check" />
                {/if}
                <input
                  type="checkbox"
                  bind:checked={includeArr[collection.id]}
                  name={collection.name}
                  hidden
                />
              </button>
            {/each}
            <div class="buttons">
              {#if currentPage != 1}
                <TextButton
                  expand
                  on:click={() => {
                    currentPage--;
                  }}
                >
                  Previous
                </TextButton>
              {/if}
              {#if currentPage != resp.total_pages}
                <TextButton
                  expand
                  on:click={() => {
                    currentPage++;
                  }}
                >
                  Next
                </TextButton>
              {/if}
            </div>
          </div>
        </div>
      {:catch err}
        <div class="loader error">Failed to load collections: {err}</div>
      {/await}
    </div>
  {/if}
  <div class="buttons">
    <Button
      tooltip={{ content: isPrivate ? 'Private' : 'Public', layout: 'top' }}
      selected={isPrivate}
      on:click={() => (isPrivate = !isPrivate)}><Icon name="lock" /></Button
    >
    <TextButton expand on:click={() => (bookmark = !bookmark)}
      >Select Collections</TextButton
    >
    <TextButton on:click={uploadCard} expand
      >Upload
      <Icon name="upload" />
    </TextButton>
  </div>
</div>

<style>
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
    display: flex;
    flex-direction: column;
    gap: var(--padding);
  }
  .buttons {
    display: flex;
    flex-direction: row;
    gap: var(--padding);
    align-items: center;
    justify-content: center;
  }

  .collectionsScroll {
    overflow: scroll;
    height: 100%;
    max-height: calc(100vh - 200px);
  }
  .collections {
    display: flex;
    flex-direction: column;
    gap: var(--padding);
  }

  .collection {
    border: none;
    outline: none;
    display: flex;
    box-sizing: border-box;
    position: relative;
    width: 100%;
    font-size: inherit;
    font-weight: inherit;
    font-family: inherit;
    border-radius: var(--padding);
    padding: var(--padding);
    color: var(--text);
    transition: background var(--transition-duration);
    justify-content: space-between;
    background: none;
    height: calc(1.2rem + var(--padding) * 2);
  }
  .collection > label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .collection:has(input:checked) {
    background: var(--background-select-secondary);
    color: var(--text-strong);
  }
  .collection:hover {
    background: var(--background-select-weak-secondary);
    color: var(--text-strong);
  }

  .loader {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: var(--padding);
  }
  .error {
    color: var(--text-error);
  }
</style>
