<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { X } from "lucide-svelte";
	import { fade } from 'svelte/transition';
	import { popupIn, popupOut } from './models/transition.js';
  
	export let component: any;
	export let props: any = {};
	export let title: string;
	export let closeSelf: () => void;
  
	function handleKeydown(e: KeyboardEvent) {
	  if (e.key === 'Escape') {
		closeSelf();
	  }
	}
  
	function handleOutsideClick(e: MouseEvent) {
	  if (e.target === e.currentTarget) {
		closeSelf();
	  }
	}
  </script>
  
  <svelte:window on:keydown={handleKeydown} />
  
  <div 
	class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
	in:fade={{duration: 200}}
	out:fade={{duration: 200}}
	on:click={handleOutsideClick}
  >
	<div 
	  class="bg-background  bg-white rounded-lg shadow-lg overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col"
	  in:popupIn|global
	  out:popupOut|global
	>
	  <div class="flex justify-between items-center p-4 border-b">
		<h2 class="text-xl font-semibold">{title}</h2>
		<Button 
		  variant="ghost" 
		  size="icon"
		  on:click={closeSelf}
		  class="text-gray-500 hover:text-gray-700"
		>
		  <X class="h-4 w-4" />
		  <span class="sr-only">Close</span>
		</Button>
	  </div>
	  <div class="flex-1 overflow-auto">
		<svelte:component this={component} closePopup={closeSelf} {...props} />
	  </div>
	</div>
  </div>