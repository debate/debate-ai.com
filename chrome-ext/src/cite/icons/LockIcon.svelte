<g>
  <g class="horseshoe">
    <path
      d="M146 83L146 56.5C146 31.371 125.629 11 100.5 11V11C75.371 11 55 31.371 55 56.5L55 83"
      stroke="currentColor"
      stroke-width="20"
      stroke-linecap="round"
    />
  </g>
  <g class="box">
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M39 83C27.9543 83 19 91.9543 19 103V170C19 181.046 27.9543 190 39 190H161C172.046 190 181 181.046 181 170V103C181 91.9543 172.046 83 161 83H100H39ZM120 124C120 131.403 115.978 137.866 110 141.324V159C110 164.523 105.523 169 100 169C94.4771 169 90 164.523 90 159V141.324C84.022 137.866 80 131.403 80 124C80 112.954 88.9543 104 100 104C111.046 104 120 112.954 120 124Z"
      fill="currentColor"
    />
  </g>
</g>

<style>
  :global(*:hover > svg) > g > .horseshoe {
    translate: 0%-5%;
  }
  :global(*:active > svg) > g > .horseshoe {
    translate: 0% -15%;
  }

  :global(*.selected > svg) > g > .horseshoe {
    rotate: 0deg;
  }
  .horseshoe {
    rotate: -30deg;
    transform-origin: 50% 30%;
  }

  :global(*:hover > svg) > g > .box {
    translate: 0% 5%;
  }
  :global(*:active > svg) > g > .box {
    translate: 0% 10%;
  }
  .box,
  .horseshoe {
    transition: translate var(--transition-duration) ease-in-out,
      rotate var(--transition-duration) ease-in-out;
  }
</style>
