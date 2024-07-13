<script lang="ts">
  /**
   * Debate Flow - timer with presets, debate formats, color themes,
   * nested tree spacing, colors, manage past flows,
   * sidebar with tabs, and buttons to add boxes and format
   * 
   * Based on a fork of debate-flow by Ashwagandhae GPL-3.0
   * https://github.com/Ashwagandhae/debate-flow/
  */
	import "./main.css"

	import { settings } from './models/settings';
	import { popups, closePopup, openPopup } from './models/popup';
	import Popup from './Popup.svelte';
	import { screenTransition } from './models/transition';
	import { onDestroy, onMount } from 'svelte';
	import { appMinimized } from './models/store';
	import { maybeStartSharing, stopSharing, unminimizeApp } from './models/sharing';
	import Button from './Button.svelte';
	
	import MainFlow from './MainFlow.svelte';

	onMount(() => {
		// maybeStartSharing(() => {
		// 	openPopup(Share, 'Sharing');
		// });
	});
	onDestroy(stopSharing);


	const colorThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	if (colorThemeMediaQuery.matches) {
		document.body.classList.add('dark');
	}
	settings.init();
	function updateColorTheme() {
		if (settings.data.colorTheme.value == 0) {
			document.body.classList.toggle('dark', colorThemeMediaQuery.matches);
		}
	}
	// listen for changes in system settings
	colorThemeMediaQuery.addEventListener('change', updateColorTheme);
	// listen for changes in color theme setting, and unsubscribe onDestroy
	onDestroy(
		settings.subscribe(['colorTheme'], function () {
			if (settings.data.colorTheme.value == 1) {
				document.body.classList.remove('dark');
			} else if (settings.data.colorTheme.value == 2) {
				document.body.classList.add('dark');
			} else {
				updateColorTheme();
			}
		})
	);
	// listen for changes in cssVariables setting group, and unsubscribe onDestroy
	const cssVarIndex: { [key: string]: { name: string; unit: string } } = {
		accentHue: {
			name: 'accent-hue',
			unit: ''
		},
		accentSecondaryHue: {
			name: 'accent-secondary-hue',
			unit: ''
		},
		transitionSpeed: {
			name: 'transition-speed',
			unit: 'ms'
		},
		columnWidth: {
			name: 'column-width',
			unit: 'px'
		},
		borderRadius: {
			name: 'border-radius',
			unit: 'px'
		},
		padding: {
			name: 'padding',
			unit: 'px'
		},
		fontSize: {
			name: 'font-size',
			unit: 'rem'
		},
		fontWeight: {
			name: 'font-weight',
			unit: ''
		},
		fontWeightBold: {
			name: 'font-weight-bold',
			unit: ''
		},
		gap: {
			name: 'gap',
			unit: 'px'
		},
		buttonSize: {
			name: 'button-size',
			unit: 'px'
		},
		lineWidth: {
			name: 'line-width',
			unit: 'px'
		},
		sidebarWidth: {
			name: 'sidebar-width',
			unit: 'px'
		}
	};
	onDestroy(
		settings.subscribe(['fontFamily'], function (key: string) {
			const setting = settings.data.fontFamily;
			if (setting.type != 'radio') return;
			const index = setting.value;
			let chosenFont: string | undefined = undefined;
			if (setting.detail.customOption && setting.detail.options.length == index) {
				chosenFont = setting.detail.customOptionValue;
			} else if (setting.detail.options[index]) {
				chosenFont = setting.detail.options[index];
			}
			if (chosenFont) {
				document.body.style.setProperty(
					'--font-family',
					`'${chosenFont}', 'Merriweather Sans', sans-serif`
				);
			} else {
				document.body.style.setProperty('--font-family', `'Merriweather Sans', sans-serif`);
			}
		})
	);
	onDestroy(
		settings.subscribe(Object.keys(cssVarIndex), function (key: string) {
			const name = cssVarIndex[key].name;
			const value = settings.data[key].value;
			const unit = cssVarIndex[key].unit;
			document.body.style.setProperty(`--${name}`, `${value}${unit}`);
		})
	);
</script>

<svelte:head>
	<title>Flow</title>
	
</svelte:head>

