<path
  d="M49 30V85C49 113.167 71.8335 136 100 136V136C128.167 136 151 113.167 151 85V30"
  stroke-width="20"
  stroke-linecap="round"
  class="letter"
/>
<path class="line" d="M50 171H150" stroke-width="20" stroke-linecap="round" />

<style>
  .line {
    transform-origin: center;
  }
  :global(*:hover > svg) > .line {
    transform: scale(1.5, 1);
  }
  :global(*:hover > svg) > .letter {
    transform: translate(0, -5%);
  }
</style>
