# Internal Team Skill Marketplace

A small, self-hostable web app that lets a Claude Code team browse the skills available inside their organization and track how often each one gets used. Skills are defined in a static manifest you check into the repo, and usage telemetry is collected from a Claude Code `PreToolUse` hook that pings the app every time a teammate invokes a skill. It's meant to feel like an internal tool — a single place to see what skills exist, who owns them, and which ones are actually being used.

It's built to be forked, edited, and deployed to [Netlify](https://www.netlify.com/) in one click.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/gehrig-netlify/skills-marketplace)

> See it live at [skillsmarketplace.netlify.app](skillsmarketplace.netlify.app)

## What's inside

- **Frontend** — a React single-page app (`public/index.html`) loaded straight from CDN with Tailwind for styling. No build step, no bundler.
- **Backend** — two Netlify Functions (`netlify/functions/`) for recording and aggregating usage.
- **Storage** — [Netlify Blobs](https://docs.netlify.com/blobs/overview/), so no database to run.
- **Skill manifest** — `skills/registry.json`, the file you edit to list your team's skills.
- **Hook** — `hooks/log-skill.sh`, the Claude Code `PreToolUse` hook that reports each skill invocation.

## Features

- **Catalog** of every skill in `skills/registry.json`, with a filter sidebar (by owning team) and sorting by usage, alphabetically, or most recently updated.
- **Skill cards** showing the description, monospace trigger-phrase chips, live usage count, last-invoked time, and owner. Any skill invoked in the last 60 seconds gets a teal pulse ring (the frontend polls `/api/usage` every 10 seconds).
- **Usage dashboard** with per-skill totals, a 7-day sparkline, and last-invoked timestamps — all sourced from Netlify Blobs.

## Setup

1. **Fork this repo** (so you have your own copy to edit and deploy).
2. **Edit `skills/registry.json`** to describe your team's skills. Each entry looks like:
   ```json
   {
     "id": "pr-summary",
     "name": "PR Summary",
     "description": "Generates a reviewer-friendly summary of a pull request.",
     "triggerPhrases": ["summarize this PR", "/pr-summary"],
     "team": "engineering",
     "owner": "platform-eng",
     "lastUpdated": "2026-06-18"
   }
   ```
   The `id` must match the skill name your team uses in Claude Code, since that's what the hook sends.
3. **Deploy to Netlify** — click the button above, or connect your fork from the Netlify dashboard. Netlify auto-detects the configuration in `netlify.toml`.
4. **Set environment variables** in the Netlify dashboard (Site configuration → Environment variables):
   - `HOOK_SECRET` — a shared secret (optional, but recommended; see below).
5. **Install the hook locally** on each teammate's machine:
   - Copy `hooks/log-skill.sh` into `~/.claude/hooks/log-skill.sh` and make it executable: `chmod +x ~/.claude/hooks/log-skill.sh`.
   - Merge the snippet from `hooks/settings.json` into `~/.claude/settings.json`.
   - Export the two environment variables in your shell profile:
     ```bash
     export SKILL_MARKETPLACE_URL="https://your-site.netlify.app"
     export HOOK_SECRET="the-same-secret-you-set-in-netlify"
     ```
   The hook requires [`jq`](https://jqlang.github.io/jq/) and `curl`, which most setups already have.

Once installed, every `Skill` tool call in Claude Code fires the hook, which POSTs to `/api/log-usage`, and the dashboard updates within about ten seconds.

## Environment variables

| Var | Where | Purpose |
|---|---|---|
| `HOOK_SECRET` | Netlify dashboard | Validates incoming hook POSTs against the `x-hook-secret` header. |
| `SKILL_MARKETPLACE_URL` | Each user's local shell | Base URL the hook script's `curl` call targets. |

### About `HOOK_SECRET`

`HOOK_SECRET` is **optional but recommended**. When it's set in the Netlify dashboard, `/api/log-usage` rejects any request whose `x-hook-secret` header doesn't match — this prevents random or accidental traffic from polluting your usage telemetry. If you leave it unset, the endpoint accepts any well-formed POST, which is fine for a quick trial but not for a shared deployment.

## API

- **`POST /api/log-usage`** — body `{ skill, args, session_id, user, timestamp }`. Validates `x-hook-secret` when `HOOK_SECRET` is set, appends the event to the skill's blob (capped at 1000 events), and returns `{ ok: true }`.
- **`GET /api/usage`** — returns aggregated stats per skill: `{ skillId, total, dailyCounts[7], lastInvoked }`.

## Running locally

You need the [Netlify CLI](https://docs.netlify.com/cli/get-started/), which emulates Functions and Blobs locally:

```bash
npm install
netlify dev
```

Then open the URL it prints (usually `http://localhost:8888`). To exercise the logging endpoint by hand:

```bash
curl -X POST http://localhost:8888/api/log-usage \
  -H "Content-Type: application/json" \
  -H "x-hook-secret: $HOOK_SECRET" \
  -d '{"skill":"pr-summary","args":"","session_id":"local","user":"you","timestamp":'"$(date -u +%s)"'}'
```

## How the hook works

This uses Claude Code's `PreToolUse` hook, scoped to the `Skill` tool, so it fires right before any skill runs. The hook pattern this template follows is documented in [this gist](https://gist.github.com/ThariqS/24defad423d701746e23dc19aace4de5).

For the full mechanics of Claude Code hooks — events, matchers, exit codes, and security considerations — see Anthropic's official documentation:

- [Hooks reference](https://docs.claude.com/en/docs/claude-code/hooks)
- [Get started with hooks](https://docs.claude.com/en/docs/claude-code/hooks-guide)

## License

MIT — fork it, change it, ship it.
