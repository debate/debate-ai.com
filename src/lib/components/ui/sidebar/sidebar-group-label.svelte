<script lang="ts">
  import { cn } from '$lib/utils';

  let className: string | undefined = undefined;
  export { className as class };
</script>

<div class={cn('px-2 py-1.5 text-sm font-semibold text-muted-foreground', className)}>
  <slot />
</div>
