import path from 'path';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

const rootDir = path.resolve(process.cwd());
const parentDir = path.resolve(rootDir, '..');

export default defineConfig({
  base: './',
  plugins: [solid()],
  clearScreen: false,
  server: {
    port: 1421,
    strictPort: true,
    watch: {
      // Task folders can live anywhere on disk. Ignore anything resolving outside
      // this source tree so background task activity does not trigger renderer reloads.
      ignored: [
        (watchedPath: string) => {
          const resolvedPath = path.resolve(watchedPath);
          return resolvedPath.startsWith(parentDir) && !resolvedPath.startsWith(rootDir);
        },
      ],
    },
  },
});
