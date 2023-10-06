<script lang="ts">
  import type { IPopupKeys } from 'src/types';
  import Login from './Login.svelte';
  import { clickOutside } from './outclick';
  import { createTransition } from './transition';
  import Upload from './Upload.svelte';
  export let name: IPopupKeys;
  export let closePopup: () => void;
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
  function handleOutclick() {
    closePopup();
  }
</script>

<div class="center levelOne">
  <div
    class="top"
    use:clickOutside
    on:outclick={handleOutclick}
    transition:transition
  >
    {#if name == 'login'}
      <Login {closePopup} />
    {:else if name == 'upload'}
      <Upload {closePopup} />
    {/if}
  </div>
</div>

<style>
  .top {
    position: relative;
    z-index: 999;
    box-sizing: border-box;
    width: 100vw;
    height: min-content;
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
</style>
