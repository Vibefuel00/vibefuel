import * as path from "node:path"
import { runTests } from "@vscode/test-electron"

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, "../../../")
  const extensionTestsPath = path.resolve(__dirname, "./suite/index")
  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    version: process.env.VSCODE_TEST_VERSION ?? "stable",
    launchArgs: [
      "--disable-extensions",
      "--disable-workspace-trust",
      "--user-data-dir",
      path.resolve(extensionDevelopmentPath, ".vscode-test/user-data"),
    ],
  })
}

main().catch((error: unknown) => {
  process.stderr.write(`Integration tests failed: ${String(error)}\n`)
  process.exit(1)
})
