<script lang="ts">
  import { cn } from '$lib/utils';

  let className: string | undefined = undefined;
  export { className as class };
</script>

<li class={cn('list-none', className)}>
  <slot />
</li>
