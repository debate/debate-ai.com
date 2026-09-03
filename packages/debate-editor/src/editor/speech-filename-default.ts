/** The stock speech-doc filename template, split into its own file
 *  so `settings.ts` and `speech-filename.ts` can both import it
 *  without forming an import cycle (settings.ts needs the default
 *  for `DEFAULTS`; speech-filename.ts needs `settings` for the
 *  `formatSpeechFilename` wrapper). Byte-identical output to the
 *  pre-template implementation, so an existing user sees no change. */
export const DEFAULT_SPEECH_FILENAME_TEMPLATE =
  'Speech {speech} {date:M-D h-mmA}';
