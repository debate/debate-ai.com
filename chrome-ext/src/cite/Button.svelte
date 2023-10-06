<script lang="ts">
  import type { ITooltipInfo } from '../types';
  import Tooltip from './Tooltip.svelte';
  import Icon from './Icon.svelte';
  export let selected: boolean = false;
  // allows toggle behavior without changing button color
  export let selectedColor: boolean = true;
  export let disabled: boolean = false;
  export let tooltip: null | string | ITooltipInfo = null;
  let tooltipInfo: ITooltipInfo;
  function setTooltipInfo() {
    if (tooltip == null) {
      tooltipInfo = { exist: false };
    } else if (typeof tooltip == 'string') {
      tooltipInfo = { content: tooltip };
    } else {
      tooltipInfo = tooltip;
    }
    if (disabled && !tooltipInfo.hasOwnProperty('disabled')) {
      tooltipInfo.disabled = true;
    }
  }
  $: disabled, tooltip, setTooltipInfo();

  let element: HTMLElement;
  function animateClick() {
    element.classList.remove('clicked');
    // trigger reflow
    void element.offsetWidth;
    element.classList.add('clicked');
  }
  async function handleClick() {
    animateClick();
  }
  function animateHover() {
    element.classList.remove('hovered');
    // trigger reflow
    void element.offsetWidth;
    element.classList.add('hovered');
  }
</script>

<Tooltip {...tooltipInfo}>
  <button
    bind:this={element}
    on:click
    class:selected
    class:selectedColor
    {disabled}
    on:click={handleClick}
    on:mouseenter={animateHover}
  >
    <slot />
  </button>
</Tooltip>

<style>
  button {
    background-color: var(--background);
    border-radius: 2rem;
    color: var(--text);
    cursor: pointer;
    font-size: 1rem;
    padding: var(--padding);
    border: none;
    outline: none;
    margin: none;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: row;
    width: min-content;
    transition: color var(--transition-duration),
      background var(--transition-duration);
    white-space: nowrap;
  }
  button:hover {
    background-color: var(--background-select-weak);
    color: var(--text-strong);
  }
  button:active {
    background-color: var(--background-select);
    color: var(--text-strong);
  }
  :global(.levelOne) button {
    background-color: var(--background-secondary);
  }
  :global(.levelOne) button:hover {
    background-color: var(--background-select-weak-secondary);
  }
  :global(.levelOne) button:active {
    background-color: var(--background-select-secondary);
  }
  .selected.selectedColor,
  .selected.selectedColor:hover {
    background-color: var(--background-select);
    color: var(--text-strong);
  }
  :global(.levelOne) .selected.selectedColor,
  :global(.levelOne) .selected.selectedColor:hover {
    background-color: var(--background-select-secondary);
  }
  button:disabled {
    color: var(--text-weak);
    background-color: var(--background);
  }
  :global(.levelOne) button:disabled {
    background-color: var(--background-secondary);
  }
</style>
