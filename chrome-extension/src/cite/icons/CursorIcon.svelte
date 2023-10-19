<path
  d="M53.1984 27.25L169.397 119.512L115.627 135.379L75 174.012L53.1984 27.25Z"
  stroke-width="20"
  stroke-linejoin="round"
/>

<style>
  path {
    transform-origin: center;
  }
  @keyframes spin {
    0% {
      transform: rotate(15deg);
    }
    100% {
      transform: rotate(375deg);
    }
  }
  :global(:hover > svg) > path {
    transform: rotate(15deg);
  }
</style>
