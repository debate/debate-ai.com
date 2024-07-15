<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import type { Editor } from '@tiptap/core';
  import { Pane, Splitpanes } from 'svelte-splitpanes';
  import { TableOfContentsExtension } from './TableOfContents.js';
  import { writable } from 'svelte/store';
  import * as storageAPI from '$lib/api/local-storage-api.js';
  import Sidebar from './Sidebar.svelte';
  import TopBar from './TopBar.svelte';
  import { parseDebateDocx } from "$lib/docx/parse-debate-docx";
  import { documentToMarkup } from "$lib/docx/docx-to-html";
  
  import './view-modes.css';
 
  export let mainContent;
  export let fileNameId: string = null;

  const MAX_RECENT_BLOCKS = 8;
  
  let editor: Editor | null = null;
  let EditorContent: any;
  let BubbleMenu: any;
  let isEditorReady = false;
  let viewMode = 'highlighted';
  let headings = [];
  let readingStyle = 'default';
  let fileInput: HTMLInputElement;
  let currentHeading = null;
  let activeBlockIndex: number | null = null;
  let recentBlocks: { blockIndex: number, title: string, level: number }[] = [];

  const mainContentStore = writable({
    title: "Title",
    content: "",
    wordCount: 0,
    blocks: [],
    outline: []
  });

  mainContentStore.subscribe(value => {
    mainContent = value;
  });

  onMount(async () => {
    if (browser) {
      const tiptapModule = await import('svelte-tiptap');
      const starterKitModule = await import('@syfxlin/tiptap-starter-kit');
      
      EditorContent = tiptapModule.EditorContent;
      BubbleMenu = tiptapModule.BubbleMenu;
      
      await createEditor(tiptapModule, starterKitModule);
    }
  });

  async function createEditor(tiptapModule, starterKitModule) {
    const content = viewMode === 'edit' 
      ? (activeBlockIndex !== null ? mainContent.blocks[activeBlockIndex] : '')
      : mainContent.blocks.join('');

    editor = new tiptapModule.Editor({
      extensions: [
        starterKitModule.StarterKit.configure({
          emoji: false,
          heading: {
            levels: [1, 2, 3, 4],
          },
        }),
        TableOfContentsExtension.configure({
          onUpdate: (newHeadings) => {
            headings = newHeadings;
          },
        }),
      ],
      content: content,
      editable: viewMode === 'edit',
      onUpdate: ({ editor }) => {
        if (viewMode === 'edit') {
          mainContentStore.update(mc => {
            const updatedBlocks = [...mc.blocks];
            updatedBlocks[activeBlockIndex] = editor.getHTML();
            return {...mc, blocks: updatedBlocks};
          });
        }
        calculateWordCount();
      },
    });
    
    isEditorReady = true;
    calculateWordCount();
    applyViewMode();
  }

  function handleScroll() {
    // Implement scrolling logic for the editor
    // This is a placeholder and needs to be implemented based on your specific requirements
  }

  function calculateWordCount() {
    const totalWordCount = mainContent.blocks.reduce((count, block) => {
      return count + block.replace(/<[^>]*>/g, '').split(/\s+/).filter(word => word.length > 0).length;
    }, 0);
    mainContentStore.update(mc => ({...mc, wordCount: totalWordCount}));
  }

  function handleReadingStyleChange(event) {
    readingStyle = event.detail;
    console.log('Reading style changed to:', readingStyle);
    // Implement any specific logic for changing reading style for the editor
  }

  async function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
      try {
        mainContentStore.update(mc => ({...mc, content: "Loading document..."}));

        setTimeout(async () => {
          const htmlContent = await documentToMarkup(file);
          
          // Recursively split h1 h2 h3 into outline and blocks
          let blocks = [];
          let cardCount = 0;
          let outline = htmlContent.split("<h1>").slice(1).map((h1) => {
            let h1Title = h1.split("</h")[0].replace(/<[^>]*>/g, '');

            let h2s = h1.split("<h2>").slice(1).map((h2) => {
              //remvoe html tags regex
              let h2Title = h2.split("</h")[0].replace(/<[^>]*>/g, '');

              let h3s = h2.split("<h3>").slice(1).map((block) => {
                let h3Title = block.split("</h")[0].replace(/<[^>]*>/g, '');

                cardCount += block.split("<h4>").length - 1;

                blocks.push("<h3>" + block);

                return {h3Title, h4s: blocks.length-1};
              });
              return {h2Title, h3s};
            });
            return {h1Title, h2s};
          });

          console.log(JSON.stringify(outline));

          // Update mainContent with the parsed DOCX content
          mainContentStore.update(mc => ({...mc, outline, blocks, content: htmlContent}));

          // Create editor for the first block
          await createEditor(await import('svelte-tiptap'), await import('@syfxlin/tiptap-starter-kit'), 0);

          calculateWordCount();
        }, 0);
      } catch (error) {
        console.error('Error parsing DOCX file:', error);
        mainContentStore.update(mc => ({...mc, content: "Error loading document."}));
      }
    }
  }

  
  async function handleCopy() {
    if (editor) {
      const editorContent = editor.getHTML();
      if (browser) {
        try {
          await navigator.clipboard.writeText(editorContent);
          console.log('Content copied to clipboard');
          // Optionally, show a success message to the user
        } catch (err) {
          console.error('Failed to copy text: ', err);
          // Optionally, show an error message to the user
        }
      }
    }
  }

  async function handleViewModeChange(event: CustomEvent) {
    viewMode = event.detail.value.value; //yes

    if (browser && editor) {
      editor.setEditable(viewMode === 'edit');
      
      //show everything if in read modes
      // if (viewMode === 'edit') {
      //   if (activeBlockIndex === null) {
      //     activeBlockIndex = 0;
      //   }
        editor.commands.setContent(mainContent.blocks[activeBlockIndex]);
      // } else {
        // editor.commands.setContent(mainContent.blocks.join(''));
      // }
      
      applyViewMode();
    }
  }

  function applyViewMode() {
    if (editor && editor.view && editor.view.dom) {
      const contentDom = editor.view.dom as HTMLElement;
      contentDom.classList.remove('only-highlighted', 'only-underlined', 'mode-read');

      console.log(viewMode)
      switch (viewMode) {
        case 'edit':
        case 'read':
          contentDom.style.fontSize = '';
          contentDom.classList.add('mode-read');
          break;
        case 'highlighted':
          contentDom.classList.add('only-highlighted');
          break;
        case 'underlined':
          contentDom.classList.add('only-highlighted', 'only-underlined');
          break;
      }
    }
  }

  function triggerFileUpload() {
    fileInput.click();
  }

  async function handleLoadBlock(event) {
  const newBlockIndex = event.detail.blockIndex;
  if (newBlockIndex !== activeBlockIndex) {
    activeBlockIndex = newBlockIndex;
    
    // Update current heading
    if (mainContent.blocks[activeBlockIndex]) {
      currentHeading = mainContent.blocks[activeBlockIndex].split('</h')[0].replace(/<h\d>/g, '');
    }

    // Check if the block is already in recent blocks
    const existingBlockIndex = recentBlocks.findIndex(b => b.blockIndex === newBlockIndex);

    if (existingBlockIndex === -1) {
      // Only if the block is not in recent blocks, add it
      const newRecentBlock = {
        blockIndex: newBlockIndex,
        title: currentHeading,
        level: event.detail.level || 1 // Default to 1 if level is not provided
      };
      recentBlocks = [newRecentBlock, ...recentBlocks].slice(0, MAX_RECENT_BLOCKS);
    }
    // If the block is already in recent blocks, do nothing to the recentBlocks array

    // Update editor content
    editor.commands.setContent(mainContent.blocks[activeBlockIndex]);
  }
}
  function handleRenameHeading(event) {
    const { level, oldText, newText, blocks } = event.detail;
    mainContentStore.update(mc => {
      // Update outline
      const newOutline = updateOutline(mc.outline, level, oldText, newText);

      // Update block content
      const updatedBlocks = [...mc.blocks];
      updatedBlocks[blocks] = updatedBlocks[blocks].replace(
        new RegExp(`<h${level}>${oldText}</h${level}>`),
        `<h${level}>${newText}</h${level}>`
      );

      // Update recent blocks if necessary
      recentBlocks = recentBlocks.map(block => 
        block.blockIndex === blocks ? { ...block, title: newText } : block
      );

      return { ...mc, outline: newOutline, blocks: updatedBlocks };
    });

    // Update editor content if in combined view mode
    if (viewMode !== 'edit') {
      editor.commands.setContent(mainContent.blocks.join(''));
    }
  }

  function updateOutline(outline, level, oldText, newText) {
    // Implementation to update the outline structure
    // This should recursively search and update the correct heading
    // You'll need to implement this based on your specific outline structure
  }
