<script lang="ts">
    import { PlayCircle, Youtube, Github, Image, Info, Eye, Copy, Bookmark, Share2 } from 'lucide-svelte';
    
    export let item;
  
    const iconMap = {
      'play-circle': PlayCircle,
      'youtube': Youtube,
      'github': Github,
      'image': Image
    };
  
    const IconComponent = iconMap[item.icon] || Info;
  </script>
  
  <div class="bg-white rounded-lg shadow-md overflow-hidden">
    <img src={item.image} alt={item.title} class="w-full h-40 object-cover" />
    <div class="p-4">
      <h3 class="text-lg font-semibold mb-2">{item.title}</h3>
      <p class="text-sm text-gray-600 mb-4">{item.type}</p>
      <div class="flex justify-between items-center">
        <div class="flex space-x-2">
          <button class="p-1 hover:bg-gray-100 rounded"><Eye class="w-4 h-4" /></button>
          <button class="p-1 hover:bg-gray-100 rounded"><Copy class="w-4 h-4" /></button>
          <button class="p-1 hover:bg-gray-100 rounded"><Bookmark class="w-4 h-4" /></button>
          <button class="p-1 hover:bg-gray-100 rounded"><Share2 class="w-4 h-4" /></button>
        </div>
        <svelte:component this={IconComponent} class="w-6 h-6 text-gray-400" />
      </div>
    </div>
  </div>