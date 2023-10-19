<path
  d="M83 37H44C35.7157 37 29 43.7157 29 52V159.5C29 167.784 35.7157 174.5 44 174.5H151.5C159.784 174.5 166.5 167.784 166.5 159.5V113"
  stroke-width="20"
  stroke-linecap="round"
  class="window"
/>
<g class="arrow">
  <path
    d="M114.325 29H166.5V81.1749L140.413 55.0874L114.325 29Z"
    fill="currentColor"
  />
  <path
    d="M166.5 29H114.325L166.5 81.1749V29ZM166.5 29L89 106.5"
    stroke-width="20"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</g>

<style>
  .window {
    transform-origin: center;
  }
  :global(*:hover > svg) > .window {
    transform: translate(-3%, 3%);
  }
  .arrow {
    transition: transform var(--transition-duration) ease-in-out;
    transform-origin: 47% 53%;
  }
  :global(*:hover > svg) .arrow {
    transform: translate(5%, -5%);
  }
  :global(*:active > svg) > .window {
    transform: translate(-5%, 5%);
  }
  :global(*:active > svg) .arrow {
    transform: translate(15%, -15%);
  }
</style>
