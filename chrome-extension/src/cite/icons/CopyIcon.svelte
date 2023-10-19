<path
  d="M39 57V147C39 163.569 52.4315 177 69 177H127"
  stroke-width="20"
  stroke-linecap="round"
  class="below"
/>
<path
  d="M88 144H146C154.284 144 161 137.284 161 129V39C161 30.7157 154.284 24 146 24H88C79.7157 24 73 30.7157 73 39V129C73 137.284 79.7157 144 88 144Z"
  stroke-width="20"
  stroke-linecap="round"
  class="above"
/>

<style>
  :global(*:hover > svg) > .below {
    transform: translate(-1%, 1%) rotate(2deg);
  }
  :global(*:hover > svg) .above {
    transform: translate(1%, -1%) rotate(-2deg);
  }
  :global(*:active > svg) > .below {
    transform: translate(2%, -2%) rotate(0deg);
  }
  :global(*:active > svg) .above {
    transform: translate(-2%, 2%) rotate(0deg);
  }
</style>
