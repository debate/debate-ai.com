<g class="top">
  <path
    class="box"
    d="M20 95L20 130L20 160C20 171.046 28.9543 180 40 180L160 180C171.046 180 180 171.046 180 160L180 95"
    stroke="currentColor"
    stroke-width="20"
    stroke-linecap="round"
  />

  <g class="arrow">
    <path
      d="M137.092 56.8932L100.199 20L63.306 56.8932L100.199 56.8932L137.092 56.8932Z"
      fill="currentColor"
    />
    <path
      d="M100.199 20L137.092 56.8932L63.306 56.8932L100.199 20ZM100.199 20L100.199 129.602"
      stroke="currentColor"
      stroke-width="20"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </g>
</g>

<style>
  :global(*:hover > svg) > g > .arrow {
    translate: 0%-5%;
  }
  :global(*:active > svg) > g > .arrow {
    translate: 0% -15%;
  }

  :global(*:hover > svg) > g > .box {
    translate: 0% 5%;
  }
  :global(*:active > svg) > g > .box {
    translate: 0% 10%;
  }
  .arrow {
    transform-origin: 50% 40%;
  }
  .box,
  .arrow {
    transition: translate var(--transition-duration) ease-in-out,
      rotate var(--transition-duration) ease-in-out;
  }
</style>
