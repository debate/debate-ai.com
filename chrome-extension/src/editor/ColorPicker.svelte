<script lang="ts">
  import Panel from './Panel.svelte';
  import Button from './Button.svelte';
  import TurningArrow from './TurningArrow.svelte';
  import Form from './Form.svelte';
  import Checkbox from './Checkbox.svelte';
  import { Align } from './types';
  import { clickOutside } from './outclick';
  export let usingHue: boolean;
  export let hue: number = 0;
  let showingSettings = false;
  let open = false;
  import { accordion } from './transition';
</script>

<div
  class="top"
  style={`--hue:${hue}`}
  class:usingHue
  use:clickOutside
  on:outclick={() => (open = false)}
>
  <Panel
    title={'Change window color'}
    align={Align.BottomRight}
    icon="rainbow"
    bind:open
  >
    <div class="content">
      <div
        class="selector"
        class:on={!usingHue}
        on:click={() => (usingHue = false)}
      >
        <button class="noColor" on:mousedown={() => (usingHue = false)} />
      </div>
      <div
        class="selector"
        class:on={usingHue}
        on:click={() => (usingHue = true)}
      >
        <input
          class="colorRange"
          type="range"
          min="0"
          max="360"
          bind:value={hue}
          title="Choose window hue"
          on:mousedown={() => (usingHue = true)}
        />
      </div>
    </div>
    <div class="settingsShower">
      <Button
        background={false}
        on:click={() => (showingSettings = !showingSettings)}
      >
        <TurningArrow direction={showingSettings ? 'up' : 'down'} />
      </Button>
    </div>
    {#if showingSettings}
      <div class="settings" transition:accordion|local>
        <Form>
          <Checkbox labelText={'Apply to this file'} value={true} />
          <Checkbox labelText={'Apply to this folder'} value={true} />
        </Form>
      </div>
    {/if}
    <div class="spacefiller" />
  </Panel>
</div>

<style>
  .top {
    position: absolute;
    right: var(--padding-small);
    bottom: var(--padding-small);
    display: block;
    width: min-content;
    height: max-content;
    z-index: 100;
  }
  .spacefiller {
    height: 1rem;
  }
  .content {
    width: var(--sidebar-width);
    height: var(--topbar-height);
    border-radius: var(--border-radius) 0 0 0;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: var(--padding-small);
  }
  .noColor {
    width: 1rem;
    height: 1rem;
    background: hsl(0, 0%, 50%);
    border: none;
    outline: none;
    border-radius: 50%;
  }
  .settingsShower {
    position: absolute;
    bottom: 0;
    left: 0;
    z-index: 10;
  }
  .settings {
    height: auto;
    overflow: visible;
    box-sizing: border-box;
  }
  .selector {
    padding: var(--padding);
    border-radius: 1.5rem;
    display: flex;
    flex-direction: row;
    align-items: center;
  }
  .selector.on {
    background: var(--back-two-active);
  }
  .colorRange {
    z-index: 1;
    appearance: none;
    border-radius: 0.5em;
    background-color: rgba(0, 0, 0, 0.1);
    height: 0.5em;
    width: 100%;
    display: block;
    outline: none;
    transition: color 0.05s linear;
    background: linear-gradient(
      to right,
      hsl(0, 30%, 50%),
      hsl(60, 30%, 50%),
      hsl(120, 30%, 50%),
      hsl(180, 30%, 50%),
      hsl(240, 30%, 50%),
      hsl(300, 30%, 50%),
      hsl(360, 30%, 50%)
    );
    transition: background var(--transition-speed) linear;
  }
  .usingHue .colorRange {
    background: linear-gradient(
      to right,
      hsl(0, 80%, 50%),
      hsl(60, 80%, 50%),
      hsl(120, 80%, 50%),
      hsl(180, 80%, 50%),
      hsl(240, 80%, 50%),
      hsl(300, 80%, 50%),
      hsl(360, 80%, 50%)
    );
  }
  .colorRange:focus {
    outline: none;
  }
  .colorRange:active,
  .colorRange:hover:active {
    cursor: grabbing;
    cursor: -webkit-grabbing;
  }
  .colorRange::-moz-range-track {
    appearance: none;
    opacity: 0;
    outline: none !important;
  }
  .colorRange::-ms-track {
    outline: none !important;
    appearance: none;
    opacity: 0;
  }
  .colorRange::-webkit-slider-thumb {
    appearance: none;
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background-color: hsl(var(--hue), 30%, 50%);
  }
  .usingHue .colorRange::-webkit-slider-thumb {
    background-color: hsl(var(--hue), 80%, 50%);
  }
</style>
