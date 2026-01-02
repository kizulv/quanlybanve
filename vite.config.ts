import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  console.log("Vite Config Env Check:", {
    mode,
    VITE_APP_DOMAIN: env.VITE_APP_DOMAIN,
    VITE_APP_SUBDOMAIN: env.VITE_APP_SUBDOMAIN,
  });
  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
      allowedHosts: ["vetet.pcthanh.com"],
    },
    plugins: [react()],
    define: {
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "import.meta.env.VITE_APP_DOMAIN": JSON.stringify(
        env.VITE_APP_DOMAIN || "pcthanh.com"
      ),
      "import.meta.env.VITE_APP_SUBDOMAIN": JSON.stringify(
        env.VITE_APP_SUBDOMAIN || "vetet"
      ),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
