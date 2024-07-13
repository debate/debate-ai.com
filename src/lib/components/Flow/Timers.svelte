<script lang="ts">
	import Timer from './Timer.svelte';
	import SpeechTimer from './SpeechTimer.svelte';
	import type { TimerState, SpeechTimerState, TimerSpeech } from './models/timer';
	import { timer } from './models/transition';
	import { settings } from './models/settings';
	import { onDestroy, tick } from 'svelte';
	import { debateStyles, debateStyleMap, type DebateStyle } from './models/debateStyle';
	
	export let launchFireworks: () => void;
  

	let states: {
		prep?: TimerState;
		prepSecondary?: TimerState;
		speech: SpeechTimerState;
	};

	let showTimers = false;

	let update = false;

	let debateStyleIndex = settings.data['debateStyle'].value as number;
	let debateStyle: DebateStyle = debateStyles[debateStyleMap[debateStyleIndex]];
	onDestroy(
		settings.subscribe(['debateStyle'], (key: string) => {
			let newDebateStyleIndex = settings.data[key].value as number;
			if (newDebateStyleIndex === debateStyleIndex) return;
			debateStyleIndex = newDebateStyleIndex;
			debateStyle = debateStyles[debateStyleMap[debateStyleIndex]];
			resetStates();
			update = !update;
		})
	);

	function resetStates() {
		let newStates: typeof states = {
			speech: {
				resetTimeIndex: 0,
				time: debateStyle?.timerSpeeches[0].time,
				state: { name: 'paused' }
			}
		};
		if (debateStyle?.prepTime != null) {
			newStates.prep = {
				resetTime: debateStyle.prepTime,
				time: debateStyle.prepTime,
				state: { name: 'paused' }
			};
			newStates.prepSecondary = {
				resetTime: debateStyle.prepTime,
				time: debateStyle.prepTime,
				state: { name: 'paused' }
			};
		}
		states = newStates;
	}

	resetStates();
</script>

<div class="top">

	{#key update}
		<div class="timer" transition:timer>

			
			<div class="speech-timer-container">
				<SpeechTimer
					speeches={debateStyle.timerSpeeches}
					bind:resetTimeIndex={states.speech.resetTimeIndex}
					bind:time={states.speech.time}
					bind:state={states.speech.state}
					{launchFireworks}
				/>
			</div>

			{#if states.prep}
				<Timer
					resetTime={states.prep.resetTime}
					bind:time={states.prep.time}
					bind:state={states.prep.state}
					palette={'accent-secondary'}
				/>
			{/if}
			{#if states.prepSecondary}
				<Timer
					resetTime={states.prepSecondary.resetTime}
					bind:time={states.prepSecondary.time}
					bind:state={states.prepSecondary.state}
					palette={'accent-secondary'}
				/>
			{/if}
		</div>
	{/key}

</div>

<style>
	div.top {
		display: flex;
		flex-direction: column;
		gap: var(--padding);
	}
	.timer {
		display: flex;
		flex-direction: column;
		gap: var(--padding);
		width: 100%;
		height: auto;
	}
	.speech-timer-container {
		display: flex;
		justify-content: center;
		width: 100%;
	}
</style>