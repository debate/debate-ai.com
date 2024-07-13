<script lang="ts">
	import type { TimeState, TimerSpeech } from './models/timer';
	import { onMount, tick } from 'svelte';
	import Button from './Button.svelte';
	import Timer from './Timer.svelte';

	export let resetTimeIndex: number;
	export let speeches: TimerSpeech[];
	export let launchFireworks: () => void;
	export let time: number = speeches[resetTimeIndex].time;
	export let state: TimeState;

	let selectedButton: HTMLButtonElement;
	let speechesContainer: HTMLDivElement;

	let selectedButtonInit = false;
	function selectedButtonUpdate() {
		if (selectedButton && speechesContainer) {
			if (selectedButtonInit) {
				const containerRect = speechesContainer.getBoundingClientRect();
				const buttonRect = selectedButton.getBoundingClientRect();
				
				if (buttonRect.left < containerRect.left || buttonRect.right > containerRect.right) {
					speechesContainer.scrollTo({
						left: selectedButton.offsetLeft - containerRect.width / 2 + buttonRect.width / 2,
						behavior: 'smooth'
					});
				}
			}
			selectedButtonInit = true;
		}
	}

	onMount(() => {
		setTimeout(() => {
			if (selectedButton && speechesContainer) {
				const containerRect = speechesContainer.getBoundingClientRect();
				const buttonRect = selectedButton.getBoundingClientRect();
				
				speechesContainer.scrollTo({
					left: selectedButton.offsetLeft - containerRect.width / 2 + buttonRect.width / 2,
					behavior: 'instant'
				});
			}
		}, 50);
	});

	let resetTimeIndexInit = false;
	async function resetTimeIndexUpdate() {
		if (resetTimeIndexInit) {
			await tick();
			pause();
			reset();
		}
		resetTimeIndexInit = true;
	}

	$: selectedButton, selectedButtonUpdate();
	$: resetTimeIndex, resetTimeIndexUpdate();

	let pause: () => void;
	let reset: () => void;

	function handleButtonRef(element: HTMLButtonElement, index: number) {
		if (index === resetTimeIndex) {
			selectedButton = element;
		}
	}
</script>

<div class="top">
	<div class="timer">
		<Timer
			palette='accent'
			bind:state
			bind:time
			bind:pause
			bind:reset
			resetTime={speeches[resetTimeIndex].time}
			{launchFireworks}
		/>
	</div>
	{#if speeches.length > 1}
		<div class="over">
			<div class="speechesScroll" bind:this={speechesContainer}>
				<div class="speeches">
					{#each speeches as speech, index}
						<button
							class={`speech ${index === resetTimeIndex ? 'selected' : ''}`}
							use:handleButtonRef={index}
							on:click={() => {
								resetTimeIndex = index;
							}}
						>
							{speech.name}
						</button>
					{/each}
				</div>
			</div>

			<Button
				icon={resetTimeIndex == speeches.length - 1 ? 'arrowLeft' : 'arrowRight'}
				on:click={() => {
					resetTimeIndex += 1;
					resetTimeIndex %= speeches.length;
				}}
			/>
		</div>
	{/if}
</div>


<style>
	div.top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-direction: column;
		width: 100%;
		gap: var(--padding);
	}
	div.over {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-direction: row;
		width: 100%;
	}
	div.timer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-direction: row;
		width: 100%;
	}

	div.speechesScroll {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-direction: row;
		width: 100%;
		overflow-x: scroll;
	}

	/* Hide scrollbar for Chrome, Safari and Opera */
	.speechesScroll::-webkit-scrollbar {
		display: none;
	}
	/* Hide scrollbar for IE, Edge and Firefox */
	.speechesScroll {
		-ms-overflow-style: none; /* IE and Edge */
		scrollbar-width: none; /* Firefox */
	}

	div.speeches {
		font-size: 0.75em;
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-direction: row;
		width: 100%;
	}

	button.speech {
		border: none;
		background: none;
		display: block;
		width: 100%;
		text-align: left;
		border-radius: var(--border-radius);
		color: var(--this-text);
		padding: var(--padding);
		overflow-wrap: break-word;
		transition: background var(--transition-speed), transform var(--transition-speed) ease;
		font-weight: var(--font-weight);
	}

	button:hover {
		background-color: var(--this-background-indent);
	}
	button:active {
		transition: none;
		background-color: var(--this-background-active);
	}
	button.selected {
		background-color: var(--this-background-active);
	}

</style>