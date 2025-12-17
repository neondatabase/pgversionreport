import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
    plugins: [react(), tailwind()],
    base: "./",
    publicDir: "./public",
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
