<script lang="ts">
	import type { TimeState } from './models/timer';
	import Button from './Button.svelte';
	import Time from './Time.svelte';

	export let resetTime: number;

	export let launchFireworks: () => void;

	export let time: number = resetTime;
	export let state: TimeState;
	let startTime: () => void;
	let pauseTime: () => void;
	let setTime: (time: number) => void;

	export function start() {
		startTime();
	}

	export function pause() {
		pauseTime();
	}

	export function reset() {
		setTime(resetTime);
	}

	export let palette: string = 'plain';
</script>

<div class="top palette-{palette}">
	<div class="{palette === 'accent' ? '' : 'button-wrapper'}">
		{#if state?.name == 'running'}
			<Button icon="pause" on:click={pause} preventBlur={false} />
		{:else}
			<Button icon="play" on:click={start} preventBlur={false} />
		{/if}
	</div>
	<div class="time-wrapper {palette === 'accent' ? 'scale-up' : ''}">
		<Time bind:start={startTime} {launchFireworks} bind:pause={pauseTime} bind:set={setTime} bind:state bind:time />
	</div>
	<div class="{palette === 'accent' ? '' : 'button-wrapper'}">
		<Button
			icon="arrowRoundLeft"
			on:click={() => reset()}
			disabled={time == resetTime}
			preventBlur={false}
		/>
	</div>
</div>


<style>
.top {
	display: flex;
	justify-content: space-between;
	align-items: center;
	flex-direction: row;
	width: 100%;
}

.button-wrapper {
	flex: 0 0 auto;
	transform: scale(0.7);

}

.time-wrapper.scale-up {
	transform: scale(1.8);

	@media (max-width: 500px) {
		transform: scale(1.5);
	}
	margin-left: 20px;
	margin-right: 20px;
	z-index: 0	;
}
</style>
