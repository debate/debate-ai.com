<script lang="ts">
  import Icon from './Icon.svelte';
  export let direction: string = 'right';
</script>

<div class={`top ${direction}`}>
  <Icon name="arrowRight" />
</div>

<style>
  .top {
    transform: rotate(0deg);
    transition: transform var(--transition-speed);
  }
  .top.right {
    transform: rotate(0deg);
  }
  .top.left {
    transform: rotate(180deg);
  }
  .top.down {
    transform: rotate(90deg);
  }
  .top.up {
    transform: rotate(-90deg);
  }
</style>
