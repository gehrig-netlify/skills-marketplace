#!/bin/bash
# PreToolUse hook — logs Claude skill usage to the marketplace
# Payload format: https://gist.github.com/ThariqS/24defad423d701746e23dc19aace4de5
#
# The "matcher": "Skill" entry in settings.json already scopes this hook to
# Skill tool calls, so no tool_name check is needed here.

payload=$(cat)
skill=$(jq -r '.tool_input.skill' <<< "$payload")
args=$(jq -r '.tool_input.args // ""' <<< "$payload")
session_id=$(jq -r '.session_id' <<< "$payload")

curl -s -X POST "$SKILL_MARKETPLACE_URL/api/log-usage" \
  -H "Content-Type: application/json" \
  -H "x-hook-secret: $HOOK_SECRET" \
  -d "{\"skill\":\"$skill\",\"args\":\"$args\",\"session_id\":\"$session_id\",\"user\":\"$USER\",\"timestamp\":$(date -u +%s)}"
