<g>
  <path
    class="back"
    d="M180 160C180 171.046 171.046 180 160 180H100H40C28.9543 180 20 171.046 20 160V40C20 28.9543 28.9543 20 40 20H160C171.046 20 180 28.9543 180 40V160Z"
    stroke="currentColor"
    stroke-width="20"
  />
  <g class="wheel">
    <path
      d="M133 101.5C133 119.449 118.449 134 100.5 134V134V134C82.5507 134 68 119.449 68 101.5V101.5C68 83.5508 82.5507 69 100.5 69V69C118.449 69 133 83.5507 133 101.5V101.5Z"
      stroke="currentColor"
      stroke-width="20"
    />
    <g class="teeth">
      <path
        d="M153.355 62.2132C157.261 58.308 157.261 51.9763 153.355 48.0711V48.0711C149.45 44.1658 143.119 44.1658 139.213 48.0711L118 69.2843L132.142 83.4264L153.355 62.2132Z"
        fill="currentColor"
      />
      <path
        d="M47.0711 140.213C43.1658 144.118 43.1658 150.45 47.0711 154.355V154.355C50.9763 158.261 57.308 158.261 61.2132 154.355L82.4264 133.142L68.2843 119L47.0711 140.213Z"
        fill="currentColor"
      />
      <path
        d="M139.213 154.355C143.118 158.261 149.45 158.261 153.355 154.355V154.355C157.26 150.45 157.26 144.118 153.355 140.213L132.142 119L118 133.142L139.213 154.355Z"
        fill="currentColor"
      />
      <path
        d="M61.2132 48.0711C57.3079 44.1658 50.9763 44.1658 47.071 48.0711V48.0711C43.1658 51.9763 43.1658 58.308 47.071 62.2132L68.2842 83.4264L82.4264 69.2843L61.2132 48.0711Z"
        fill="currentColor"
      />
    </g>
  </g>
</g>

<style>
  g {
    transform-origin: center;
  }
  :global(*:hover > svg) > g > .back {
    transform: scale(1.1);
  }
  .teeth,
  .back {
    transform-origin: center;
  }
  :global(*.selected > svg) > g .teeth {
    transform: scale(0);
  }
  :global(*.selected.clicked > svg) > g .teeth {
    animation: spin calc(var(--transition-duration) * 3) ease-in-out;
  }

  :global(*.clicked > svg) > g .teeth {
    animation: spinBack calc(var(--transition-duration) * 3) ease-in-out;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg) scale(1);
    }
    50% {
      transform: rotate(90deg) scale(1);
    }
    100% {
      transform: rotate(90deg) scale(0);
    }
  }
  @keyframes spinBack {
    0% {
      transform: rotate(90deg) scale(0);
    }
    50% {
      transform: rotate(90deg) scale(1);
    }
    100% {
      transform: rotate(0deg) scale(1);
    }
  }
</style>