{#if $appMinimized}
  <div class="minimized">
    <Button
      icon="undo"
      text="unminimize"
      on:click={() => {
        unminimizeApp();
      }}
    />
  </div>
{:else}
  <div class="app-container">
    <MainFlow />

    {#if $popups.length > 0}
      <div
        class="screen"
        on:click|self={() => {
          closePopup(0);
        }}
        transition:screenTransition
      >
        <div
          class="popups"
          on:click|self={() => {
            closePopup(0);
          }}
        >
          {#key $popups}
            <Popup
              component={$popups[0].component}
              closeSelf={() => closePopup(0)}
              title={$popups[0].title}
              props={$popups[0].props}
            />
          {/key}
        </div>
      </div>
    {/if}
  </div>
{/if}
<style>

:global(input),
:global(button),
:global(select),
:global(textarea) {
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
}
:global(button) {
  margin: 0;
}

:global(h1) {
  font-weight: var(--font-weight);
  font-size: 1.5rem;
  margin: 0;
}
:global(h2) {
  font-weight: var(--font-weight);
  font-size: 1.2rem;
  margin: 0;
}
:global(a) {
  color: var(--text-accent);
}

.app-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
:global(body) {
  /* Existing body styles remain the same */
  margin: 0;
  padding: 0;
  overflow: hidden; /* Prevent body scrolling */
  --this-text: var(--text);
  background: var(--background-back);
  color: var(--this-text);
  font-family: var(--font-family);
  font-size: var(--font-size);
  font-weight: var(--font-weight);

  --main-margin: var(--gap);
  --main-height: calc(100vh - var(--main-margin) * 2);
  --column-width: 160px;
  --padding: 8px;
  --padding-small: calc(var(--padding) / 2);
  --padding-big: calc(var(--padding) * 2);
  --title-height: calc(var(--button-size) + var(--padding) * 4);
  --view-height: calc(var(--main-height) - var(--title-height) - var(--gap));
  --font-size: 0.9rem;
  --font-weight-bold: 700;
  --font-family: "Merriweather Sans", sans-serif;
  --font-weight: 300;
  --border-radius: 8px;
  --border-radius-small: calc(var(--border-radius) / 2);
  --button-size: 20px;
  --gap: 8px;
  --line-width: 8px;
  --sidebar-width: 184px;
}
/* background text color 
accent
secondary
back indent active fade weak */
:global(body) {
  --background-back: hsl(0, 0%, 95%);

  --background: hsl(0, 0%, 100%);
  --background-indent: hsl(0 0% 92%);
  --background-active: hsl(0 0% 84%);

  --background-secondary: hsl(0 0% 98%);
  --background-secondary-indent: hsl(0 0% 89%);
  --background-secondary-active: hsl(0 0% 81%);

  --background-accent-indent: hsl(var(--accent-hue) 60% 92%);
  --background-accent-active: hsl(var(--accent-hue) 70% 86%);

  --background-accent-secondary-indent: hsl(
    var(--accent-secondary-hue),
    60%,
    92%
  );
  --background-accent-secondary-active: hsl(
    var(--accent-secondary-hue),
    70%,
    86%
  );

  --text: hsl(0 0% 30%);
  --text-select: hsl(0, 0%, 100%, 80%);
  --text-weak: hsl(0, 0%, 70%);
  --text-error: hsl(0, 90%, 60%);

  --text-accent: hsl(var(--accent-hue), 90%, 30%);
  --text-accent-select: hsl(var(--accent-hue), 100%, 60%, 30%);
  --text-accent-weak: hsl(var(--accent-hue), 30%, 70%);

  --text-accent-secondary: hsl(var(--accent-secondary-hue), 90%, 30%);
  --text-accent-secondary-select: hsl(
    var(--accent-secondary-hue),
    100%,
    60%,
    30%
  );
  --text-accent-secondary-weak: hsl(var(--accent-secondary-hue), 30%, 70%);

  --color: hsl(0 0% 70%);
  --color-fade: hsl(0 0% 85%);

  --color-accent: hsl(var(--accent-hue), 80%, 70%);
  --color-accent-fade: hsl(var(--accent-hue), 90%, 85%);

  --color-accent-secondary: hsl(var(--accent-secondary-hue), 80%, 70%);
  --color-accent-secondary-fade: hsl(var(--accent-secondary-hue), 90%, 85%);

  --slider-lightness: 85%;
  --slider-lightness-hover: 80%;
  --slider-saturation: 90%;
  --slider-switch-lightness: 60%;

  --color-screen: hsl(0 0% 0%/ 0.3);
}
:global(body2.dark) {
  --background-back: hsl(0 0% 10%);

  --background: hsl(22, 6%, 73%);
  --background-indent: hsl(22, 6%, 73%);
  --background-active: hsl(22, 6%, 73%);

  --background-secondary:hsl(22, 6%, 73%);;
  --background-secondary-indent: hsl(22, 6%, 73%);;
  --background-secondary-active: hsl(22, 6%, 73%);;

  --background-accent-indent: hsl(var(--accent-hue) 10% 24%);
  --background-accent-active: hsl(var(--accent-hue) 20% 30%);

  --background-accent-secondary-indent: hsl(
    var(--accent-secondary-hue) 10% 24%
  );
  --background-accent-secondary-active: hsl(
    var(--accent-secondary-hue) 20% 30%
  );

  --text: hsl(0, 0%, 80%);
  --text-select: hsl(0, 0%, 100%, 30%);
  --text-weak: hsl(0, 0%, 50%);
  --text-error: hsl(0, 100%, 70%);

  --text-accent: hsl(var(--accent-hue), 60%, 80%);
  --text-accent-select: hsl(var(--accent-hue), 80%, 60%, 30%);
  --text-accent-weak: hsl(var(--accent-hue), 15%, 50%);

  --text-accent-secondary: hsl(var(--accent-secondary-hue), 60%, 80%);
  --text-accent-secondary-select: hsl(
    var(--accent-secondary-hue),
    80%,
    60%,
    30%
  );
  --text-accent-secondary-weak: hsl(var(--accent-secondary-hue), 15%, 50%);

  --color: hsl(22, 6%, 73%);
  --color-fade: hsl(0, 0%, 32%);

  --color-accent: hsl(var(--accent-hue), 40%, 42%);
  --color-accent-fade: hsl(var(--accent-hue), 25%, 32%);

  --color-accent-secondary: hsl(var(--accent-secondary-hue), 40%, 42%);
  --color-accent-secondary-fade: hsl(var(--accent-secondary-hue), 25%, 32%);

  --slider-lightness: 24%;
  --slider-lightness-hover: 30%;
  --slider-saturation: 20%;
  --slider-switch-lightness: 42%;

  --color-screen: hsl(0 0% 0%/ 0.4);
}
:global(.palette-plain) {
  --this-background: var(--background);
  --this-background-indent: var(--background-indent);
  --this-background-active: var(--background-active);
  --this-text: var(--text);
  --this-text-weak: var(--text-weak);
  --this-text-select: var(--text-select);
  --this-color: var(--color);
  --this-color-fade: var(--color-fade);
}
:global(.palette-plain-secondary) {
  --this-background: var(--background-secondary);
  --this-background-indent: var(--background-secondary-indent);
  --this-background-active: var(--background-secondary-active);
  --this-text: var(--text);
  --this-text-weak: var(--text-weak);
  --this-text-select: var(--text-select);
}
.palette-accent {
  --this-background: var(--background);
  --this-background-indent: var(--background-accent-indent);
  --this-background-active: var(--background-accent-active);
  --this-text: var(--text-accent);
  --this-text-weak: var(--text-accent-weak);
  --this-text-select: var(--text-accent-select);
  --this-color: var(--color-accent);
  --this-color-fade: var(--color-accent-fade);
}
.palette-accent-secondary {
  --this-background: var(--background-secondary);
  --this-background-indent: var(--background-accent-secondary-indent);
  --this-background-active: var(--background-accent-secondary-active);
  --this-text: var(--text-accent-secondary);
  --this-text-weak: var(--text-accent-secondary-weak);
  --this-text-select: var(--text-accent-secondary-select);
  --this-color: var(--color-accent-secondary);
  --this-color-fade: var(--color-accent-secondary-fade);
}
.palette-disabled {
  --this-background-indent: var(--background);
  --this-background-active: var(--background);
  --this-color: var(--color-fade);
  --this-text: var(--text-weak);
}

a:visited {
  color: var(--text-accent-weak);
}
a:hover,
:global(a:active) {
  color: var(--text-accent-select);
}

:global(.screen) {
  background-color: var(--color-screen);
  width: 100vw;
  height: 100vh;
  position: fixed;
  display: flex;
  top: 0;
  left: 0;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
:global(.popups) {
  width: 100vw;
  height: min-content;
  display: flex;
  align-items: center;
  justify-content: center;
}
:global(.minimized) {
  display: flex;
  align-items: center;
  justify-content: center;
  position: fixed;
  width: 100%;
  height: 100%;
  background-color: var(--color-screen);
  z-index: 999;
}

</style>
