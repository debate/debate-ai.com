<script lang="ts">
  import { cn } from '$lib/utils';

  let className: string | undefined = undefined;
  export { className as class };
</script>

<div class={cn('flex flex-1 flex-col gap-2 overflow-auto p-4', className)}>
  <slot />
</div>
