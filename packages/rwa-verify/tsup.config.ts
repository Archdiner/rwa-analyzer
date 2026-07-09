import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        mcp: "../../mcp/server.ts",
        cli: "../../bin/rwa-verify.ts",
    },
    format: ["esm"],
    platform: "node",
    target: "node20",
    outDir: "dist",
    clean: true,
    splitting: false,
    sourcemap: true,
    dts: false,
    banner: {
        js: "#!/usr/bin/env node",
    },
    esbuildOptions(options) {
        options.alias = {
            "@": new URL("../..", import.meta.url).pathname,
        };
    },
    external: ["@modelcontextprotocol/sdk", "zod"],
});
