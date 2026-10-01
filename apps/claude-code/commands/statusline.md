---
description: Show how to add the Vibefuel balance to the Claude Code status line

allowed-tools: Bash(node:*)
---

Vibefuel output:
!`node "${CLAUDE_PLUGIN_ROOT}/bin/vibefuel.cjs" statusline-snippet`

Show the user the JSON above. Offer to add the statusLine key to ~/.claude/settings.json for them, merging with any existing keys. Only edit the file if they say yes.
