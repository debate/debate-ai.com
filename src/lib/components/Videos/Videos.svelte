<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Tabs, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
  import { Input } from "$lib/components/ui/input";
  import { Search, X } from 'lucide-svelte';
  import { cn } from "$lib/utils";

  import IconRounds from "./icon-rounds.svg";
  import IconLectures from "./icon-lectures.svg";
  import IconTopRounds from "./icon-top-rounds.svg";
  
  import debateVideos from '$lib/youtube/debate-videos.json';
  import TopicHistory from './TopicHistory.svelte';


  let allVideos = [];
  let filteredVideos = [];
  let currentPage = 1;
  let videosPerPage = 8;
  let currentCategory = 'rounds';
  let isLoading = true;
  let errorMessage = '';
  let searchTerm = '';
  let videoContainer: HTMLElement;
  let sortOrder = 'recency';

  const TOTAL_VIDEOS = 1700;
  const OPTION_PAGINATE_ON_TOP = false;

  onMount(() => {
    changeCategory('rounds');
  });

  function handleYearSelect(year) {
    searchTerm = String(year);
  }

  function changeCategory(category) {
    isLoading = true;
    currentCategory = category;
    try {
      clearSearch()
      allVideos = debateVideos[category];
      filterAndSortVideos();
      currentPage = 1;
      errorMessage = '';
    } catch (error) {
      console.error('Error changing category:', error);
      errorMessage = 'Error loading videos. Please try again.';
      allVideos = [];
      filteredVideos = [];
    } finally {
      isLoading = false;
    }
  }

  function filterAndSortVideos() {
    if (!searchTerm.trim()) {
      filteredVideos = [...allVideos];
    } else {
      let allVideosAllCategories = debateVideos.rounds
        .concat(debateVideos.lectures);
      const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(word => word.length > 0);
      filteredVideos = allVideosAllCategories.filter(video => {
        
        const [id, title, date, channel, views, description] = video;

        const stringAllContent = video.join(' ').toLowerCase();
        return searchWords.every(word => 
          stringAllContent.includes(word) 
        );
      });
    }

    filteredVideos.sort((a, b) => {
      if (sortOrder === 'recency') {
        return new Date(b[2]).getTime() - new Date(a[2]).getTime();
      } else if (sortOrder === 'views') {
        return parseInt(b[4]) - parseInt(a[4]);
      }
      return 0;
    });

    currentPage = 1;
    if (videoContainer) {
      videoContainer.scrollTop = 0;
    }
  }

  function clearSearch() {
    searchTerm = '';
    filterAndSortVideos();
  }

  function getEmbedUrl(videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  function getYoutubeUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  function formatViewCount(count) {
    if (!count) return '0';
    count = parseInt(count, 10);
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    } else {
      return count.toString();
    }
  }

  function handleSortChange() {
    filterAndSortVideos();
  }

  $: {
    if (searchTerm !== undefined) {
      filterAndSortVideos();
    }
  }

  $: paginatedVideos = filteredVideos.slice((currentPage - 1) * videosPerPage, currentPage * videosPerPage);
  $: totalPages = Math.ceil(filteredVideos.length / videosPerPage);

  function changePage(newPage) {
    currentPage = Math.max(1, Math.min(totalPages, newPage));
    if (videoContainer) {
      videoContainer.scrollTop = 0;
    }
  }

  function generatePagination(currentPage, totalPages) {
  let pages = [];
  const surroundingPages = 3; // Number of pages to show before and after the current page

  // Always add first page
  pages.push(1);

  // Add ellipsis if there's a gap after the first page
  if (currentPage - surroundingPages > 2) {
    pages.push('...');
  }

  // Add surrounding pages
  for (let i = Math.max(2, currentPage - surroundingPages); i <= Math.min(totalPages - 1, currentPage + surroundingPages); i++) {
    pages.push(i);
  }

  // Add ellipsis if there's a gap before the last page
  if (currentPage + surroundingPages < totalPages - 1) {
    pages.push('...');
  }

  // Always add last page if it's not already included
  if (totalPages > 1 && !pages.includes(totalPages)) {
    pages.push(totalPages);
  }

  return pages;
}


  $: paginationPages = generatePagination(currentPage, totalPages);
</script>

<svelte:head>
	<title>Videos</title>
	
</svelte:head>

