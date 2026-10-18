import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/devtools.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: false,
  clean: true,
  treeshake: true,
  target: "es2022",
  external: ["preact", "preact/hooks", "@preact/signals"]
});
