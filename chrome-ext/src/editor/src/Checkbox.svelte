<script lang="ts">
  import Icon from './Icon.svelte';
  import { checkbox } from './transition';
  export let value: boolean;
  export let labelText: string = 'checkbox';
  function toggleValue() {
    console.log('bruh');
    value = !value;
  }
</script>

<label class:checked={value} on:click|preventDefault={toggleValue}>
  <div class="labelText">
    {labelText}
  </div>
  <input bind:checked={value} type="checkbox" hidden />
  {#key value}
    <button in:checkbox|local>
      {#if value}
        <Icon name="check" />
      {:else}
        <Icon name="delete" />
      {/if}
    </button>
  {/key}
</label>

<style>
  label {
    position: relative;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: var(--padding-small);
    pointer-events: all;
  }
  label.checked {
    color: var(--text-strong);
  }
  input {
    margin: 0;
    min-width: 0;
    flex-shrink: 0;
    vertical-align: middle;
  }
  button {
    width: 2rem;
    height: 2rem;
    border-radius: 2rem;
    background-color: var(--back-two-hover);
    border: 0;
    color: var(--text-weak);
    font-size: 1rem;
  }

  .checked button {
    background-color: var(--back-two-active);
    color: var(--text-strong);
  }
</style>
