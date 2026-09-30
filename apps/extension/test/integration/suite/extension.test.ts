import * as assert from "node:assert/strict"
import * as vscode from "vscode"

const EXTENSION_ID = "vibefuel.vibefuel"

suite("Vibefuel extension", () => {
  test("activates and opens the feed view", async () => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID)
    assert.ok(extension, "extension is installed in the test host")
    await extension.activate()
    assert.equal(extension.isActive, true)

    // Opening the feed must not throw; the view container is contributed.
    await vscode.commands.executeCommand("vibefuel.openFeed")

    const commands = await vscode.commands.getCommands(true)
    for (const id of [
      "vibefuel.openFeed",
      "vibefuel.pause",
      "vibefuel.resume",
      "vibefuel.linkWallet",
      "vibefuel.unlinkWallet",
      "vibefuel.signOut",
      "vibefuel.openLandingPage",
    ]) {
      assert.ok(commands.includes(id), `${id} is registered`)
    }
  })

  test("defaults to mock mode and opt-out", () => {
    const config = vscode.workspace.getConfiguration("vibefuel")
    assert.equal(config.get("enabled"), false)
    assert.equal(config.get("apiBaseUrl"), "")
    assert.equal(config.get("frequencyMinutes"), 30)
    assert.equal(config.get("quietPeriodMinutes"), 10)
  })
})
