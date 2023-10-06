<g class="letter">
  <path
    d="M180.831 175.831L170.626 150.087L168.344 144.331M92.8306 175.831L103.035 150.087L105.317 144.331M105.317 144.331L136.831 64.8306L168.344 144.331M105.317 144.331H168.344"
    stroke-width="20"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</g>
<g class="arrow">
  <path
    d="M76.78 82.78L76.78 48L59.39 65.39L42 82.78H76.78Z"
    fill="currentColor"
  />
  <path
    d="M59.39 65.39L42 82.78H76.78L76.78 48L59.39 65.39ZM59.39 65.39L23.5 29.5"
    stroke-width="20"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</g>

<style>
  g {
    transform-origin: center;
  }
  .arrow {
    transform: rotate(180deg);
    transform-origin: 25% 25%;
  }
  :global(.selected) .arrow {
    transform: rotate(0deg);
  }
  :global(*:hover > svg) > .arrow {
    transform: rotate(180deg) translate(5%, 5%);
  }
  :global(.selected:hover > svg) > .arrow {
    transform: rotate(0deg) translate(-5%, -5%);
  }
  .letter {
    transform-origin: bottom right;
  }
  :global(*:hover > svg) > .letter {
    transform: scale(0.9);
  }
</style>
