# AGENTS.md - Trap Workspace Guide

## Dev Server
- **Already running on port 3002** — do NOT start another
- Turbopack hot-reloads on save — no restart needed for most changes
- Check it's up: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/`
- If dead: `rm -f .next/dev/lock && PORT=3002 nohup pnpm dev > /tmp/trap-next.log 2>&1 &`

## Build & Test
- `pnpm build` — full production build
- `pnpm lint` — eslint
- `pnpm typecheck` — tsc
- **Pre-commit hooks must pass** — no `--no-verify` allowed

## Workflow
1. Work the ticket in your task
2. Test your changes (build passes, UI works)
3. Create a PR — do NOT merge, leave it for review
4. Update ticket status via API:
   ```bash
   # Move to in_review after PR created
   curl -X PATCH http://localhost:3002/api/tasks/TICKET_ID \
     -H 'Content-Type: application/json' -d '{"status": "in_review"}'
   ```

## Task API
- `GET /api/tasks?projectId=...` — list tasks
- `PATCH /api/tasks/{id}` — update status/fields
- Statuses: `backlog` → `ready` → `in_progress` → `in_review` → `done`

## Don'ts
- Don't merge your own PRs
- Don't kill port 3002
- Don't run `npm` — use `pnpm`
- Don't use `--no-verify` on commits
