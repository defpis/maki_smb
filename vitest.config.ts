import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Run tests serially (shared storage directory)
    fileParallelism: false,
    // Run tests within same file serially
    sequence: {
      concurrent: false,
    },
    // Timeout
    testTimeout: 30000,
  },
});
