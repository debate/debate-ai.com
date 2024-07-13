<script lang="ts">
	import { Card } from "$lib/components/ui/card";
	import { Button } from "$lib/components/ui/button";
	import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "$lib/components/ui/dropdown-menu";
	import { MoreHorizontal, Upload, Copy, Download, Trash, Clock } from "lucide-svelte";
	import {
		deleteFlows,
		loadSavedFlows,
		type SavedFlowsData,
		downloadSavedFlows
	} from './models/autoSave';

	export let closePopup: () => void;

	function prettyDate(date: string) {
		const today = new Date();
		const dateObj = new Date(date);
		if (
			today.getDate() === dateObj.getDate() &&
			today.getMonth() === dateObj.getMonth() &&
			today.getFullYear() === dateObj.getFullYear()
		) {
			return dateObj.toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: 'numeric',
				hour12: true
			});
		} else {
			return dateObj.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
		}
	}
	export let flowData: SavedFlowsData;
	export let key: string;

	let dropdownOpen = false;

	function openFlow() {
		loadSavedFlows(key, true)
		if(closePopup)
		closePopup(); 
		}
</script>

<Card class="w-full max-w-[250px] p-3">
	<div class="flex flex-col space-y-2">
		<div class="flex items-center justify-between">
			<div class="flex items-center space-x-2 truncate">
				<Clock class="w-3 h-3 flex-shrink-0 text-muted-foreground" />
				<h3 class="text-xs font-medium leading-none truncate">{flowData.flowInfos[0]?.content || 'Flow'}</h3>
			</div>
			<div class="relative">
				<DropdownMenu bind:open={dropdownOpen}>
					<DropdownMenuTrigger asChild let:builder>
						<Button variant="ghost" size="icon" class="h-6 w-6" builders={[builder]}>
							<MoreHorizontal class="w-3 h-3" />
						</Button>
					</DropdownMenuTrigger>
					<div class="absolute right-0 mt-2 w-48 dropdown-content">
						<DropdownMenuContent>
							<DropdownMenuItem on:click={() => loadSavedFlows(key, false)}>
								<Copy class="w-3 h-3 mr-2" />
								<span class="text-xs">Open Copy</span>
							</DropdownMenuItem>
							<DropdownMenuItem on:click={() => downloadSavedFlows(key)}>
								<Download class="w-3 h-3 mr-2" />
								<span class="text-xs">Download</span>
							</DropdownMenuItem>
							<DropdownMenuItem on:click={() => deleteFlows(key)}>
								<Trash class="w-3 h-3 mr-2" />
								<span class="text-xs">Delete</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</div>
				</DropdownMenu>
			</div>
		</div>
		<div class="text-[10px] text-muted-foreground space-y-0.5">
			{#each flowData.flowInfos.slice(1, 3) as info}
				<p class="truncate">{info.content}</p>
			{/each}
		</div>
		<div class="flex items-center justify-between text-[10px] text-muted-foreground">
			<span class="truncate">Modified: {prettyDate(flowData.modified)}</span>
		</div>
		<Button variant="outline" size="sm" class="w-full text-xs py-1" on:click={openFlow}>
			<Upload class="w-3 h-3 mr-1" />
			Open
		</Button>
	</div>
</Card>

<style>
	:global(.bg-white) {
		background-color: white !important;
	}
</style>