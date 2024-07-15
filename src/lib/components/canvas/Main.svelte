<script lang="ts">
    import { onMount } from 'svelte';
    import { Brain, Plus, Trash2, ChevronRight, Grid, Calendar, Settings } from 'lucide-svelte';
    import Sidebar from './Sidebar.svelte';
    import ContentCard from './ContentCard.svelte';
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "$lib/components/ui/select";
  
    let searchQuery = '';
    let sortBy = 'Most Recently Created';
    let filterBy = '';
    let currentPage = 1;
    let itemsPerPage = 50;
  
    let contentItems = [
      {
        title: 'How to Get Started with Spar...',
        type: 'AI/ML',
        image: '/path/to/spark-image.jpg',
        icon: 'play-circle'
      },
      {
        title: 'Introduction to Spark NLP: F...',
        type: 'AI/ML',
        image: '/path/to/nlp-image.jpg',
        icon: 'play-circle'
      },
      {
        title: 'DALL-E 2 Explained - YouTube',
        type: 'AI/ML',
        image: '/path/to/dalle-image.jpg',
        icon: 'youtube'
      },
      {
        title: 'GitHub - KnowledgeCanvas/ext...',
        type: 'Examples',
        image: '/path/to/github-image.jpg',
        icon: 'github'
      },
      {
        title: 'Knowledge on GitHub',
        type: 'Examples',
        image: '/path/to/knowledge-image.jpg',
        icon: 'github'
      },
      {
        title: 'knowledge_github_logo.png',
        type: 'Knowledge',
        image: '/path/to/logo-image.png',
        icon: 'image'
      }
    ];
  
    function handleSearch() {
      // Implement search functionality
    }
  
    function handleSort(event) {
      sortBy = event.detail;
      // Implement sorting functionality
    }
  
    function handleFilter() {
      // Implement filter functionality
    }
  
    function handlePageChange(newPage) {
      currentPage = newPage;
      // Implement page change functionality
    }
  
    function handleItemsPerPageChange(event) {
      itemsPerPage = parseInt(event.detail);
      // Implement items per page change functionality
    }
  </script>
  
  <div class="flex h-screen bg-white">
    <Sidebar />
    
    <main class="flex-1 overflow-y-auto p-4">
      <div class="flex justify-between items-center mb-4">
        <div class="flex items-center space-x-2">
          <Button variant="outline"><Plus class="w-4 h-4 mr-2" /> Project</Button>
          <Button variant="outline"><Trash2 class="w-4 h-4 mr-2" /> Remove</Button>
        </div>
        <div class="flex items-center space-x-2">
          <Input type="search" placeholder="Search" bind:value={searchQuery} on:input={handleSearch} />
          <Select on:change={handleSort} value={sortBy}>
            <SelectTrigger class="w-[200px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Most Recently Created">Most Recently Created</SelectItem>
              <SelectItem value="Oldest">Oldest</SelectItem>
              <SelectItem value="A-Z">A-Z</SelectItem>
              <SelectItem value="Z-A">Z-A</SelectItem>
            </SelectContent>
          </Select>
          <Input type="text" placeholder="Filter by title, type, date, etc." bind:value={filterBy} on:input={handleFilter} />
        </div>
      </div>
  
      <div class="grid grid-cols-3 gap-4">
        {#each contentItems as item}
          <ContentCard {item} />
        {/each}
      </div>
  
      <div class="flex justify-between items-center mt-4">
        <div class="flex space-x-2">
          <Button variant="outline" on:click={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>&lt;</Button>
          {#each Array(5) as _, i}
            <Button variant={currentPage === i + 1 ? 'default' : 'outline'} on:click={() => handlePageChange(i + 1)}>{i + 1}</Button>
          {/each}
          <Button variant="outline" on:click={() => handlePageChange(currentPage + 1)} disabled={currentPage === 5}>&gt;</Button>
        </div>
        <Select on:change={handleItemsPerPageChange} value={itemsPerPage.toString()}>
          <SelectTrigger class="w-[100px]">
            <SelectValue placeholder="Items per page" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </main>
  </div>
  
  <style>
    /* Add any global styles here */
  </style>