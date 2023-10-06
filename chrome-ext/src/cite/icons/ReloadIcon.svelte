<g>
  <path
    d="M183.403 127.012L132.012 118L174.391 178.402L183.403 127.012Z"
    fill="currentColor"
    stroke-width="20"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M152.5 48.1264C140.354 37.4642 124.432 31 107 31C68.8924 31 38 61.8924 38 100C38 138.108 68.8924 169 107 169C124.432 169 140.354 162.536 152.5 151.874"
    stroke-width="20"
    stroke-linecap="round"
  />
</g>

<style>
  g {
    transform-origin: center;
  }
  :global(*:hover > svg) > g {
    transform: rotate(30deg);
  }
  @keyframes turn {
    from {
      transform: rotate(30deg);
    }
    to {
      transform: rotate(-330deg);
    }
  }
  :global(*.clicked > svg) > g {
    animation: turn calc(var(--transition-duration) * 3) normal;
  }
</style>
