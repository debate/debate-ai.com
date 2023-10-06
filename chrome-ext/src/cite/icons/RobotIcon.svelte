<g>
  <path
    d="M23 123C23 89.8629 49.8629 63 83 63H99.5H116C149.137 63 176 89.8629 176 123V168C176 173.523 171.523 178 166 178H33C27.4772 178 23 173.523 23 168V123Z"
    stroke="currentColor"
    stroke-width="20"
  />
  <g class="eyes">
    <circle cx="70" cy="123" r="15" fill="currentColor" />
    <circle cx="130" cy="123" r="15" fill="currentColor" />
  </g>
  <path
    d="M55.2075 14L68.2367 63.4556"
    stroke="currentColor"
    stroke-width="20"
    stroke-linecap="round"
    class="antlerLeft"
  />
  <path
    d="M144.237 14L131.208 63.4556"
    stroke="currentColor"
    stroke-width="20"
    stroke-linecap="round"
    class="antlerRight"
  />
  <path
    d="M190 108C195.523 108 200 112.477 200 118L200 148C200 153.523 195.523 158 190 158L180 158L180 108L190 108Z"
    fill="currentColor"
  />
  <path
    d="M10 111C4.47715 111 1.95703e-07 115.477 4.37114e-07 121L1.74846e-06 151C1.98987e-06 156.523 4.47716 161 10 161L20 161L20 111L10 111Z"
    fill="currentColor"
  />
</g>

<style>
  g {
    transform-origin: center;
  }
  :global(*:hover > svg) > g > .eyes {
    transform: translateY(-5%);
  }

  :global(*.clicked > svg) > g {
    animation: upDown calc(var(--transition-duration) * 4);
  }

  @keyframes upDown {
    0% {
      transform: translateY(0%);
    }
    50% {
      transform: translateY(-10%);
    }
    100% {
      transform: translateY(0%);
    }
  }

  :global(*.clicked > svg) > g > .antlerLeft {
    animation: antlerLeft calc(var(--transition-duration) * 4);
  }
  .antlerLeft {
    transform-origin: 50% 50%;
  }

  :global(*.clicked > svg) > g > .antlerRight {
    animation: antlerRight calc(var(--transition-duration) * 4);
  }

  .antlerRight {
    transform-origin: 50% 50%;
  }

  @keyframes antlerLeft {
    0% {
      transform: rotate(0deg);
    }
    50% {
      transform: rotate(25deg) scale(1.2);
    }
    100% {
      transform: rotate(0deg);
    }
  }

  @keyframes antlerRight {
    0% {
      transform: rotate(0deg);
    }
    50% {
      transform: rotate(-25deg) scale(1.2);
    }
    100% {
      transform: rotate(0deg);
    }
  }
</style>
