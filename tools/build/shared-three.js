/**
 * Shared Three.js Vite plugin configuration hook.
 * Main-thread dynamic imports (`./controller` and `./vitrine`) share a single `three` chunk
 * automatically via Vite/Rolldown code splitting.
 */
export function sharedThree() {
  return {
    plugins: [],
    workerPlugins: () => [],
  };
}
