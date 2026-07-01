# AGENTS.md

Guidance for AI agents working on this repository.

## What this project is

An **Internal Team Skill Marketplace**: a forkable, one-click-deployable Netlify app where a Claude Code team browses their internal skills and tracks usage telemetry. Skills are declared statically; usage is collected from a Claude Code `PreToolUse` hook.

## Architecture

```
public/index.html          React SPA — the entire frontend, loaded from CDN (no build step)
netlify/functions/
  log-usage.js             POST /api/log-usage  — records one skill invocation
  usage.js                 GET  /api/usage      — aggregates telemetry per skill
  _shared.js               Shared blob store helpers + timestamp/response utilities
skills/registry.json       The skill manifest users edit (source of truth)
hooks/
  log-skill.sh             PreToolUse hook script (copied to ~/.claude/hooks/)
  settings.json            Snippet merged into the user's ~/.claude/settings.json
netlify.toml               Build config, /api redirect, manifest copy step
```

### Data flow

1. A teammate invokes a skill in Claude Code → the `PreToolUse` hook (`log-skill.sh`) runs.
2. The hook POSTs `{ skill, args, session_id, user, timestamp }` to `/api/log-usage` with an `x-hook-secret` header.
3. `log-usage.js` appends the event to Netlify Blobs at key `usage:{skill}` (capped at 1000 events per skill).
4. The SPA polls `GET /api/usage` every 10s; `usage.js` lists all `usage:`-prefixed blobs and returns per-skill aggregates.
5. The SPA merges the live telemetry with the static manifest from `/skills/registry.json` and renders cards + dashboard.

## Storage model (Netlify Blobs)

- Single store: **`skill-usage`**, strong consistency (so a freshly logged event shows up on the next poll).
- One key per skill: **`usage:{skillId}`**, holding a JSON array of event objects `{ args, session_id, user, timestamp }`.
- This is an append-and-cap log read/written as a whole document — a deliberate fit for Blobs, **not** a relational use case. Do not migrate this to a database unless the access pattern changes to querying/filtering individual events.
- Timestamps are normalized to **milliseconds** on write (the hook sends UNIX **seconds**); see `normalizeTimestamp` in `_shared.js`.

## Conventions

- **No build tooling.** The frontend is a single HTML file using React, ReactDOM, Babel-standalone, and Tailwind, all from CDN. Keep it that way — it's a selling point. Edit JSX directly inside the `<script type="text/babel">` block.
- **Functions are Netlify v2** (`export default async (req) => Response`). Routing: `/api/*` → `/.netlify/functions/:splat` via `netlify.toml`.
- **Design system** (defined in the Tailwind config inside `index.html`): background `#0E0E1A`, surface `#1A1A2E`, accent teal `#00C7B7`, text `#E8E8E8`, warning `#FF6B6B`. Fonts: Space Grotesk (display), Inter (body), JetBrains Mono (chips/numbers). The signature detail is the teal **pulse ring** on skills invoked within the last 60s.
- **The manifest is served from `/skills/registry.json`.** The authored file lives at repo root `skills/registry.json`; `netlify.toml`'s build command copies it into `public/skills/` at deploy time (so it's git-ignored under `public/`). Edit the root copy.

## Non-obvious decisions

- `HOOK_SECRET` validation is **skipped entirely when the env var is unset**, so the template works on first deploy without configuration but can be locked down later.
- `dailyCounts` is oldest-first: index 0 = 6 days ago, index 6 = today (UTC). The sparkline relies on this ordering.
- The event cap (1000) trims from the front (`slice(-1000)`), keeping the most recent events.

## Gotchas

- Don't run build/dev commands to "verify" — the Netlify pipeline validates automatically. Use `netlify dev` only for genuine local testing.
- If you add a skill field, update both `skills/registry.json` and the card/dashboard rendering in `public/index.html`.
- Keep `skills/registry.json`'s `id` values aligned with the skill names Claude Code actually sends, or telemetry won't match a catalog entry (the dashboard would still show it, but the card wouldn't light up).
