import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      cli: "src/cli.ts"
    },
    format: ["esm"],
    target: "node22",
    platform: "node",
    dts: true,
    sourcemap: true,
    splitting: false,
    clean: false
  },
  {
    entry: {
      "action/index": "src/action.ts"
    },
    format: ["cjs"],
    target: "node24",
    platform: "node",
    dts: false,
    sourcemap: false,
    splitting: false,
    clean: false,
    noExternal: [/.*/]
  }
]);
