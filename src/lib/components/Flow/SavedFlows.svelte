<script lang="ts">
	import { MAX_SAVED_FLOWS, type SavedFlowsDatas } from './models/autoSave';
	import SavedFlow from './SavedFlow.svelte';
	import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";

	export let savedFlowsDatas: SavedFlowsDatas;

	$: sortedSavedFlowsDatas = Object.entries(savedFlowsDatas).sort(
		(a, b) => new Date(b[1].modified).getTime() - new Date(a[1].modified).getTime()
	);
</script>

<div class="w-full h-full pr-10">
	<Card class="w-full h-full">
		<CardHeader>
			<CardTitle>Saved Flows</CardTitle>
			<p class="text-sm text-muted-foreground">
			</p>
		</CardHeader>
		<CardContent>
			<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 overflow-y-auto pb-[50vh] pr-[20%]">
				{#each sortedSavedFlowsDatas as [key, flowData] (key)}
					<SavedFlow {flowData} {key} />
				{/each}
			</div>
		</CardContent>
	</Card>
</div>

<style>
	:global(.card-content) {
		height: calc(100% - var(--card-header-height));
		overflow-y: auto;
	}
</style>