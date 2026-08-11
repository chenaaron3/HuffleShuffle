import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");

const buildOptions = {
  entryPoints: ["consumer.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  outfile: "dist/consumer.js",
  external: ["aws-sdk"],
  format: "esm",
  define: { "import.meta.url": "__filename" },
  tsconfig: "tsconfig.json",
  nodePaths: [path.join(__dirname, "node_modules")],
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(buildOptions);
}
