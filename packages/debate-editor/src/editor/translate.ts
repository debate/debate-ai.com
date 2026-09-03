/**
 * Translator — mirror of the "Card Formatting Tools" Translator tool.
 *
 * Select text → translate it → drop the result on the clipboard (the
 * selection is left untouched). Three interchangeable backends:
 *
 *   - **MyMemory** — no API key, works with AI features off. CORS-enabled
 *     so it runs straight from the renderer. Free anonymous limit is
 *     ~5,000 chars/day (50,000 with an email in settings). Needs a source
 *     language; MyMemory's own auto-detect is unreliable, so when the
 *     source is "auto" we detect locally with `tinyld` first. Per-request
 *     `q` is capped (~500 chars), so longer text is chunked and rejoined.
 *   - **AI provider** (stored value `'anthropic'`) — high quality, used
 *     when AI features are enabled; goes through `callLlm`, so it follows
 *     the Comments & AI provider (Anthropic or OpenRouter) and reuses the
 *     reference Translator system prompt. Auto-detects source.
 *   - **Google Cloud Translation** — optional paid backend (500k chars/mo
 *     free, then per-character). Auto-detects source.
 *
 * `'auto'` resolves to the AI provider when AI features are ready, else
 * MyMemory.
 */

import type { EditorView } from 'prosemirror-view';
import { settings, condenseWarningCloseFor } from './settings.js';
import { aiFailureNotice, callLlm, LlmError, resolveAiModel, activeApiKey, aiConfigured } from './ai/llm.js';
import { showToast } from './toast.js';
import { CLIPBOARD_BUSY_MESSAGE, writeClipboardText } from './clipboard-write.js';

/** Languages offered in the source / target pickers. ISO 639-1 codes —
 *  the format MyMemory, Google, and tinyld all speak. Not exhaustive
 *  (MyMemory itself supports a limited set); covers the languages debate
 *  evidence actually shows up in. */
export const TRANSLATION_LANGUAGES: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ru', name: 'Russian' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'pl', name: 'Polish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'fi', name: 'Finnish' },
  { code: 'cs', name: 'Czech' },
  { code: 'el', name: 'Greek' },
  { code: 'tr', name: 'Turkish' },
  { code: 'ar', name: 'Arabic' },
  { code: 'he', name: 'Hebrew' },
  { code: 'fa', name: 'Persian' },
  { code: 'hi', name: 'Hindi' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'th', name: 'Thai' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ms', name: 'Malay' },
  { code: 'ro', name: 'Romanian' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'hr', name: 'Croatian' },
  { code: 'sr', name: 'Serbian' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'lv', name: 'Latvian' },
  { code: 'et', name: 'Estonian' },
];

/** Human-readable name for a language code (falls back to the code). */
export function languageName(code: string): string {
  return TRANSLATION_LANGUAGES.find((l) => l.code === code)?.name ?? code;
}

type ResolvedProvider = 'mymemory' | 'anthropic' | 'google';

/** True when the Anthropic path is usable (AI master switch on + a key). */
function anthropicReady(): boolean {
  return aiConfigured();
}

/** Resolve the configured provider, expanding `'auto'`. */
export function resolveTranslationProvider(): ResolvedProvider {
  const p = settings.get('translationProvider');
  if (p === 'auto') return anthropicReady() ? 'anthropic' : 'mymemory';
  return p;
}

export interface TranslateOutcome {
  text: string;
  /** Display label of the backend that did the work (toast). */
  provider: string;
  /** Upper-case attribution for the "TRANSLATION BY …" marker — the
   *  model name for Anthropic, else the service name. */
  markerName: string;
  /** True when the backend cut the output short (Anthropic
   *  `stop_reason: 'max_tokens'`) — the text is INCOMPLETE and the
   *  caller must say so, not silently hand over a cut-off translation. */
  truncated?: boolean;
}

/** Map an Anthropic model id to a short upper-case label for the marker
 *  (e.g. `claude-opus-4-8` → `OPUS 4.8`). Falls back to a derived label. */
function modelMarkerName(modelId: string): string {
  const known: Record<string, string> = {
    'claude-opus-4-8': 'OPUS 4.8',
    'claude-sonnet-4-6': 'SONNET 4.6',
    'claude-haiku-4-5': 'HAIKU 4.5',
    'claude-haiku-4-5-20251001': 'HAIKU 4.5',
  };
  if (known[modelId]) return known[modelId];
  // Best-effort: "claude-opus-4-8-foo" → "OPUS 4.8".
  const m = /claude-(opus|sonnet|haiku)-(\d+)-(\d+)/.exec(modelId);
  if (m) return `${m[1]!.toUpperCase()} ${m[2]}.${m[3]}`;
  return modelId.toUpperCase();
}

