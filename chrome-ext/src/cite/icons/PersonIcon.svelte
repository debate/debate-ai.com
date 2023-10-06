<path
  fill-rule="evenodd"
  clip-rule="evenodd"
  d="M150 76.5C150 104.39 127.39 127 99.5 127C71.6096 127 49 104.39 49 76.5C49 48.6096 71.6096 26 99.5 26C127.39 26 150 48.6096 150 76.5ZM91 87.5C91 94.4036 85.4036 100 78.5 100C71.5964 100 66 94.4036 66 87.5C66 80.5964 71.5964 75 78.5 75C85.4036 75 91 80.5964 91 87.5ZM120.5 100C127.404 100 133 94.4036 133 87.5C133 80.5964 127.404 75 120.5 75C113.596 75 108 80.5964 108 87.5C108 94.4036 113.596 100 120.5 100Z"
  fill="currentColor"
  class="head"
/>
<path
  d="M33 171C33 144.856 47.786 122.187 69.4016 111C69.4016 111 87.068 118.375 100 118.375C112.932 118.375 130.598 111 130.598 111C152.214 122.187 167 144.856 167 171"
  stroke-width="20"
  stroke-linecap="round"
/>

<style>
  @keyframes wiggle {
    0% {
      transform: rotate(0deg);
    }
    25% {
      transform: rotate(16deg);
    }
    50% {
      transform: rotate(0deg);
    }
    75% {
      transform: rotate(-16deg);
    }
    100% {
      transform: rotate(0deg);
    }
  }
  .head {
    transform-origin: center;
  }
  :global(*.hovered > svg) > .head {
    animation: wiggle calc(var(--transition-duration) * 4) linear normal;
  }
</style>
