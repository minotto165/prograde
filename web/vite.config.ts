import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  // エージェントはサーバー専用。adapter-node の出力に同梱し、実行時に
  // node_modules の有無へ依存させない。
  ssr: {
    noExternal: ["@earendil-works/pi-agent-core", "@earendil-works/pi-ai", "@earendil-works/pi-schema"],
  },
});
