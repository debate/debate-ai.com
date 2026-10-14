/**
 * The slice of `@moonshine-ai/moonshine-js` the round recording uses; the
 * package ships a minified bundle with no type declarations.
 */
declare module "@moonshine-ai/moonshine-js" {
  export class MoonshineModel {
    /** `modelURL` is a path under Moonshine's CDN, e.g. `model/base`. */
    constructor(modelURL: string, precision?: string)
    loadModel(): Promise<void>
    /** Transcribes 16 kHz mono samples. */
    generate(audio: Float32Array): Promise<string>
  }
}
