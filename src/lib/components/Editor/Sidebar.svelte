<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { FileText } from 'lucide-svelte';
  import TableOfContents from './TableOfContents.svelte';
  import SearchBox from './SearchBox.svelte';
  import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent
  } from '$lib/components/ui/sidebar';

  export let mainContent;
  export let headings;
  export let editor;
  export let currentHeading;
  export let handleLoadBlock;

  let lastEdited = mainContent.lastEdited || new Date().toLocaleDateString();

  const dispatch = createEventDispatcher();

  let filteredHeadings = [];

  function handleHeadingsFiltered(event) {
    filteredHeadings = event.detail;
  }

  $: displayHeadings = filteredHeadings.length ? filteredHeadings : headings;

</script>

<Sidebar class="bg-[#F3F3EE]">
  <SidebarHeader class="sticky top-0 bg-[#F3F3EE] z-10">
    <SearchBox {headings} {editor} on:headingsFiltered={handleHeadingsFiltered} />

    <div class="flex items-center gap-2 pt-2">
      <FileText class="h-4 w-4 text-gray-600" />
      <div class="text-md font-semibold tracking-tight text-gray-900">
        {mainContent.title}
      </div>
    </div>
  </SidebarHeader>

  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupLabel>Document Info</SidebarGroupLabel>
      <SidebarGroupContent>
        <p class="text-sm text-gray-600">Last edited: {lastEdited}</p>
        <div class="text-sm text-gray-500">Word count: {mainContent.wordCount}</div>
      </SidebarGroupContent>
    </SidebarGroup>

    <SidebarGroup>
      <SidebarGroupLabel>Outline</SidebarGroupLabel>
      <SidebarGroupContent>
        <TableOfContents
          headings={displayHeadings}
          {handleLoadBlock}
          {mainContent}
          {editor}
          {currentHeading}
        />
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>
</Sidebar>