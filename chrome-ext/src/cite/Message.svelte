<script lang="ts">
  import { createTransition } from './transition';
  export let text: string;
  export let error: boolean;

  let transition = createTransition(
    (t, eased, info) => {
      return `
        transform: scale(${eased});
        height: ${eased * info}px;
        padding: calc(var(--padding-small) * ${eased}) calc(var(--padding) * ${eased}); 
      `;
    },
    'sineOut',
    {
      preRun: (node: HTMLElement) => {
        return node.getBoundingClientRect().height;
      },
    }
  );
</script>

<div class="message" class:error transition:transition|local>
  {text}
</div>

<style>
  .message {
    padding: var(--padding-small) var(--padding);
    font-size: 0.8rem;
    color: var(--text-tooltip);
    background-color: var(--background-tooltip);
    border-radius: var(--radius-big);
    white-space: nowrap;
    width: min-content;
    box-sizing: border-box;
    pointer-events: all;
    box-shadow: var(--shadow);
  }
  .error {
    color: var(--text-error);
  }
</style>
