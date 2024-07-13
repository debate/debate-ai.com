<script lang="ts">
  import { onMount } from 'svelte';
  import { Home, BookOpen, Search, User, Settings, 
    FileText, BarChart, Share2, MessageSquare, Edit, Save, Download } from 'lucide-svelte';
  import { browser } from '$app/environment';
  import type { Editor } from '@tiptap/core';
  import { Pane, Splitpanes } from 'svelte-splitpanes';
  import { TableOfContentsExtension } from './TableOfContents.js';
  import SidebarToC from './TableOfContents.svelte';
  import {seedMockExample} from '$lib/api/seed-test-data.js';

  let editor: Editor;
  let EditorContent: any;
  let BubbleMenu: any;
  let isEditorReady = false;
  let isEditMode = true;
  let headings = [];

  export let mainContent = {
    title: "Title",
    content : "",
    wordCount: 0
  };


  
  // sample keywords, outline, and citations
  let topKeywords = ['document', 'outline', 'structure', 'chapters', 'project'];
  
  onMount(async () => {

    //load mock data
    seedMockExample();



    //load TipTap editor
    if (browser) {
      const tiptapModule = await import('svelte-tiptap');
      const starterKitModule = await import('@syfxlin/tiptap-starter-kit');
      
      EditorContent = tiptapModule.EditorContent;
      BubbleMenu = tiptapModule.BubbleMenu;
      
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
        content: mainContent.content,
        editable: isEditMode,
        onUpdate: ({ editor }) => {
          mainContent.content = editor.getHTML();
          calculateWordCount();
        },
      });
      
      isEditorReady = true;
      calculateWordCount();
    }
  });
  
  function calculateWordCount() {
    mainContent.wordCount = mainContent.content.replace(/<[^>]*>/g, '').split(/\s+/).filter(word => word.length > 0).length;
  }
  
  function toggleEditMode() {
    isEditMode = !isEditMode;
    if (browser && editor) {
      editor.setEditable(isEditMode);
    }
  }
  
  function shareWithPublic() {
    console.log('Sharing with public...');
  }
  
  function askAIQuestion() {
    console.log('Asking AI a question...');
  }
  
  function TreeNode({ node }) {
    return `
      <div class="bg-white p-2 rounded shadow">
        ${node.name}
        ${node.children ? `
          <ul class="list-disc pl-4 mt-2">
            ${node.children.map(child => `<li>${child.name}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `;
  }
  function addHeadingAttributes(view) {
    if (!view || !view.state || !view.state.doc) return;

    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const dom = view.nodeDOM(pos);
        if (dom) {
          dom.setAttribute('data-pos', pos);
        }
      }
    });
  }

  $: if (editor && editor.view) {
    editor.on('update', ({ editor }) => {
      addHeadingAttributes(editor.view);
    });
  }
</script>

<svelte:head>
	<title>Editor</title>
	
</svelte:head>

<Splitpanes style="height: 100vh;">
  <!-- Document Outline Sidebar -->
  <Pane size={20}>
    <div class="bg-[#F3F3EE] h-full p-6 flex flex-col">
      <div class="space-y-4 overflow-y-auto flex-grow">
        <!-- Sidebar content -->
        <div class="sticky top-0 bg-[#F3F3EE] pt-2 z-10">
          <div class="relative">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
            <input
              class="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-8 pr-8 w-full"
              type="search"
              placeholder="Search..."
            />
          </div>
        </div>
        
        <h3 class="text-2xl font-semibold leading-none tracking-tight text-gray-900">
          {mainContent.title}
        </h3>
        
        <div class="text-sm text-gray-500">Word count: {mainContent.wordCount}</div>

        <div class="flex flex-wrap gap-2">
          <button on:click={toggleEditMode} class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 rounded-md bg-gray-200">
            <Edit class="h-4 w-4 mr-2" />
            {isEditMode ? 'Reader Mode' : 'Edit Mode'}
          </button>
          <button on:click={shareWithPublic} class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 rounded-md bg-gray-200">
            <Share2 class="h-4 w-4 mr-2" />
            Share
          </button>
          <button on:click={askAIQuestion} class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 rounded-md bg-gray-200">
            <MessageSquare class="h-4 w-4 mr-2" />
            Ask AI
          </button>
          <button class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 rounded-md bg-gray-200">
            <Save class="h-4 w-4 mr-2" />
            Save
          </button>
          <button class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 rounded-md bg-gray-200">
            <Download class="h-4 w-4 mr-2" />
            Export
          </button>
        </div>

        <!-- Top Keywords -->
        <div class="space-y-2">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400">Top Keywords</h3>
          <div class="flex flex-wrap gap-2">
            {#each topKeywords as keyword}
              <span class="bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                {keyword}
              </span>
            {/each}
          </div>
        </div>

        <!-- Outline -->
        <div class="space-y-2">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400">Outline</h3>
          <div class="space-y-2">
            <SidebarToC {headings} {editor}/>
          </div>
        </div>

        <!-- Sample Info -->
        <div class="space-y-2">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400">Document Info</h3>
          <p class="text-sm text-gray-600">Last edited: July 10, 2024</p>
          <p class="text-sm text-gray-600">Contributors: 3</p>
          <p class="text-sm text-gray-600">Version: 1.2.0</p>
        </div>
      </div>
    </div>
  </Pane>

  <!-- Editor Content -->
  <Pane>
    <div class="h-full flex flex-col">
      <div class="flex-grow overflow-y-auto p-4">
        <div class="editor-wrapper">
          {#if browser && isEditorReady && EditorContent}
            <svelte:component this={EditorContent} {editor} />
          {:else}
            {@html mainContent.content}
          {/if}
        </div>
      </div>
    </div>
  </Pane>
</Splitpanes>

<style>
.editor-wrapper {
  background-color: white;
  color: black;
  padding: 1rem;
  border-radius: 0.375rem;
  border: 1px solid #e2e8f0;
  min-height: 200px;
}

:global(.ProseMirror) {
  outline: none;
}

:global(.ProseMirror p) {
  margin: 0.5em 0;
}

button.active {
  background-color: #e2e8f0;
}

/* Styles for Splitpanes */
:global(.splitpanes) {
  background-color: #f0f0f0;
}

:global(.splitpanes__pane) {
  background-color: #ffffff;
}

:global(.splitpanes__splitter) {
  background-color: #ccc;
  position: relative;
}

:global(.splitpanes__splitter:before) {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  transition: opacity 0.4s;
  background-color: #5488c7;
  opacity: 0;
  z-index: 1;
}

:global(.splitpanes__splitter:hover:before) {
  opacity: 1;
}

:global(.splitpanes--vertical > .splitpanes__splitter:before) {
  left: -3px;
  right: -3px;
  height: 100%;
}

:global(.splitpanes--horizontal > .splitpanes__splitter:before) {
  top: -3px;
  bottom: -3px;
  width: 100%;
}
</style>