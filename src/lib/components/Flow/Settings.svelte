<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Button } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";
  import Setting from './Setting.svelte';
  import { settingsGroups, settings } from './models/settings';

  export let closePopup: () => void;

  onDestroy(() => {
    settings.saveToLocalStorage();
  });

  let settingComponents: Setting[][] = settingsGroups.map(() => []);

  function scrollToSettingElement(groupIndex: number, index: number) {
    settingComponents[groupIndex][index].scrollToSelf();
  }

  function resetAllSettings() {
    settings.resetToAuto();
  }

  function saveSettings() {
    settings.saveToLocalStorage();
    closePopup();
  }
</script>

<div class="flex bg-white flex-col h-full w-full max-w-[1100px] max-h-[700px] bg-background">
  <div class="flex flex-1 overflow-hidden">
    <div class="w-1/5 min-w-[150px] border-r overflow-y-auto">
      <div class="p-4">
        {#each settingsGroups as group, groupIndex}
          <div class="mb-2">
            <h2 class="text-sm font-semibold">{group.name}</h2>
            <ul class="mt-2 space-y-1">
              {#each group.settings as key, index}
                <li>
                  <Button
                    variant="ghost"
                    class="w-full justify-start text-sm"
                    on:click={() => scrollToSettingElement(groupIndex, index)}
                  >
                    {settings.data[key].name}
                  </Button>
                </li>
              {/each}
            </ul>
          </div>
          {#if groupIndex < settingsGroups.length - 1}
            <Separator class="my-2" />
          {/if}
        {/each}
      </div>
    </div>
    
    <div class="flex-1 flex flex-col">
      <div class="flex-1 overflow-y-auto">
        <div class="p-4">
          {#each settingsGroups as group, groupIndex}
            <h2 class="text-2xl font-bold mb-4">{group.name}</h2>
            <div class="space-y-4 mb-8">
              {#each group.settings as key, index}
                <Setting
                  {key}
                  setting={settings.data[key]}
                  bind:this={settingComponents[groupIndex][index]}
                />
              {/each}
            </div>
            {#if groupIndex < settingsGroups.length - 1}
              <Separator class="my-8" />
            {/if}
          {/each}
        </div>
      </div>
      
      <div class="p-4 border-t flex justify-between items-center">
        <Button variant="outline" on:click={resetAllSettings}>
          Reset All Settings
        </Button>
        <Button variant="default" on:click={saveSettings}>
          Save Settings
        </Button>
      </div>
    </div>
  </div>
</div>