<script lang="ts">
  export let closePopup: () => void;

  import { onMount } from "svelte";
  import dictionaryDebate from "./dictionary-debate";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Card } from "$lib/components/ui/card";
  import { Search, Book, X, ArrowUpRight } from "lucide-svelte";

  let searchTerm = "";
  let filteredDebateTerms: string[] = [];

  function handleInput(event: Event) {
    searchTerm = (event.target as HTMLInputElement).value.toLowerCase();

    if (searchTerm.trim().length < 2) {
      filteredDebateTerms = [];
      return;
    }

    const words = searchTerm.split(" ").filter((word) => word.trim() !== "");

    filteredDebateTerms = dictionaryDebate
      .split("\n")
      .filter((line) =>
        words.every((word) => line.toLowerCase().includes(word))
      );

    var filteredDebateTermsTop = filteredDebateTerms.filter((line) =>
      line.toLowerCase().split(":")[0].includes(words[0])
    );

    filteredDebateTerms = filteredDebateTermsTop.concat(
      filteredDebateTerms.filter(
        (line) => line.toLowerCase().split(":")[0].includes(words[0]) == false
      )
    );
  }

  onMount(() => {
    console.log("Component mounted");
  });
</script>

<div class="w-[95%] max-w-[800px] mx-auto">
  <Card class="w-full h-[600px] flex flex-col overflow-hidden shadow-lg">
    <div class="flex justify-between items-center p-4 bg-secondary">
      <h2 class="text-2xl font-bold flex items-center gap-2">
        <Book class="text-muted-foreground" size={24} />
        Debate Terms Dictionary
      </h2>
      <!-- <Button variant="ghost" size="icon" on:click={closePopup}>
        <X class="text-muted-foreground" size={24} />
      </Button> -->
    </div>
    <div class="flex-1 flex flex-col p-4 overflow-hidden">
      <div class="relative mb-4">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
        <Input
          type="text"
          on:input={handleInput}
          placeholder="Search 200+ debate terms..."
          class="pl-10 w-full"
        />
      </div>

      <div class="flex-1 overflow-y-auto">
        {#if searchTerm && filteredDebateTerms.length === 0}
          <p class="text-center text-muted-foreground">No results found for "{searchTerm}".</p>
        {:else if filteredDebateTerms.length > 0}
          <ul class="space-y-2">
            {#each filteredDebateTerms as term}
              <li class="flex items-center gap-2 p-2 bg-secondary rounded">
                <ArrowUpRight class="text-muted-foreground" size={16} />
                {term}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </Card>
</div>