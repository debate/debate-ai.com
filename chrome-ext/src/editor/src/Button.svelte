<script>
  export let background = true;
  export let disabled = false;
  export let small = false;
  export let hoverShadow = false;
</script>

<button
  on:click
  on:mousedown|preventDefault={() => {}}
  class:background
  class:small
  class:hoverShadow
  {disabled}
>
  <slot />
</button>

<style>
  button {
    border: none;
    border-radius: var(--border-radius);
    cursor: pointer;
    line-height: 1;
    padding: 0.5rem;
    margin: 0;
    color: var(--text);
    height: 2rem;
    width: max-content;
    pointer-events: auto;
    display: block;
    background: none;
    font-size: 1rem;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    white-space: nowrap;
  }
  button.hoverShadow {
    transition: box-shadow var(--transition-speed);
  }
  button.small {
    padding: 0.375rem;
    height: 1.5rem;
    font-size: 0.75rem;
  }
  button[disabled] {
    pointer-events: none;
    opacity: 0.5;
  }
  button.background {
    background-color: var(--back-two);
  }
  button:hover {
    color: var(--text-strong);
  }
  button.hoverShadow:hover {
    box-shadow: var(--shadow-small);
  }
  button.background:hover {
    background-color: var(--back-two-hover);
  }
  button:active {
    background: none;
  }
  button.background:active {
    background-color: var(--back-two-active);
  }
  button:focus {
    outline: 0;
  }
</style>
