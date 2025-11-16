<script lang="ts">
  import { cn } from '$lib/utils';

  let className: string | undefined = undefined;
  export { className as class };
</script>

<ul class={cn('ml-4 flex flex-col gap-1 border-l pl-3', className)}>
  <slot />
</ul>
