<script>
	import { createEventDispatcher } from 'svelte';
	import {
		GripVertical,
		Folder,
		FileText,
		FileImage,
		FileAudio,
		FileVideo,
		FolderPlus,
		Upload,
		File,
		Trash2,
		ArrowUpDown,
		ChevronDown,
		ChevronRight,
		Edit2,
	} from "lucide-svelte";
	import { Button } from "$lib/components/ui/button";

	export let item;
	export let fileIcons;
	export let toggleFolder;
	export let handleNewFolder;
	export let handleNewFile;
	export let confirmDelete;
	export let handleRename;
	export let initSortable;
	export let clickFile;

	const dispatch = createEventDispatcher();

	let renaming = false;
	let newName = item.name;
	let isHovering = false;

	function startRename() {
		renaming = true;
		newName = item.name;
	}

	function finishRename() {
		if (newName.trim() !== '' && newName !== item.name) {
			handleRename(item.id, newName);
		}
		renaming = false;
	}

	function handleDragOver(event) {
		if (item.type === 'folder') {
			event.preventDefault();
			isHovering = true;
		}
	}

	function handleDragLeave() {
		isHovering = false;
	}

	function handleDrop(event) {
		event.preventDefault();
		isHovering = false;
		const draggedItemId = event.dataTransfer.getData('text/plain');
		if (draggedItemId !== item.id) {
			dispatch('moveItem', { itemId: draggedItemId, newParentId: item.id });
		}
	}

	function handleToggleFolder() {
		toggleFolder(item);
		item = { ...item, expanded: !item.expanded };
	}

	function handleClickFile() {
		if (item.type === 'folder') {
			handleToggleFolder();
		} else {
			clickFile(item.id);
		}
	}

	$: Icon = fileIcons[item.type] || File;
</script>

<div
	class="flex items-center space-x-2 p-2 bg-white border rounded-md shadow-sm"
	class:bg-blue-100={isHovering}
	data-id={item.id}
	draggable="true"
	on:dragstart={(e) => e.dataTransfer.setData('text/plain', item.id)}
	on:dragover={handleDragOver}
	on:dragleave={handleDragLeave}
	on:drop={handleDrop}
>
	<div class="handle cursor-move">
		<GripVertical class="h-4 w-4 text-gray-400" />
	</div>
	
	{#if item.type === 'folder'}
		<button on:click={handleToggleFolder} class="-none">
			{#if item.expanded}
				<ChevronDown class="h-4 w-4 text-gray-600" />focus:outline
			{:else}
				<ChevronRight class="h-4 w-4 text-gray-600" />
			{/if}
		</button>
	{:else}
		<div class="w-4"></div>
	{/if}
	
	<Icon class="h-4 w-4 text-gray-600" />
	
	{#if renaming}
		<input
			type="text"
			bind:value={newName}
			on:blur={finishRename}
			on:keypress={(e) => e.key === 'Enter' && finishRename()}
			class="flex-grow bg-gray-100 px-2 py-1 rounded"
		/>
	{:else}
		<span class="flex-grow handle cursor-pointer" on:click={handleClickFile}>{item.name}</span>
	{/if}

	{#if item.type === 'folder'}
		<Button variant="ghost" size="icon" on:click={() => handleNewFolder(item.id)}>
			<FolderPlus class="h-4 w-4" />
		</Button>
		<Button variant="ghost" size="icon" on:click={() => handleNewFile(item.id)}>
			<File class="h-4 w-4" />
		</Button>
	{/if}
	
	<Button variant="ghost" size="icon" on:click={startRename}>
		<Edit2 class="h-4 w-4" />
	</Button>
	
	<Button variant="ghost" size="icon" on:click={() => confirmDelete(item)}>
		<Trash2 class="h-4 w-4" />
	</Button>
</div>

{#if item.type === 'folder' && item.expanded}
	<div class="ml-6 mt-2 space-y-2" use:initSortable data-parent-id={item.id}>
		{#each item.children as child (child.id)}
			<svelte:self
				item={child}
				{fileIcons}
				{toggleFolder}
				{handleNewFolder}
				{handleNewFile}
				{confirmDelete}
				{handleRename}
				{initSortable}
				{clickFile}
				on:moveItem
			/>
		{/each}
	</div>
{/if}