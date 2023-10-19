<g class="top">
  <path
    class="box"
    d="M100 180H135H165C176.046 180 185 171.046 185 160V40C185 28.9543 176.046 20 165 20H100"
    stroke="currentColor"
    stroke-width="20"
    stroke-linecap="round"
  />

  <g class="arrow">
    <path
      d="M61.8932 136.694L25 99.8008L61.8932 62.9076L61.8932 99.8008V136.694Z"
      fill="currentColor"
    />
    <path
      d="M25 99.8008L61.8932 136.694L61.8932 62.9076L25 99.8008ZM25 99.8008L134.602 99.8008"
      stroke="currentColor"
      stroke-width="20"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </g>
</g>

<style>
  :global(*:hover > svg) > g > .arrow {
    translate: -5% 0%;
  }
  :global(*:active > svg) > g > .arrow {
    translate: -15% 0%;
  }

  :global(*:hover > svg) > g > .box {
    translate: 5% 0%;
  }
  :global(*:active > svg) > g > .box {
    translate: 10% 0%;
  }

  :global(*.selected:active > svg) > g > .arrow {
    translate: 5% 0%;
  }
  :global(*.selected:active > svg) > g > .box {
    translate: -5% 0%;
  }

  :global(*.selected > svg) > g .arrow {
    rotate: 180deg;
  }
  .arrow {
    transform-origin: 40% 50%;
  }
  .box,
  .arrow {
    transition: translate var(--transition-duration) ease-in-out,
      rotate var(--transition-duration) ease-in-out;
  }
</style>
