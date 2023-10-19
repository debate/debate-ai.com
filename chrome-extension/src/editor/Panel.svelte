<script lang="ts">
  import Icon from './Icon.svelte';
  import Button from './Button.svelte';
  import { Align } from './types';
  import { panel } from './transition';
  export let icon = 'ellipses';
  export let align: Align = Align.Left;
  export let title = 'Panel';
  export let open = false;
  // TODO add panel animations
</script>

<div class="top" class:open>
  <!-- TODO make shadows connect  -->
  <div
    class="opener"
    class:right={align == Align.Right ||
      align == Align.TopRight ||
      align == Align.BottomRight}
    class:bottom={align == Align.Bottom ||
      align == Align.BottomLeft ||
      align == Align.BottomRight}
  >
    {#if open}
      <Button on:click={() => (open = !open)} background={false}>
        <Icon name={'delete'} />
      </Button>
    {:else}
      <Button on:click={() => (open = !open)} hoverShadow={true}>
        <Icon name={icon} />
      </Button>
    {/if}
  </div>
  {#if open}
    <div class="content" transition:panel={{ align }}>
      <h1>{title}</h1>
      <slot />
    </div>
  {/if}
</div>

<style>
  .top {
    width: 100%;
    height: min-content;
    position: relative;
    font-size: 0.8em;
    display: block;
    position: relative;
  }
  .content {
    border-radius: var(--border-radius);
    background: var(--back-two-hover);
    padding: var(--padding);
    transition: box-shadow var(--transition-speed);
  }
  .top:hover > .content {
    box-shadow: var(--shadow);
  }
  .opener {
    position: absolute;
    z-index: 3;
  }

  .opener.right {
    right: 0;
  }
  .opener.bottom {
    bottom: 0;
  }
  h1 {
    margin: 0;
    font-size: 1em;
    color: var(--text-strong);
    height: calc(2rem- var(--padding));
    padding-bottom: var(--padding);
    font-weight: var(--bold);
  }
</style>
