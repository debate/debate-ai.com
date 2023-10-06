<script lang="ts">
  import Run from './Run.svelte';
  export let runs: {
    text: string;
    underline: boolean;
    highlight: boolean;
  }[];
</script>

<p>
  {#each runs as run}
    <Run {run} />
  {/each}
</p>

<style>
  p {
    margin: 0;
    margin-bottom: 1rem;
  }
  p:first-child {
    margin-top: var(--padding-big);
  }
</style>
