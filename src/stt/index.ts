/**
 * src/stt/index.ts
 *
 * Re-exports createNativeSTT from the platform-appropriate file.
 * Metro resolves:
 *   - stt.native.ts for iOS and Android builds
 *   - stt.web.ts    for web builds
 *
 * Importing from './stt' triggers this resolution automatically.
 */

// Metro will substitute the correct platform file at bundle time.
export { createNativeSTT } from './stt';
export type { STTInterface } from './types';
