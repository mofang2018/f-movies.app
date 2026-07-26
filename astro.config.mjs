import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

const viteCacheDir = process.env.F_MOVIES_VITE_CACHE_DIR ?? "node_modules/.vite-dev";

export default defineConfig({
  site: "https://watchfmovies.org",
  output: "server",
  adapter: cloudflare({
    imageService: "cloudflare",
  }),
  vite: {
    cacheDir: viteCacheDir,
    server: {
      allowedHosts: true,
    },
  },
});