/** Every attribution string the marker can carry — used both to build a
 *  marker and to protect them all from Shrink. The Anthropic entries
 *  cover the model family regardless of which one is configured. */
export const TRANSLATION_MARKER_NAMES: readonly string[] = [
  'MYMEMORY',
  'GOOGLE TRANSLATE',
  'OPUS 4.8',
  'SONNET 4.6',
  'HAIKU 4.5',
  'OPENROUTER',
];

/** Build the "[TRANSLATION BY X]" marker using the same delimiter the
 *  user picked for "Condense with warning". The six built-in bracket
 *  shapes wrap cleanly; the `'custom'` condense delimiter is a pair of
 *  full marker strings (no open/close to reuse), so we fall back to
 *  square brackets there. */
export function buildTranslationMarker(markerName: string): string {
  const d = settings.get('condenseWarningDelimiter');
  if (d === 'custom') return `[TRANSLATION BY ${markerName}]`;
  return `${d}TRANSLATION BY ${markerName}${condenseWarningCloseFor(d)}`;
}

/** Translate `text` using the resolved backend. Throws on failure with a
 *  user-facing message. */
export async function translateText(text: string): Promise<TranslateOutcome> {
  const provider = resolveTranslationProvider();
  const target = (settings.get('translationTargetLang') || 'en').toLowerCase();
  const sourceSetting = (settings.get('translationSourceLang') || 'auto').toLowerCase();

  if (provider === 'anthropic') {
    const reply = await translateAnthropic(text, target);
    const openrouter = settings.get('aiProvider') === 'openrouter';
    return {
      text: reply.text,
      truncated: reply.truncated,
      provider: openrouter ? 'OpenRouter' : 'Anthropic',
      markerName: openrouter ? 'OPENROUTER' : modelMarkerName(resolveAiModel()),
    };
  }
  if (provider === 'google') {
    const src = sourceSetting === 'auto' ? '' : sourceSetting;
    return { text: await translateGoogle(text, src, target), provider: 'Google', markerName: 'GOOGLE TRANSLATE' };
  }
  // MyMemory — needs a concrete source language.
  let source = sourceSetting;
  if (source === 'auto') {
    source = await detectSourceLanguage(text);
    if (!source) {
      throw new Error(
        'Could not detect the source language. Pick one under Settings → Editing → Translation.',
      );
    }
  }
  if (source === target) return { text, provider: 'MyMemory', markerName: 'MYMEMORY' };
  return { text: await translateMyMemory(text, source, target), provider: 'MyMemory', markerName: 'MYMEMORY' };
}

/** Local source-language detection (tinyld → ISO 639-1). Returns '' when
 *  the detector can't make a confident call.
 *  tinyld is loaded lazily: its n-gram model is ~577 KB — a third of the
 *  main chunk if imported statically — and only this one MyMemory
 *  source='auto' path needs it. The full (not 'light') build is
 *  deliberate: light confidently misidentifies several picker languages
 *  (uk→ru, cs→fi, vi→hu), which would silently mistranslate. */
async function detectSourceLanguage(text: string): Promise<string> {
  try {
    const { detect } = await import('tinyld');
    const code = detect(text);
    return code || '';
  } catch {
    return '';
  }
}

// --------------------------- backends ---------------------------

/** Reference Translator prompt, parameterized by target language. */
function anthropicTranslatorPrompt(targetName: string): string {
  return `You are a professional translator. Your task is to translate the given text into fluent, natural-sounding ${targetName} while preserving the original meaning and context. If the text is already in ${targetName}, simply return it unchanged.

Important guidelines:
- Maintain the original tone and style
- Preserve formatting and special characters
- Keep proper nouns unchanged
- Return only the translated text without explanations`;
}

/** Output ceiling for AI translations. A translation is roughly
 *  input-sized, and the client's 1024-token default would silently cut
 *  off anything past a few paragraphs. 16K tokens (~40K+ characters) covers
 *  any realistic selection while staying within non-streaming HTTP
 *  comfort; output tokens only bill as generated, so the headroom is
 *  free on short translations. */
const ANTHROPIC_TRANSLATE_MAX_TOKENS = 16000;

async function translateAnthropic(
  text: string,
  target: string,
): Promise<{ text: string; truncated: boolean }> {
  if (!anthropicReady()) {
    throw new Error('AI translation needs AI features — enable them under Comments & AI.');
  }
  const reply = await callLlm({
    apiKey: activeApiKey(),
    system: anthropicTranslatorPrompt(languageName(target)),
    maxTokens: ANTHROPIC_TRANSLATE_MAX_TOKENS,
    messages: [{ role: 'user', content: text }],
  });
  // 'max_tokens' means the model was cut off mid-translation — the text
  // is incomplete even though the request "succeeded".
  return { text: reply.text.trim(), truncated: reply.stopReason === 'max_tokens' };
}

