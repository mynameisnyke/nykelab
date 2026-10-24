import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import vue from "@astrojs/vue";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

// Adds `data-title` / `data-lang` to code fences so CSS can draw the
// filename + language header from the Figma CodeBlock component.
//   ```ts title="worker/index.ts"
const codeHeader = {
  name: "code-header",
  pre(node) {
    const raw = this.options.meta?.__raw ?? "";
    const title = /title="([^"]+)"/.exec(raw)?.[1];
    if (title) node.properties["data-title"] = title;
    node.properties["data-lang"] = this.options.lang;
  },
};

// Static by default (Journal is prerendered); pages that read D1 opt out with
// `export const prerender = false`.
export default defineConfig({
  site: "https://nykelab.nyc",
  adapter: cloudflare({ prerenderEnvironment: "node" }),
  integrations: [mdx(), sitemap(), vue()],
  vite: { plugins: [tailwindcss()] },
  markdown: {
    shikiConfig: {
      themes: { dark: "github-dark-default", light: "github-light-default" },
      defaultColor: false,
      transformers: [codeHeader],
    },
  },
});