</script>

<svelte:head>
	<title>Multi-Editor</title>
</svelte:head>

<Splitpanes style="height: 100vh;">
  <Pane size={20}>
    <Sidebar 
      {mainContent}
      {currentHeading}
      {headings}
      {editor}
      {handleLoadBlock}
      on:readingStyleChange={handleReadingStyleChange}
      on:renameHeading={handleRenameHeading}
    />
  </Pane>

  <Pane>
    <div class="h-full flex flex-col">
      <TopBar 
        {viewMode}
        {recentBlocks}
        {handleLoadBlock}
        on:copyContent={handleCopy}

        on:viewModeChange={handleViewModeChange}
        on:triggerFileUpload={triggerFileUpload}
      />

      <div class="flex-grow overflow-y-auto p-4" on:scroll={handleScroll}>
        {#if browser && isEditorReady && EditorContent && editor}
          <div class="editor-wrapper">
            <svelte:component this={EditorContent} {editor} />
          </div>
        {:else}
          {@html mainContent.content}
        {/if}
      </div>
    </div>
  </Pane>
</Splitpanes>

<input
  bind:this={fileInput}
  type="file"
  accept=".docx"
  on:change={handleFileUpload}
  style="display: none;"
/>

<style>
  /* Component-specific styles can be added here if needed */
  .editor-wrapper :global(.only-highlighted),
  .editor-wrapper :global(.only-highlighted u strong),
  .editor-wrapper :global(.only-highlighted strong>u) {
    font-size: 1pt !important;
  }

  .editor-wrapper :global(.only-highlighted mark),
  .editor-wrapper :global(.only-highlighted strong),
  
  .editor-wrapper :global(.only-highlighted h1),
  .editor-wrapper :global(.only-highlighted h2),
  
  .editor-wrapper :global(.only-highlighted h3),
  .editor-wrapper :global(.only-highlighted h4) {
    font-size: 14pt !important;
  }

  .editor-wrapper :global(.only-underlined) {
    font-size: 1pt !important;
  }

  .editor-wrapper :global(.only-underlined u) {
    font-size: 14pt !important;
  }


  
  .editor-wrapper :global(.mode-read *:is(strong, u, mark, h1, h2, h3, h4)) 
   {
    font-size: 12pt !important;
  }
  

  .editor-wrapper :global(.mode-read) {
    font-size: 8pt !important;
  }

  .editor-wrapper :global(h1){
    font-size: 16pt !important;
  }

  .editor-wrapper :global(h2){
    font-size: 14pt !important;
  }
  
  .editor-wrapper :global(h3), .editor-wrapper :global(h2), .editor-wrapper :global(h1){
    text-align: center;
  }
</style>