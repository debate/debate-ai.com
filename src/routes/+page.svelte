<script>
  import { onMount } from 'svelte';
  import TextEditor from "$lib/components/Editor/Editor.svelte";
  import FileSystem from "$lib/components/FileSystem/FileSystem.svelte";
  import Flow from "$lib/components/Flow/Main.svelte";


  import {
    Home,
    BookOpen,
    Search,
    User,
    Settings,
    FileText,
    BarChart,
    Code,
    Folders
  } from "lucide-svelte";

  let currentView = 'documents';
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
    content: 
  "<h1>Main</h1><h2>Subtitle</h2><p>This outline will provide you with a clear structure and guide you through the various sections and chapters.</p><h2>Intro</h2><p>Welcome to our comprehensive document outlining the key topics and insights covered in this project. This outline will provide you with a clear structure and guide you through the various sections and chapters.</p><p><u><mark>Assembly Bill 168</mark>, now in effect</u>, <u>adds</u> new <u><mark>require</mark>ments to</u> the <u><mark>streamlined</u></mark> ministerial <u><mark>approval</mark> process <mark>for</u></mark> multi-family <u><mark>housing</u></mark> mandated in Senate Bill 35, which passed in 2017. <u>AB 168 requires developers to submit a notice of intent to local agencies via a preliminary application before they may be able to proceed</u> under SB 35. Next, <u>AB 168 requires <mark>local agencies</mark> receiving preliminary applications to <b><mark>invite California Native American Tribes to consult</b></mark> with them <b><mark>regarding</b></mark> a <b><mark>proposed development’s potential effects</b> on</mark> any <mark>tribal</mark> cultural <mark>resources</u></mark>. Significantly, AB 168 provides that this tribal consultation process is not subject to the California Environmental Quality Act.  Specifically, <u><mark>within 30</mark> calendar <mark>days</mark> of receiving a preliminary application, a local agency must provide notice to those California Native American Tribes that are “traditionally and culturally affiliated with the geographic area” of the proposed development</u>. AB 168 provides that the local agency may “contact the Native American Heritage Commission for assistance in identifying any California Native American Tribe.” <u>Tribes receiving this notice have 30 calendar days to accept the invitation to engage in consultation</u>.  After acceptance, a local agency must initiate consultation with each requesting tribe within 30 calendar days. The developer may attend the consultation(s) if they agree to respect the principles of AB 168 and if the consulting tribe approves the developer’s participation. However, <u><mark>a</mark> consulting <mark>tribe may <b>revoke this approval at any time</b> during the consultation</mark> process</u>.  After consultation, a developer may submit an SB 35 ministerial application to a local agency only if  No noticed Tribe seeks, or fails to engage in, consultation, No potential tribal cultural resource impact is identified or If a potential tribal cultural resource impact is identified and the parties expressly agree to protect the resource. <u>A developer may not submit an SB 35 ministerial application if the proposed development site contains a tribal cultural resource</u> that is listed on a national, tribal, state or local historic register <u>and the parties to the consultation do not agree on whether the development will impact these resources, or a potential tribal cultural resource would be affected by the proposed developmentand</u> the <u>parties</u> to the consultation <u>are unable to document an enforceable agreement</u> regarding their treatment. </p>W"
  }
    

  const navItems = [
    { id: 'home', icon: Home },
    { id: 'reader', icon: BookOpen },
    { id: 'documents', icon: Folders },
    { id: 'search', icon: Search },
    { id: 'flow', icon: Code },
    { id: 'user', icon: User },
    { id: 'settings', icon: Settings },
  ];

  function handleNavClick(id) {
    currentView = id;
    history.pushState(null, '', `/#${id}`);
  }

  onMount(() => {
    const path = window.location.pathname.slice(1) || 'home';
    currentView = path;
  });
</script>

<div class="flex h-[100dvh] w-full">
  <!-- Sidebar Navbar -->
  <div
    class="bg-[#DED8C4] text-gray-700 min-w-16 flex flex-col items-center py-4 space-y-8"
  >
    {#each navItems as item}
      <button
        on:click={() => handleNavClick(item.id)}
        class="hover:text-blue-400 transition-colors duration-200 {currentView === item.id ? 'text-blue-600' : ''}"
      >
        <svelte:component this={item.icon} size={24} />
      </button>
    {/each}
  </div>

  <!-- Main Content Area -->
  <div class="flex-1">
    {#if currentView === 'documents'}
      <FileSystem {items} />
    {:else if currentView === 'reader'}
      <TextEditor {mainContent} />
      
    {:else if currentView === 'flow'}
        <Flow />

    {:else}
      <div class="p-4">
        <h1 class="text-2xl font-bold">{currentView.charAt(0).toUpperCase() + currentView.slice(1)}</h1>
        <p>This is the {currentView} view.</p>
      </div>
    {/if}
  </div>
</div>