<main class="container mx-auto p-4 flex flex-col min-h-screen">
  
  <div class="flex flex-wrap items-center mb-4 gap-4">
    <div class="relative w-full max-w-[270px]">
      <Input 
        type="text" 
        bind:value={searchTerm} 
        placeholder="Search about 2000 rounds & lectures…" 
        class="pl-7 pr-7 py-1 text-xs"
      />
      {#if searchTerm}
        <button 
          class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          on:click={clearSearch}
        >
          <X size={14} />
        </button>
      {/if}
    </div>
    <Tabs value={currentCategory} class="flex-grow">
      <TabsList>
        <TabsTrigger 
          value="rounds" 
          class={cn(
            currentCategory === 'rounds' && "bg-gray-700 text-white hover:bg-gray-600",
            "min-w-[2rem] flex items-center gap-1"
          )} 
          on:click={() => changeCategory('rounds')}
        >
          <img src={IconRounds} alt="Rounds icon" class="w-8 h-8  " />
          Rounds
        </TabsTrigger>
        <TabsTrigger 
          value="lectures" 
          class={cn(
            currentCategory === 'lectures' && "bg-gray-700 text-white hover:bg-gray-600",
            "min-w-[2rem] flex items-center gap-1"
          )} 
          on:click={() => changeCategory('lectures')}
        >
          <img src={IconLectures} alt="Lectures icon" class="w-6 h-6" />
          Lectures
        </TabsTrigger>
        <TabsTrigger 
          value="top" 
          class={cn(
            currentCategory === 'topPicks' && "bg-gray-700 text-white hover:bg-gray-600",
            "min-w-[2rem] flex items-center gap-1"
          )} 
          on:click={() => changeCategory('topPicks')}
        >
          <img src={IconTopRounds} alt="Top Rounds icon" class="w-6 h-6" />
          Top Rounds
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <TopicHistory  {handleYearSelect} />

    
   
    <select 
      bind:value={sortOrder} 
      on:change={handleSortChange}
      class="w-[180px] bg-white border border-gray-300 rounded-md p-2 text-sm"
    >
      <option value="recency">Sort by Recency</option>
      <option value="views">Sort by View Count</option>
    </select>
  </div>

  {#if isLoading}
  <p class="text-center text-base">Loading videos...</p>
{:else if errorMessage}
  <p class="text-center text-base text-red-500">{errorMessage}</p>
{:else if filteredVideos.length === 0}
  <p class="text-center text-base">No videos found for this category or search term.</p>
{:else}
  <div bind:this={videoContainer} class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4 overflow-y-auto flex-grow" style="max-height: calc(100vh - 200px);">
    {#each paginatedVideos as video}
      <Card class="flex flex-col shadow-lg transition-all duration-300 ease-in-out hover:shadow-xl hover:-translate-y-1">
        <CardHeader class="p-2">
          <CardTitle class="text-sm">
            <a href={getYoutubeUrl(video[0])} target="_blank" rel="noopener noreferrer" class="text-black hover:underline">
              {video[1]}
            </a>
          </CardTitle>
          <CardDescription class="text-xs">
            {video[3] ? video[3] + ' - ' : ''} {new Date(video[2]).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })} - {formatViewCount(video[4])} views
          </CardDescription>
        </CardHeader>
        <CardContent class="flex-grow p-2">
          <div class="aspect-video w-full mb-2">
            <iframe
              title={video[1]}
              src={getEmbedUrl(video[0])}
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
              class="w-full h-full rounded shadow-sm"
            ></iframe>
          </div>
          <p class="text-xs overflow-y-auto" style="max-height: 100px;">{video[5] || ''}</p>
        </CardContent>
      </Card>
    {/each}
  </div>


   {#if !OPTION_PAGINATE_ON_TOP}
  <div class="mt-auto py-2 flex justify-center items-center space-x-1">
    <Button size="sm" on:click={() => changePage(currentPage - 1)} disabled={currentPage === 1}>
      Previous
    </Button>
    {#each paginationPages as page}
      {#if page === '...'}
        <span class="px-1">...</span>
      {:else}
        <Button
          size="sm"
          variant={page === currentPage ? 'default' : 'outline'}
          on:click={() => changePage(page)}
          class={cn(
            page === currentPage && "bg-gray-700 text-white hover:bg-gray-600",
            "min-w-[2rem]"
          )}
        >
          {page}
        </Button>
      {/if}
    {/each}
    <Button size="sm" on:click={() => changePage(currentPage + 1)} disabled={currentPage === totalPages}>
      Next
    </Button>
  </div>
  
  {/if}


  {/if}
</main>