/** MyMemory per-request `q` cap (chars). Stay under it and rejoin. */
const MYMEMORY_CHUNK = 480;

async function translateMyMemory(text: string, source: string, target: string): Promise<string> {
  const email = settings.get('myMemoryEmail').trim();
  const chunks = chunkText(text, MYMEMORY_CHUNK);
  const out: string[] = [];
  for (const chunk of chunks) {
    const params = new URLSearchParams({ q: chunk, langpair: `${source}|${target}` });
    if (email) params.set('de', email);
    let json: MyMemoryResponse;
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`);
      json = (await res.json()) as MyMemoryResponse;
    } catch (e) {
      throw new Error(`MyMemory request failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    // MyMemory returns 200 in the body on success; a string status or a
    // 4xx/5xx number signals a quota / language / size error.
    if (json.responseStatus !== 200 && json.responseStatus !== '200') {
      throw new Error(json.responseDetails || `MyMemory error (${json.responseStatus}).`);
    }
    out.push(json.responseData?.translatedText ?? '');
  }
  return out.join('');
}

interface MyMemoryResponse {
  responseStatus: number | string;
  responseDetails?: string;
  responseData?: { translatedText?: string };
}

async function translateGoogle(text: string, source: string, target: string): Promise<string> {
  const key = settings.get('googleTranslateApiKey').trim();
  if (!key) {
    throw new Error('Add a Google Cloud Translation API key under Settings → Editing → Translation.');
  }
  const body: Record<string, string> = { q: text, target, format: 'text' };
  if (source) body.source = source;
  let json: GoogleResponse;
  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    json = (await res.json()) as GoogleResponse;
    if (json.error) throw new Error(json.error.message || 'Google Translation error.');
  } catch (e) {
    throw new Error(`Google request failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  const translated = json.data?.translations?.[0]?.translatedText;
  if (translated == null) throw new Error('Google returned no translation.');
  return translated;
}

interface GoogleResponse {
  data?: { translations?: Array<{ translatedText?: string }> };
  error?: { message?: string };
}

/** Split text into <=`max`-char chunks, preferring sentence / line breaks
 *  so the backend translates coherent units. Oversized atoms are
 *  hard-split. Whitespace between chunks is preserved by including it. */
export function chunkText(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  // Break points after sentence terminators or newlines.
  const parts = text.split(/(?<=[.!?。！？\n])/);
  let buf = '';
  for (const part of parts) {
    if (part.length > max) {
      if (buf) { chunks.push(buf); buf = ''; }
      for (let i = 0; i < part.length; i += max) chunks.push(part.slice(i, i + max));
      continue;
    }
    if (buf.length + part.length > max) { chunks.push(buf); buf = part; }
    else buf += part;
  }
  if (buf) chunks.push(buf);
  return chunks;
}

// --------------------------- command ----------------------------

// Clipboard writes go through the shared host-first / retrying path
// (clipboard-write.ts); the caller checks the result — the old
// version toasted "copied to clipboard" even when the write failed.

/** Entry point — fires on the `translate` ribbon command. Translates the
 *  current selection and copies the result to the clipboard. */
export function runTranslate(view: EditorView): void {
  const sel = view.state.selection;
  if (sel.empty) {
    showToast('Select some text to translate.');
    return;
  }
  const text = view.state.doc.textBetween(sel.from, sel.to, '\n', '\n').trim();
  if (!text) {
    showToast('Selection has no text to translate.');
    return;
  }
  const target = languageName((settings.get('translationTargetLang') || 'en').toLowerCase());
  showToast(`Translating to ${target}…`);
  void (async () => {
    try {
      const { text: translated, provider, markerName, truncated } = await translateText(text);
      let output = settings.get('prependTranslationMarker')
        ? `${buildTranslationMarker(markerName)}\n${translated}`
        : translated;
      if (truncated) {
        // The marker rides IN the clipboard text so an incomplete
        // translation can't be pasted without notice, toast or no toast.
        output += '\n[TRANSLATION INCOMPLETE — OUTPUT LENGTH LIMIT REACHED]';
      }
      if (!(await writeClipboardText(output))) {
        showToast(CLIPBOARD_BUSY_MESSAGE);
        return;
      }
      showToast(
        truncated
          ? `Translation hit the output length limit and was CUT OFF — the copied text is incomplete. Translate a smaller selection.`
          : `Translated to ${target} (${provider}) — copied to clipboard.`,
        truncated ? { durationMs: 4000 } : undefined,
      );
    } catch (e) {
      aiFailureNotice('Translate', e);
    }
  })();
}
