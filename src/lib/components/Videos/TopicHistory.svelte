<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import TrophyIcon from "./icon-trophy.svg";
  
  // Import both NDT and TOC data
  import { ndt, toc } from './debate-topic-history';

  type DebateEntry = {
    topic: string;
    winner: string;
  };

  // Define the prop
  export let handleYearSelect: (year: string) => void;

  let selectedYear: string = "2024";  // Default to 2024
  let yearData: { ndt: DebateEntry; toc: DebateEntry } | null = null;

  const MIN_YEAR = 2002;
  const years = Object.keys(toc).sort((a, b) => parseInt(b) - parseInt(a))
    .filter(year => parseInt(year) >= MIN_YEAR);

  const dispatch = createEventDispatcher();

  function handleSelect() {
    if (selectedYear && toc[selectedYear]) {
      yearData = {
        ndt: ndt[selectedYear],
        toc: toc[selectedYear]
      };
      // Call the prop function
      handleYearSelect(selectedYear);
      // Dispatch an event for components that prefer event-based communication
      dispatch('yearSelect', selectedYear);
    } else {
      yearData = null;
    }
  }

  onMount(() => {
    handleSelect(); // Load data for 2024 on mount
  });
</script>

<div class="flex items-center max-w-xs mx-auto">
<div class="w-[100px] mr-2">
  <select
    bind:value={selectedYear}
    on:change={handleSelect}
    class="w-full px-4 py-2 text-left bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    {#each years as year}
      <option value={year}>{year}</option>
    {/each}
  </select>
</div>

<div class="relative inline-block">
  <button class="p-2 rounded-full hover:bg-gray-100 transition-colors">
    <img src={TrophyIcon} alt="Trophy" class="h-5 w-5" />
    <span class="sr-only">Debate History</span>
  </button>
  {#if yearData}
    <div class="tooltip absolute z-10 invisible opacity-0 transition-opacity bg-white text-gray-800 text-sm rounded-lg py-3 px-4 left-1/2 -translate-x-1/2 mt-2 w-96 shadow-lg border border-gray-200">
      <h3 class="font-bold">{selectedYear}</h3>
      {#if yearData.ndt}
        <div class="flex items-center mb-1">
          <img src={TrophyIcon} alt="Trophy" class="h-4 w-4 mr-2" />
          <span class="font-semibold">College NDT Champions:</span> 
          <span class="ml-1">{yearData.ndt?.winner || 'TBA'}</span>
        </div>
        <p class="mb-3 ml-6">{yearData.ndt?.topic || 'TBA'}</p>
      {/if}
      <div class="flex items-center mb-1">
        <img src={TrophyIcon} alt="Trophy" class="h-4 w-4 mr-2" />
        <span class="font-semibold">TOC Policy Champions:</span>
        <span class="ml-1">{yearData.toc?.policy?.toc || 'TBA'}</span>
      </div>
      {#if yearData.toc?.policy?.ndca}

      <div class="flex items-center mb-1">
        <img src={TrophyIcon} alt="Trophy" class="h-4 w-4 mr-2" />
        <span class="font-semibold">NDCA Policy Champions:</span>
        <span class="ml-1">{yearData.toc?.policy?.ndca || 'TBA'}</span>
      </div>
      {/if}

      <p class="mb-1 ml-6">{yearData.toc?.policy?.topic || 'TBA'}</p>
    </div>
  {/if}
</div>
</div>

<style>
.relative:hover .tooltip {
  visibility: visible;
  opacity: 1;
}

.tooltip {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease-in-out;
}

.tooltip::before {
  content: "";
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  border-width: 0 6px 6px 6px;
  border-style: solid;
  border-color: transparent transparent white transparent;
  filter: drop-shadow(0 -1px 1px rgba(0, 0, 0, 0.1));
}
</style>