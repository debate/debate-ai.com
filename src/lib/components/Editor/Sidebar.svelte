<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Search, FileText, List } from 'lucide-svelte';
  import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "$lib/components/ui/select";
  import { Tabs, TabsList, TabsTrigger, TabsContent } from "$lib/components/ui/tabs";
  import TableOfContents from './TableOfContents.svelte';
  import SearchBox from './SearchBox.svelte';
  import QuoteCards from './QuoteCards.svelte';

  export let mainContent;
  export let headings;
  export let editor;
  export let currentHeading;
  export let handleLoadBlock;

  let lastEdited = mainContent.lastEdited || new Date().toLocaleDateString();
  let activeTab = 'outline';

  const dispatch = createEventDispatcher();

  let filteredHeadings = [];

  function handleHeadingsFiltered(event) {
    filteredHeadings = event.detail;
  }

  $: displayHeadings = filteredHeadings.length ? filteredHeadings : headings;
  $: htmlContent = mainContent.content || '';

</script>

<div class="bg-[#F3F3EE] h-full p-6 flex flex-col">
  <div class="space-y-4 overflow-y-auto flex-grow">
    <div class="sticky top-0 bg-[#F3F3EE] pt-2 z-10">
      <SearchBox {headings} {editor} on:headingsFiltered={handleHeadingsFiltered} />
    </div>

    <div class="text-md font-semibold tracking-tight text-gray-900">
      {mainContent.title}
    </div>
    <div class="space-y-2">
      <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400">Document Info</h3>
      <p class="text-sm text-gray-600">Last edited: {lastEdited}</p>
      <div class="text-sm text-gray-500">Word count: {mainContent.wordCount}</div>
    </div>

    <!-- Tabs for Outline and Quotes -->
    <Tabs bind:value={activeTab} class="w-full">
      <TabsList class="grid w-full grid-cols-2">
        <TabsTrigger value="outline" class="flex items-center gap-2">
          <List class="w-4 h-4" />
          Outline
        </TabsTrigger>
        <TabsTrigger value="quotes" class="flex items-center gap-2">
          <FileText class="w-4 h-4" />
          Quotes
        </TabsTrigger>
      </TabsList>

      <TabsContent value="outline" class="space-y-2 mt-4">
        <TableOfContents
          headings={displayHeadings}
          {handleLoadBlock}
          {mainContent}
          {editor}
          {currentHeading}
        />
      </TabsContent>

      <TabsContent value="quotes" class="mt-4">
        <QuoteCards {htmlContent} />
      </TabsContent>
    </Tabs>
  </div>
</div>