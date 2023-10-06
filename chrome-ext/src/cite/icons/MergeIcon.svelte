<path
  d="M172.664 45L27 45"
  stroke-width="20"
  class="top"
  stroke-linecap="round"
/>
<path
  d="M173.664 100L28 100"
  stroke-width="20"
  stroke-linecap="round"
  class="middle"
/>
<path d="M134 155H28" stroke-width="20" stroke-linecap="round" class="bottom" />

<style>
  :global(*:hover:not(:disabled) > svg) > .top {
    transform: translate(0, -5%);
  }
  :global(*:hover:not(:disabled) > svg) > .bottom {
    transform: translate(0, 5%);
  }
  :global(*:active:not(:disabled) > svg) > .top {
    transform: translate(0, 5%);
  }

  :global(*:active:not(:disabled) > svg) > .bottom {
    transform: translate(0, -5%);
  }
</style>
