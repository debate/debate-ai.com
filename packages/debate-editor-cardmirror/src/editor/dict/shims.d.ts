// Ambient declarations for the viewport-spellcheck PROTOTYPE only.
// `?raw` is Vite's raw-text import; nspell ships no types.
declare module '*?raw' {
  const content: string;
  export default content;
}

declare module 'nspell' {
  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string): NSpell;
  }
  function nspell(aff: string | Buffer, dic?: string | Buffer): NSpell;
  export default nspell;
}
