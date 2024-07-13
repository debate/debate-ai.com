<script lang="ts">
	import { MAX_SAVED_FLOWS, type SavedFlowsDatas } from './models/autoSave';
	import SavedFlow from './SavedFlow.svelte';
	import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
	import { savedFlowsDatas } from './models/autoSave';
	import { Database } from 'lucide-svelte';

	export let closePopup: () => void;

	$: sortedSavedFlowsDatas = Object.entries($savedFlowsDatas).sort(
		(a, b) => new Date(b[1].modified).getTime() - new Date(a[1].modified).getTime()
	)

	function handleBackgroundClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closePopup();
		}
	}
</script>

<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" on:click={handleBackgroundClick}>
	<div class="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
		<Card class="w-full h-full">
			<CardHeader class="flex flex-row items-center">
				<Database size={24} class="mr-4" /> 
				<CardTitle>Saved Flows</CardTitle>
				<button on:click={closePopup} class="ml-auto text-gray-500 hover:text-gray-700">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</CardHeader>
			<CardContent>
				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 overflow-y-auto max-h-[calc(90vh-120px)]">
					{#each sortedSavedFlowsDatas as [key, flowData] (key)}
						<SavedFlow {closePopup} {flowData} {key} />
					{/each}
				</div>
			</CardContent>
		</Card>
	</div>
</div>

<style>
	/* Ensure the popup and its contents are on top of other elements */
	:global(.saved-flows-popup) {
		z-index: 10;
	}
	:global(.saved-flows-popup .dropdown-content) {
		z-index: 10000;
	}
</style>