<script lang="ts">
  export let expand = false;
  export let disabled = false;
</script>

<button class:expand {disabled} on:click><slot /></button>

<style>
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--background-select-weak-secondary);
    box-sizing: border-box;
    height: calc(1.2rem + var(--padding) * 2);
    outline: none;
    position: relative;
    font-size: inherit;
    font-weight: inherit;
    font-family: inherit;
    background: none;
    cursor: pointer;
    padding: var(--padding);
    line-height: 1em;
    border-radius: var(--radius);
    white-space: nowrap;
    color: var(--text);
    transition: background var(--transition-duration),
      color var(--transition-duration), border var(--transition-duration);
    gap: var(--padding);
  }
  button.expand {
    width: 100%;
  }
  button:hover,
  button:focus {
    background: var(--background-select-weak-secondary);
    color: var(--text-strong);
  }
  button:active {
    transition: none;
    background: var(--background-select-secondary);
    border: 2px solid var(--background-select-secondary);
  }
</style>
