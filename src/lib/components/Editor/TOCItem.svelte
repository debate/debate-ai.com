<script lang="ts">
  export let heading;
  export let editor;

  function scrollToHeading(pos) {
    if (editor) {
      const { view } = editor;
      const domPos = view.domAtPos(pos);
      const node = domPos.node.childNodes[domPos.offset];
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
</script>

<li>
  <button
    class="text-gray-700 hover:text-gray-900 text-sm font-normal w-full text-left"
    on:click={() => scrollToHeading(heading.pos)}
    style="padding-left: {(heading.level - 1) * 1.5}rem;"
  >
    {heading.text}
  </button>
  {#if heading.children.length > 0}
    <ul class="mt-1">
      {#each heading.children as childHeading (childHeading.pos)}
        <svelte:self heading={childHeading} {editor} />
      {/each}
    </ul>
  {/if}
</li>

<style>
  ul {
    list-style-type: none;
    padding-left: 0;
  }
</style>