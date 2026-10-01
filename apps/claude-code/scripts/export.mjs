#!/usr/bin/env node
// Export a standalone, publishable copy of the Vibefuel Claude Code plugin.
//
//   node scripts/export.mjs <output-dir> [--repo owner/name]
//
// The output is a self-contained git repository: plugin manifest, hooks,
// commands, the built bundle and a marketplace file whose source is "./".
// Users then install with:
//   claude plugin marketplace add owner/name
//   claude plugin install vibefuel@vibefuel
import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const pluginRoot = path.resolve(here, "..")
const DEFAULT_REPO = "Vibefuel00/vibefuel-claude-code"

const args = process.argv.slice(2)
const repoFlag = args.indexOf("--repo")
const repo = repoFlag >= 0 ? args[repoFlag + 1] : DEFAULT_REPO
const outArg = args.find(
  (a, i) => !a.startsWith("--") && args[i - 1] !== "--repo"
)
if (!outArg || !/^[\w.-]+\/[\w.-]+$/.test(repo ?? "")) {
  process.stderr.write(
    "usage: node scripts/export.mjs <output-dir> [--repo owner/name]\n"
  )
  process.exit(1)
}
const out = path.resolve(outArg)

// Always ship a fresh bundle.
execFileSync("node", [path.join(pluginRoot, "esbuild.mjs")], {
  stdio: "inherit",
})

const COPY = [
  "hooks",
  "commands",
  "bin",
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
]
fs.mkdirSync(path.join(out, ".claude-plugin"), { recursive: true })
for (const entry of COPY) {
  const src = path.join(pluginRoot, entry)
  const dst = path.join(out, entry)
  fs.rmSync(dst, { recursive: true, force: true })
  fs.cpSync(src, dst, { recursive: true })
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(pluginRoot, ".claude-plugin/plugin.json"), "utf8")
)
manifest.repository = `https://github.com/${repo}`
fs.writeFileSync(
  path.join(out, ".claude-plugin/plugin.json"),
  JSON.stringify(manifest, null, 2) + "\n"
)

const marketplace = {
  name: "vibefuel",
  owner: { name: "Vibefuel", url: "https://vibefuel.app" },
  metadata: {
    description:
      "Vibefuel for Claude Code: a labelled sponsored line after a task finishes. Earn Solana tokens toward your next AI credits.",
  },
  plugins: [
    {
      name: manifest.name,
      source: "./",
      description: manifest.description,
      version: manifest.version,
      author: manifest.author,
      homepage: manifest.homepage,
      license: manifest.license,
      keywords: manifest.keywords,
      category: "productivity",
    },
  ],
}
fs.writeFileSync(
  path.join(out, ".claude-plugin/marketplace.json"),
  JSON.stringify(marketplace, null, 2) + "\n"
)

// Point the README's install line at the standalone repository.
const readmePath = path.join(out, "README.md")
fs.writeFileSync(
  readmePath,
  fs.readFileSync(readmePath, "utf8").replaceAll(DEFAULT_REPO, repo)
)

fs.writeFileSync(
  path.join(out, ".gitignore"),
  "node_modules/\n.npm-cache/\n.DS_Store\n"
)
fs.writeFileSync(
  path.join(out, "SOURCE.md"),
  `# Source\n\nThis repository is generated. The plugin's TypeScript source, tests and the\nshared Vibefuel client core live in the Vibefuel monorepo under\n\`apps/claude-code\` and \`packages/vibefuel-core\`. Regenerate this repository\nwith \`node scripts/export.mjs <dir> --repo ${repo}\` there, then commit and push.\n`
)

if (!fs.existsSync(path.join(out, ".git"))) {
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: out })
}
process.stdout.write(
  `Exported plugin ${manifest.name}@${manifest.version} to ${out} (repo ${repo})\n`
)
