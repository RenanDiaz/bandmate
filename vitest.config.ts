import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so tests don't load the PWA/SEO build plugins.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test/setup.ts"],
    restoreMocks: true,
  },
});
