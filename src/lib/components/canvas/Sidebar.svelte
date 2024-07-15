<script lang="ts">
    import { Brain, Grid, Calendar, Settings, ChevronRight } from 'lucide-svelte';
  
    let expandedItems = new Set();
  
    function toggleExpand(item) {
      if (expandedItems.has(item)) {
        expandedItems.delete(item);
      } else {
        expandedItems.add(item);
      }
      expandedItems = expandedItems; // Trigger reactivity
    }
  </script>
  
  <aside class="w-64 bg-gray-100 p-4 overflow-y-auto">
    <div class="flex items-center mb-4">
      <Brain class="w-6 h-6 mr-2 text-blue-500" />
      <span class="text-lg font-semibold">KnowledgeCanvas</span>
    </div>
    
    <nav>
      <ul>
        <li class="mb-2">
          <button class="flex items-center w-full text-left p-2 rounded hover:bg-gray-200" on:click={() => toggleExpand('Design')}>
            <ChevronRight class="w-4 h-4 mr-2 {expandedItems.has('Design') ? 'rotate-90' : ''}" />
            Design
          </button>
        </li>
        <li class="mb-2">
          <button class="flex items-center w-full text-left p-2 rounded hover:bg-gray-200" on:click={() => toggleExpand('AI/ML')}>
            <ChevronRight class="w-4 h-4 mr-2 {expandedItems.has('AI/ML') ? 'rotate-90' : ''}" />
            AI/ML
          </button>
        </li>
        <li class="mb-2">
          <button class="flex items-center w-full text-left p-2 rounded hover:bg-gray-200" on:click={() => toggleExpand('JPL')}>
            <ChevronRight class="w-4 h-4 mr-2 {expandedItems.has('JPL') ? 'rotate-90' : ''}" />
            JPL
          </button>
        </li>
        <li class="mb-2">
          <button class="flex items-center w-full text-left p-2 rounded hover:bg-gray-200" on:click={() => toggleExpand('UCLA')}>
            <ChevronRight class="w-4 h-4 mr-2 {expandedItems.has('UCLA') ? 'rotate-90' : ''}" />
            UCLA
          </button>
        </li>
        <li class="mb-2">
          <button class="flex items-center w-full text-left p-2 rounded bg-blue-100 hover:bg-blue-200" on:click={() => toggleExpand('Knowledge')}>
            <ChevronRight class="w-4 h-4 mr-2 rotate-90" />
            Knowledge
          </button>
          {#if expandedItems.has('Knowledge')}
            <ul class="ml-4 mt-2">
              <li class="mb-1"><a href="#" class="block p-2 rounded hover:bg-gray-200">Dependencies</a></li>
              <li class="mb-1"><a href="#" class="block p-2 rounded hover:bg-gray-200">Sources</a></li>
              <li class="mb-1"><a href="#" class="block p-2 rounded hover:bg-gray-200">Inspiration</a></li>
              <li class="mb-1"><a href="#" class="block p-2 rounded hover:bg-gray-200">Development</a></li>
            </ul>
          {/if}
        </li>
        <!-- Add more sidebar items here -->
      </ul>
    </nav>
    
    <div class="mt-auto pt-4">
      <button class="flex items-center w-full text-left p-2 rounded hover:bg-gray-200">
        <Grid class="w-4 h-4 mr-2" />
        Projects
      </button>
      <button class="flex items-center w-full text-left p-2 rounded hover:bg-gray-200">
        <Calendar class="w-4 h-4 mr-2" />
        Calendar
      </button>
      <button class="flex items-center w-full text-left p-2 rounded hover:bg-gray-200">
        <Settings class="w-4 h-4 mr-2" />
        Settings
      </button>
    </div>
  </aside>