<script lang="ts">
  import { onMount } from 'svelte';
  import TOCItem from './TOCItem.svelte';

  export let headings = [];
  export let editor;


  function createNestedHeadings(headings) {
    const nestedHeadings = [];
    const stack = [{ level: 0, children: nestedHeadings }];

    headings.forEach(heading => {
      if (heading.level > 5) return; // Only include h1, h2, and h3

      while (heading.level <= stack[stack.length - 1].level) {
        stack.pop();
      }
      const parent = stack[stack.length - 1];
      const newHeading = { ...heading, children: [] };
      parent.children.push(newHeading);
      stack.push(newHeading);
    });

    return nestedHeadings;
  }

  $: nestedHeadings = createNestedHeadings(headings);
</script>

<div class="w-64 h-full overflow-y-auto">
  <h2 class="text-lg font-semibold mb-4 text-gray-700"></h2>
  <ul class="">
    {#each nestedHeadings as heading (heading.pos)}
      <TOCItem {heading} {editor} />
    {/each}
  </ul>
</div>

<style>
  ul {
    list-style-type: none;
    padding-left: 0;
  }
</style>