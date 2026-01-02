import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
      allowedHosts: [
        "vetet.pcthanh.com",
        "banve.pcthanh.com",
        "vetet.nhaxetrungdung.com",
        "api.pcthanh.com",
      ],
      hmr: {
        protocol: env.VITE_USE_WSS === "true" ? "wss" : "ws",
        clientPort: env.VITE_USE_WSS === "true" ? 443 : 3000,
      },
    },
    plugins: [react()],
    define: {
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "import.meta.env.VITE_APP_MAIN_DOMAIN": JSON.stringify(
        env.VITE_APP_MAIN_DOMAIN
      ),
      "import.meta.env.VITE_APP_ORDER_DOMAIN": JSON.stringify(
        env.VITE_APP_ORDER_DOMAIN
      ),
      "import.meta.env.MONGO_URI": JSON.stringify(env.MONGO_URI),
      "import.meta.env.VITE_API_URL": JSON.stringify(env.VITE_API_URL),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
