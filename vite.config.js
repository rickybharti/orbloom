import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        benchmark: fileURLToPath(new URL("./examples/benchmark/index.html", import.meta.url)),
        showcase: fileURLToPath(new URL("./examples/index.html", import.meta.url)),
      },
    },
  },
});
