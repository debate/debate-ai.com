<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type { Editor } from '@tiptap/core';
  import { buildQuoteCardsHtml } from './quoteView';

  export let editor: Editor | null = null;
  export let fileName: string | undefined = undefined;
  export let active: boolean = false;

  const dispatch = createEventDispatcher();

  let contentHtml: string = '';
  let cardCount: number = 0;
  let totalWords: number = 0;

  $: if (editor && active) {
    updateContent();
  }

  function updateContent() {
    if (!editor) return;

    // Get HTML from editor
    const html = editor.getHTML();

    // Build quote cards HTML
    const result = buildQuoteCardsHtml(html, fileName);
    contentHtml = result.html;
    cardCount = result.metadata.cardCount;
    totalWords = result.metadata.totalWords;
  }

  async function handleCopyCard(sectionEl: HTMLElement) {
    const body = sectionEl.querySelector('.quote-body');
    const header = sectionEl.querySelector('.quote-card-header');
    const footer = sectionEl.querySelector('.quote-footer');

    const textParts: string[] = [];
    if (header) textParts.push(header.textContent || '');
    if (body) textParts.push(body.textContent || '');
    if (footer) textParts.push(footer.textContent || '');

    const text = textParts.join('\n\n').trim();

    try {
      await navigator.clipboard.writeText(text);
      showCopyFeedback(sectionEl);
    } catch (e) {
      console.error('Copy failed', e);
      alert('Failed to copy to clipboard. Please try again.');
    }
  }

  function showCopyFeedback(sectionEl: HTMLElement) {
    const copyBtn = sectionEl.querySelector('.copy-btn') as HTMLButtonElement;
    if (copyBtn) {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '✓ Copied!';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.classList.remove('copied');
      }, 2000);
    }
  }

  function handleAiAnalyzeCard(sectionEl: HTMLElement) {
    const blockquote = sectionEl.querySelector(
      'blockquote.tiptap-fancy-blockquote'
    ) as HTMLElement | null;
    const body = sectionEl.querySelector('.quote-body');

    const payload = {
      summary: blockquote?.dataset.summary || null,
      author: blockquote?.dataset.author || null,
      year: blockquote?.dataset.year || null,
      cite: blockquote?.dataset.cite || null,
      url: blockquote?.dataset.url || null,
      html: body ? body.innerHTML : '',
      words: blockquote?.dataset.words ? Number(blockquote.dataset.words) : 0,
    };

    // Dispatch event to parent component
    dispatch('aiAnalyze', payload);

    // For now, just log to console
    console.log('AI analyze card requested:', payload);
  }

  function handleClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const button = target.closest('button[data-role]') as HTMLButtonElement | null;
    if (!button) return;

    const role = button.dataset.role;
    const card = button.closest('section.quote-card') as HTMLElement | null;
    if (!card) return;

    if (role === 'copy') {
      event.preventDefault();
      handleCopyCard(card);
    } else if (role === 'ai-analyze') {
      event.preventDefault();
      handleAiAnalyzeCard(card);
    }
  }

  onMount(() => {
    if (editor && active) {
      updateContent();
    }
  });
</script>

{#if active && editor}
  <div class="quote-view-wrapper">
    <div class="quote-view-header">
      <div class="quote-view-stats">
        <span class="stat-item">
          <strong>{cardCount}</strong> {cardCount === 1 ? 'card' : 'cards'}
        </span>
        <span class="stat-separator">•</span>
        <span class="stat-item">
          <strong>{totalWords}</strong> {totalWords === 1 ? 'word' : 'words'}
        </span>
      </div>
    </div>

    <div
      class="quote-view-container"
      on:click={handleClick}
      role="presentation"
    >
      {@html contentHtml}
    </div>
  </div>
{:else if active && !editor}
  <div class="quote-view-loading">
    <p>Loading editor...</p>
  </div>
{/if}

<style>
  .quote-view-wrapper {
    padding: 1rem;
    max-width: 900px;
    margin: 0 auto;
  }

  .quote-view-header {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  }

  .quote-view-stats {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.9rem;
    color: #9ca3af;
  }

  .stat-item strong {
    color: #e5e7eb;
    font-weight: 600;
  }

  .stat-separator {
    color: rgba(148, 163, 184, 0.5);
  }

  .quote-view-container {
    min-height: 200px;
  }

  .quote-view-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    color: #9ca3af;
  }

  /* Quote view will be styled via global CSS in quote-view.css */
  :global(.quote-view-empty) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    color: #9ca3af;
    text-align: center;
    padding: 2rem;
  }

  :global(.quote-view-empty p) {
    margin: 0.5rem 0;
  }
</style>
