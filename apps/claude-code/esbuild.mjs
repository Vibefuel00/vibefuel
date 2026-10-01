import * as esbuild from "esbuild"

const watch = process.argv.includes("--watch")

/** @type {import("esbuild").BuildOptions} */
const options = {
  entryPoints: ["src/cli.ts"],
  bundle: true,
  outfile: "bin/vibefuel.cjs",
  platform: "node",
  target: "node18",
  format: "cjs",
  minify: false,
  sourcemap: false,
  banner: { js: "#!/usr/bin/env node" },
  logLevel: "info",
}

if (watch) {
  const ctx = await esbuild.context(options)
  await ctx.watch()
} else {
  await esbuild.build(options)
}
