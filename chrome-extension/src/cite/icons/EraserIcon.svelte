<g>
  <path
    d="M178.248 76.0974L132.733 30.5824C126.857 24.7063 117.323 24.7273 111.473 30.6295L28.9733 113.862C23.1596 119.727 23.1805 129.189 29.0201 135.028L57.4243 163.432C60.2374 166.245 64.0527 167.826 68.0309 167.826L102.269 167.826C106.277 167.826 110.118 166.222 112.936 163.372L178.308 97.2499C184.109 91.3825 184.082 81.9316 178.248 76.0974Z"
    stroke-width="20"
  />
  <path
    d="M97.7754 30.2132C109.491 18.4975 128.486 18.4975 140.202 30.2132L179.093 69.1041C190.808 80.8198 190.808 99.8148 179.093 111.53L159.712 130.911L78.3952 49.5935L97.7754 30.2132Z"
    fill="currentColor"
  />
</g>

<style>
  @keyframes drag {
    0% {
      transform: translate(0, 0) rotate(0deg);
    }
    20% {
      transform: translate(-15%, -10%) rotate(7.5deg);
    }
    30% {
      transform: translate(-20%, 0) rotate(10deg);
    }
    100% {
      transform: translate(0, 0) rotate(0deg);
    }
  }
  :global(*.hovered > svg) > g {
    transform-origin: center;
    animation: drag calc(var(--transition-duration) * 5) linear normal;
  }
</style>
