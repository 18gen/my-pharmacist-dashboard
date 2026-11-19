import { defineConfig } from "vitest/config"

// As node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md sets it up, except
// that Vite now reads tsconfig's "@/*" paths itself (no vite-tsconfig-paths), and the
// API tests need no browser, so Node is the environment.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
})
