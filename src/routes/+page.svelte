<script>
  import { onMount } from 'svelte';
  import TextEditor from "$lib/components/Editor/Editor.svelte";
  import FileSystem from "$lib/components/FileSystem/FileSystem.svelte";
  import Flow from "$lib/components/Flow/Main.svelte";
  import Canvas from "$lib/components/Canvas/Main.svelte";
  import Videos from "$lib/components/Videos/Videos.svelte";
  import Home from "$lib/components/Home/Home.svelte";
  import {
    BookOpen,
    Search,
    User,
    Settings,
    FileText,
    BarChart,
    Code,
    Folders,
    VideoIcon
  } from "lucide-svelte";

  let currentView = 'home';
  let fileNameId = null;

  let items = [
    {
      id: "1",
      name: "Documents",
      type: "folder",
      parentId: null,
      expanded: false,
    },
    { id: "2", name: "report.docx", type: "text", parentId: "1" },
    {
      id: "3",
      name: "Subfolder",
      type: "folder",
      parentId: "1",
      expanded: false,
    },
    { id: "4", name: "photo.jpg", type: "image", parentId: "3" },
    { id: "5", name: "song.mp3", type: "audio", parentId: null },
    {
      id: "6",
      name: "Projects",
      type: "folder",
      parentId: null,
      expanded: false,
    },
    { id: "7", name: "movie.mp4", type: "video", parentId: "6" },
  ];

  const mainContent = {
    title: "Example Title",
    content: "Example content",
  }
   
  const navItems = [
    { id: 'home', icon: "/assets/icon-logo.svg", name: 'Home' },
    { id: 'videos', icon: '/assets/icon-youtube.svg', name: 'Watch'  },
    { id: 'editor', icon: '/assets/icon-read.svg', name: 'Read' },
    { id: 'documents', icon: '/assets/icon-graph.svg', name: 'Organize' },
    { id: 'search', icon: '/assets/icon-search.svg', name: 'Search' },
    { id: 'flow', icon: '/assets/icon-flow.svg', name: 'Flow' },
    { id: 'user', icon: '/assets/icon-chat.svg', name: 'Chat' },
    { id: 'settings', icon: '/assets/icon-configure.svg', name: 'Configure'  },
  ];

  function handleNavClick(id) {
    currentView = id;
    fileNameId = null;
    updateURL();
  }

  function updateURL() {
    const url = fileNameId ? `/#${currentView}/${fileNameId}` : `/#${currentView}`;
    history.pushState(null, '', url);
  }

  function parseURL() {
    const hash = window.location.hash.slice(1); // Remove the '#'
    const [view, id] = hash.split('/');
    currentView = view || 'home';
    fileNameId = id || null;
  }

  onMount(() => {
    parseURL();
    window.addEventListener('popstate', parseURL);

    return () => {
      window.removeEventListener('popstate', parseURL);
    };
  });
</script>

<div class="flex h-[100dvh] w-full overflow-hidden">
  <!-- Sidebar Navbar -->
  <div
    class="bg-[#DED8C4] w-[75px] max-w-[75px] min-w-[75px] flex flex-col items-center py-4 space-y-4 rounded-tr-[15px] rounded-br-[15px] h-full overflow-y-auto"
  >
    {#each navItems as item}
    <button
      on:click={() => handleNavClick(item.id)}
      class="flex flex-col items-center justify-center w-full transition-colors duration-200"
    >
        <img
          src={item.icon}
          alt="Home"
          class="w-8 h-8 mb-2 transition-opacity duration-200 {currentView === item.id ? 'opacity-100' : 'opacity-60 hover:opacity-100'}"
        />
      <span class="text-xs text-center transition-colors duration-200 {currentView === item.id ? 'text-[#D2691E] font-semibold' : 'text-gray-700 hover:text-[#D2691E]'}">
        {item.name}
      </span>
    </button>
    {/each}
  </div>
  <!-- Main Content Area -->
  <div class="flex-1 overflow-y-auto">
    {#if currentView === 'home'}
    <Home />
    {:else if currentView === 'documents'}
      <FileSystem {items} />
    {:else if currentView === 'editor'}
      <TextEditor {mainContent} {fileNameId} />
    {:else if currentView === 'flow'}
      <Flow />
    {:else if currentView === 'search'}
      <Canvas />
    {:else if currentView === 'videos'}
      <Videos />
    {:else}
      <div class="p-4">
        <h1 class="text-2xl font-bold">{currentView.charAt(0).toUpperCase() + currentView.slice(1)}</h1>
        <p>This is the {currentView} view.</p>
      </div>
    {/if}
  </div>
</div>