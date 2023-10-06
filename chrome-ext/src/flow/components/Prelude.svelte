<script lang="ts">
	import SavedFlows from './SavedFlows.svelte';
	import { savedFlowsDatas } from '../models/autoSave';

	let showTutorial = false;
	$: savedFlowsExist = Object.keys($savedFlowsDatas).length > 0;
</script>

{#if savedFlowsExist}
	<SavedFlows savedFlowsDatas={$savedFlowsDatas} bind:showTutorial />
{:else}
{/if}
