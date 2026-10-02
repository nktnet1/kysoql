import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { defineConfig, type Plugin } from "vite";
import { normalizeBasePath } from "./src/lib/basePath";

const basePath = normalizeBasePath(process.env.PUBLIC_DOCS_BASE_PATH);

export default defineConfig({
  server: {
    port: 3000,
  },
  envPrefix: ["VITE_", "PUBLIC_"],
  base: basePath,
  plugins: [
    fumadocsMdx(),
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          outputPath: "index.html",
          enabled: true,
          crawlLinks: true,
        },
      },

      pages: [
        {
          path: "/docs",
        },
        {
          path: "/api/search",
        },
        {
          path: "/llms-full.txt",
        },
        {
          path: "/llms.txt",
        },
      ],
    }),
    generate404Page(),
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      tslib: "tslib/tslib.es6.js",
    },
  },
});

function generate404Page(): Plugin {
  const redirectTarget = JSON.stringify(basePath);
  const htmlContent = `\
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0; url=${basePath}">
    <title>Redirecting...</title>
    <script>
        window.location.replace(${redirectTarget});
    </script>
</head>
</html>`;

  return {
    name: "generate-404.html",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "404.html",
        source: htmlContent,
      });
    },
  };
}
