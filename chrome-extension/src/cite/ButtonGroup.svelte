<script lang="ts">
  export let direction: 'row' | 'column' = 'row';
  export let floating: boolean = false;
</script>

<div class:column={direction == 'column'} class:floating>
  <slot />
</div>

<style>
  div {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    border-radius: 3em;
    background-color: var(--background-secondary);
    transition: box-shadow var(--transition-duration);
  }
  div.floating {
    box-shadow: var(--shadow);
  }
  div.column {
    flex-direction: column;
  }
</style>
