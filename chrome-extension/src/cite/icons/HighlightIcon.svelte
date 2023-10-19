<g class="top">
  <path
    d="M79.1126 161.07L168.685 71.4975C174.543 65.6396 174.543 56.1421 168.685 50.2843L151.008 32.6066C145.15 26.7487 135.652 26.7488 129.794 32.6066L40.2217 122.179"
    stroke-width="20"
  />
  <path
    fill-rule="evenodd"
    clip-rule="evenodd"
    d="M33.5166 114.742C33.5166 114.742 33.5165 114.742 33.5165 114.742C18.8719 129.387 18.8719 153.131 33.5165 167.775C48.1612 182.42 71.9049 182.42 86.5495 167.775L33.5166 114.742Z"
    fill="currentColor"
  />
</g>

<style>
  @keyframes wiggle {
    0% {
      transform: rotate(0deg);
    }
    25% {
      transform: rotate(8deg);
    }
    50% {
      transform: rotate(0deg);
    }
    75% {
      transform: rotate(-8deg);
    }
    100% {
      transform: rotate(0deg);
    }
  }
  .top {
    transform-origin: 60% 40%;
  }

  :global(*.hovered > svg) > .top {
    animation: wiggle calc(var(--transition-duration) * 2) linear normal;
  }
</style>
