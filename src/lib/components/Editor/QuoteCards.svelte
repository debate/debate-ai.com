<script lang="ts">
  import { htmlToCards } from '$lib/docx/html-to-cards.js';
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "$lib/components/ui/card";
  import { Upload, FileText } from 'lucide-svelte';
  import { Button } from "$lib/components/ui/button";

  export let htmlContent = '';

  let fileInput: HTMLInputElement;
  let quoteCards = [];
  let outlineItems = [];
  let isProcessing = false;
  let errorMessage = '';

  // Parse HTML content whenever it changes
  $: if (htmlContent) {
    parseHtmlContent(htmlContent);
  }

  function parseHtmlContent(html: string) {
    try {
      isProcessing = true;
      errorMessage = '';

      const result = htmlToCards(html);
      quoteCards = result.quotes || [];
      outlineItems = result.outline || [];

      console.log('Parsed cards:', quoteCards);
      console.log('Outline items:', outlineItems);
    } catch (error) {
      console.error('Error parsing HTML:', error);
      errorMessage = 'Failed to parse HTML content: ' + error.message;
      quoteCards = [];
      outlineItems = [];
    } finally {
      isProcessing = false;
    }
  }

  function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
      const reader = new FileReader();

      reader.onload = (e) => {
        const content = e.target?.result as string;
        htmlContent = content;
      };

      reader.onerror = () => {
        errorMessage = 'Failed to read file';
      };

      reader.readAsText(file);
    }
  }

  function triggerFileUpload() {
    fileInput?.click();
  }
</script>

<div class="quote-cards-container p-4 space-y-4">
  <div class="header flex justify-between items-center mb-6">
    <h2 class="text-2xl font-bold">Quote Cards</h2>
    <Button on:click={triggerFileUpload} variant="outline">
      <Upload class="w-4 h-4 mr-2" />
      Upload HTML File
    </Button>
  </div>

  <input
    bind:this={fileInput}
    type="file"
    accept=".html,.htm"
    on:change={handleFileUpload}
    style="display: none;"
  />

  {#if isProcessing}
    <div class="text-center py-8">
      <p class="text-gray-600">Processing HTML content...</p>
    </div>
  {:else if errorMessage}
    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
      <p class="text-red-800">{errorMessage}</p>
    </div>
  {:else if quoteCards.length === 0}
    <div class="empty-state text-center py-12 bg-gray-50 rounded-lg">
      <FileText class="w-16 h-16 mx-auto mb-4 text-gray-400" />
      <h3 class="text-lg font-semibold text-gray-700 mb-2">
        No quote cards detected in this document.
      </h3>
      <p class="text-gray-600 mb-4">
        Add blockquotes or highlighted text to see quote cards here.
      </p>
      {#if !htmlContent}
        <Button on:click={triggerFileUpload}>
          <Upload class="w-4 h-4 mr-2" />
          Upload HTML File
        </Button>
      {/if}
    </div>
  {:else}
    <div class="cards-grid space-y-4">
      <div class="mb-4 text-sm text-gray-600">
        Found {quoteCards.length} quote {quoteCards.length === 1 ? 'card' : 'cards'}
      </div>

      {#each quoteCards as card, index}
        <Card class="quote-card">
          <CardHeader>
            <CardTitle class="text-lg">
              {card.tag || card.summary || `Card ${index + 1}`}
            </CardTitle>
            {#if card.cite}
              <CardDescription>
                {@html card.cite}
              </CardDescription>
            {/if}
          </CardHeader>
          {#if card.html}
            <CardContent>
              <div class="card-content prose max-w-none">
                {@html card.html}
              </div>
            </CardContent>
          {/if}
        </Card>
      {/each}
    </div>

    {#if outlineItems.length > 0}
      <details class="mt-8">
        <summary class="cursor-pointer text-sm font-semibold text-gray-700 mb-2">
          Additional Content ({outlineItems.length} items)
        </summary>
        <div class="outline-items space-y-2 mt-2 pl-4">
          {#each outlineItems as item}
            <div class="outline-item p-2 bg-gray-50 rounded text-sm">
              {@html item.content || item.text}
            </div>
          {/each}
        </div>
      </details>
    {/if}
  {/if}
</div>

<style>
  .quote-card {
    transition: all 0.2s ease;
  }

  .quote-card:hover {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .card-content :global(mark),
  .card-content :global(strong) {
    background-color: #fef3c7;
    padding: 0 2px;
  }

  .card-content :global(u) {
    text-decoration: underline;
    text-decoration-color: #3b82f6;
    text-decoration-thickness: 2px;
  }
</style>
