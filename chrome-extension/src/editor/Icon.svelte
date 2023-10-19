<script lang="ts">
  export let name: string;
  export let size: string = '1em';
  let icons: { name: string; svg: string }[] = [
    {
      name: 'arrowRight',
      svg: `<path d="M27 7L74 50L27 93" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    {
      name: 'arrowLeft',
      svg: `<path d="M74 93L27 50L74 7" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    {
      name: 'arrowUp',
      svg: `<path d="M7.5 73.5L50.5 26.5L93.5 73.5" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    {
      name: 'arrowDown',
      svg: `<path d="M93.5 26.5L50.5 73.5L7.5 26.5" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    {
      name: 'delete',
      svg: `<path d="M78.5685 22L22 78.5685" stroke-width="10" stroke-linecap="round"/>
<path d="M22 22L78.5685 78.5685" stroke-width="10" stroke-linecap="round"/>`,
    },
    {
      name: 'add',
      svg: `<path d="M50 15L50 85" stroke-width="10" stroke-linecap="round"/>
<path d="M15 50H85" stroke-width="10" stroke-linecap="round"/>`,
    },
    {
      name: 'download',
      svg: `<path d="M71 45L50 68L29 45" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M20 85L80 85" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M50 66L50 14" stroke-width="10" stroke-linecap="round"/>`,
    },
    {
      name: 'upload',
      svg: `<path d="M29 37L50 14L71 37" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M20 85L80 85" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M50 16L50 68" stroke-width="10" stroke-linecap="round"/>`,
    },
    {
      name: 'addUp',
      svg: `<path d="M85 25V25C87.7614 25 90 27.2386 90 30V70C90 75.5228 85.5228 80 80 80H20C14.4772 80 10 75.5228 10 70L10 30C10 27.2386 12.2386 25 15 25V25" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M35 25H65" stroke-width="10" stroke-linecap="round"/>
<path d="M50 40V10" stroke-width="10" stroke-linecap="round"/>`,
    },
    {
      name: 'addDown',
      svg: `<path d="M15 75V75C12.2386 75 10 72.7614 10 70L10 30C10 24.4772 14.4772 20 20 20L80 20C85.5228 20 90 24.4772 90 30L90 70C90 72.7614 87.7614 75 85 75V75" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M65 75H35" stroke-width="10" stroke-linecap="round"/>
<path d="M50 60L50 90" stroke-width="10" stroke-linecap="round"/>`,
    },
    {
      name: 'addRight',
      svg: `<path d="M75 85V85C75 87.7614 72.7614 90 70 90H30C24.4772 90 20 85.5228 20 80V20C20 14.4772 24.4772 10 30 10H70C72.7614 10 75 12.2386 75 15V15" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M75 35V65" stroke-width="10" stroke-linecap="round"/>
<path d="M60 50H90" stroke-width="10" stroke-linecap="round"/>`,
    },
    {
      name: 'undo',
      svg: `<path d="M10 47H70C81.0457 47 90 55.9543 90 67V77" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M36 70L10 47L36 24" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    {
      name: 'redo',
      svg: `<path d="M90 47H30C18.9543 47 10 55.9543 10 67V77" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M64 70L90 47L64 24" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    {
      name: 'settings',
      svg: `<line x1="10" y1="50" x2="90" y2="50" stroke-width="10" stroke-linecap="round"/>
<line x1="10" y1="80" x2="90" y2="80" stroke-width="10" stroke-linecap="round"/>
<line x1="10" y1="20" x2="90" y2="20" stroke-width="10" stroke-linecap="round"/>
<circle cx="26.25" cy="50.25" r="6.25" stroke-width="10"/>
<circle cx="71.25" cy="80.25" r="6.25" stroke-width="10"/>
<circle cx="71.25" cy="20.25" r="6.25" stroke-width="10"/>`,
    },
    {
      name: 'check',
      svg: `<path d="M88.7817 29.2843L39.2842 78.7817L11 50.4975" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    {
      name: 'dots',
      svg: `<circle cx="26.25" cy="50.25" r="5.625" stroke-width="11.25"/>
<circle cx="71.25" cy="80.25" r="5.625" stroke-width="11.25"/>
<circle cx="71.25" cy="20.25" r="5.625" stroke-width="11.25"/>`,
    },
    {
      name: 'copy',
      svg: `<path d="M20 73V73C17.2386 73 15 70.7614 15 68L15 19C15 13.4772 19.4772 9 25 9H60C62.7614 9 65 11.2386 65 14V14" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M35 38V82C35 87.5228 39.4772 92 45 92H75C80.5228 92 85 87.5228 85 82V38C85 32.4772 80.5228 28 75 28H45C39.4772 28 35 32.4772 35 38Z" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    {
      name: 'magnifyGlass',
      svg: `<rect width="100" height="100" fill="black"/>
<circle cx="46.5" cy="46.5" r="35.5" stroke-width="10"/>
<path d="M72 73L80.5 81.5L89 90" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    {
      name: 'magnifyGlassMinus',
      svg: `<circle cx="46.5" cy="46.5" r="35.5" stroke-width="10"/>
<path d="M72 73L80.5 81.5L89 90" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M32 46H62" stroke-width="10" stroke-linecap="round"/>`,
    },
    {
      name: 'magnifyGlassPlus',
      svg: `<circle cx="46.5" cy="46.5" r="35.5" stroke-width="10"/>
<path d="M72 73L80.5 81.5L89 90" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M42 61C42 63.7614 44.2386 66 47 66C49.7614 66 52 63.7614 52 61V51H62C64.7614 51 67 48.7614 67 46C67 43.2386 64.7614 41 62 41H52V31C52 28.2386 49.7614 26 47 26C44.2386 26 42 28.2386 42 31V41H32C29.2386 41 27 43.2386 27 46C27 48.7614 29.2386 51 32 51H42V61Z" fill="currentColor"/>`,
    },
    {
      name: 'link',
      svg: `<path d="M42.929 71.2132L53.5356 81.8198C61.3461 89.6303 74.0094 89.6303 81.8199 81.8198V81.8198C89.6304 74.0093 89.6304 61.346 81.8199 53.5355L71.2133 42.9289" stroke-width="10" stroke-linecap="round"/>
<path d="M28.7868 57.0711L18.1802 46.4645C10.3697 38.654 10.3697 25.9907 18.1802 18.1802V18.1802C25.9907 10.3697 38.654 10.3697 46.4645 18.1802L57.0711 28.7868" stroke-width="10" stroke-linecap="round"/>
<path d="M37.272 37.2721L63.0814 63.0815" stroke-width="10" stroke-linecap="round"/>`,
    },
    {
      name: 'ellipses',
      svg: `<circle cx="19.25" cy="50.25" r="5.625" stroke-width="11.25"/>
<circle cx="50.25" cy="50.25" r="5.625" stroke-width="11.25"/>
<circle cx="81.25" cy="50.25" r="5.625" stroke-width="11.25"/>`,
    },
    {
      name: 'funnel',
      svg: `<line x1="25" y1="50" x2="75" y2="50" stroke-width="10" stroke-linecap="round"/>
<line x1="40" y1="79" x2="60" y2="79" stroke-width="10" stroke-linecap="round"/>
<line x1="10" y1="20" x2="90" y2="20" stroke-width="10" stroke-linecap="round"/>`,
    },
    {
      name: 'copyBelow',
      svg: `<path d="M20 73V73C17.2386 73 15 70.7614 15 68V62M65 14V14C65 11.2386 62.7614 9 60 9H25C19.4772 9 15 13.4772 15 19L15 31" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M35 33V33C35 30.2386 37.2386 28 40 28H75C80.5228 28 85 32.4772 85 38V82C85 87.5228 80.5228 92 75 92H45C39.4772 92 35 87.5228 35 82V82" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M73 47L49.5 73L26 47" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    {
      name: 'copyAbove',
      svg: `<path d="M20 73V73C17.2386 73 15 70.7614 15 68V62M65 14V14C65 11.2386 62.7614 9 60 9H25C19.4772 9 15 13.4772 15 19L15 31" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M35 33V33C35 30.2386 37.2386 28 40 28H75C80.5228 28 85 32.4772 85 38V82C85 87.5228 80.5228 92 75 92H45C39.4772 92 35 87.5228 35 82V82" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M73 47L49.5 73L26 47" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M73 73L49.5 81.5L26 73" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    {
      name: 'rainbow',
      svg: `<path d="M28 68C28 36 70 36 70 68" stroke-width="10" stroke-linecap="round"/>
<path d="M8 68C8 9.33333 92 9.33333 92 68" stroke-width="10" stroke-linecap="round"/>`,
    },
  ];
  let displayIcon: { name: string; svg: string };
  function findIcon() {
    displayIcon = icons.find(
      (icon: { name: string; svg: string }) => icon.name === name
    );
  }
  findIcon();
  $: name, findIcon();
</script>

<svg
  style={`width:${size};height:${size};`}
  viewBox="0 0 {100} {100}"
  fill="none"
  stroke="var(--text)"
>
  {@html displayIcon.svg}
</svg>

<style>
  svg {
    display: block;
    margin: auto;
    color: inherit;
    stroke: currentColor;
    pointer-events: none;
  }
</style>
