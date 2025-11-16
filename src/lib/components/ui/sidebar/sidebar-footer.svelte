<script lang="ts">
  import { cn } from '$lib/utils';

  let className: string | undefined = undefined;
  export { className as class };
</script>

<div class={cn('flex flex-col gap-2 p-4', className)}>
  <slot />
</div>
