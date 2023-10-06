<path
  d="M94.5139 8.86813C97.6008 7.09245 101.399 7.09245 104.486 8.86813L184.392 54.8318C193.268 59.9373 189.646 73.5 179.406 73.5H19.5938C9.3543 73.5 5.73181 59.9373 14.6077 54.8318L94.5139 8.86813Z"
  fill="currentColor"
  class="roof"
/>
<line
  x1="45"
  y1="96"
  x2="45"
  y2="147"
  stroke-width="20"
  stroke-linecap="round"
/>
<line
  x1="82"
  y1="96"
  x2="82"
  y2="147"
  stroke-width="20"
  stroke-linecap="round"
/>
<line
  x1="118"
  y1="96"
  x2="118"
  y2="147"
  stroke-width="20"
  stroke-linecap="round"
/>
<line
  x1="155"
  y1="96"
  x2="155"
  y2="147"
  stroke-width="20"
  stroke-linecap="round"
/>
<path d="M175 179.5L25 179.5" stroke-width="20" stroke-linecap="round" />

<style>
  @keyframes drop {
    0% {
      transform: translateY(0%);
    }
    55% {
      transform: translateY(-10%);
    }
    85% {
      transform: translateY(-10%);
    }
    100% {
      transform: translateY(0);
    }
  }
  :global(*.hovered > svg) > .roof {
    animation: drop calc(var(--transition-duration) * 3) linear normal;
  }
</style>
