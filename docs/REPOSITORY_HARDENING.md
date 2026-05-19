# Repository Hardening Guide

This guide captures the cleanup, secret handling, branch discipline, and publish checklist for making PolyResearch safe to show publicly on GitHub.

## Files and Folders to Remove Before Pushing

Do not commit these local artifacts:

| Path | Why it should stay out of Git |
| --- | --- |
| `Backend/.env` | Backend secrets and provider API keys |
| `Frontend/.env` | Browser build config and public API token |
| `.env` | Root Docker Compose build args |
| `Frontend/node_modules/` | Reproducible dependency install output |
| `Frontend/dist/` | Generated production build output |
| `Backend/__pycache__/`, `Backend/src/**/__pycache__/` | Python bytecode cache |
| `Backend/.pytest_cache/` | Local test cache |
| `Backend/logs/` | Runtime logs can expose request and provider details |
| `Backend/data/` | Model/cache data can be large |
| `Backend/training_data/` | Exported samples may include sensitive prompts or metadata |
| `Backend/response.json` | Generated response dump |
| `Frontend/*.png` screenshot captures | Generated local QA artifacts |
| `*.tar`, `*.bin`, `*.pt`, `*.pth`, `*.ckpt`, `*.safetensors` | Large binary/model artifacts |

Preview ignored cleanup safely:

```powershell
git clean -ndX
```

If the preview contains only disposable ignored files:

```powershell
git clean -fdX
```

Avoid `git clean -fd` unless every untracked file has been reviewed.

## Sensitive Files and Secrets

Sensitive files:

- `Backend/.env`
- `Frontend/.env`
- Root `.env`
- copied compose output containing interpolated secrets
- training data exports
- backend logs
- screenshots or screen recordings that show environment variables

Sensitive values:

- `SUPABASE_SERVICE_KEY`
- `SUPABASE_KEY`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `HF_TOKEN`
- `IEEE_API_KEY`
- `PUBLIC_API_KEY`
- `ADMIN_API_KEY`

Before publishing, rotate any key that has ever appeared in terminal output, screenshots, chat, Git history, shared ZIP files, or generated logs.

## GitHub Push Checklist

- [ ] Create fresh API keys and update local `.env` files.
- [ ] Confirm env files are ignored with `git check-ignore -v Backend/.env Frontend/.env .env`.
- [ ] Run `rg -n --hidden --glob '!.git' "(api[_-]?key|secret|password|token|service[_-]?role|BEGIN .*PRIVATE)"`.
- [ ] Confirm no `.env` file appears in `git status --short`.
- [ ] Remove ignored local output with `git clean -ndX`, then `git clean -fdX` if the preview is safe.
- [ ] Run `npm run build` in `Frontend`.
- [ ] Run `npm run lint` in `Frontend`.
- [ ] Build the backend Docker image.
- [ ] Start the root Docker Compose stack and check `/api/health`.
- [ ] Confirm no large binaries are staged.
- [ ] Replace contributor placeholders in `README.md`.
- [ ] Add screenshots under `docs/screenshots/`.
- [ ] Commit with a focused message.

## Branch Naming

For this hardening pass:

- `codex/repo-production-hardening`

For future work:

- `feature/research-pipeline`
- `feature/graph-workspace`
- `fix/api-auth-fail-closed`
- `security/admin-endpoint-hardening`
- `infra/docker-production`
- `docs/setup-and-demo`
- `refactor/frontend-graph-modules`

## Commit Strategy

Use small, reviewable commits:

1. `chore: add repository hygiene files`
2. `docs: add production README and hardening guides`
3. `security: fail closed for protected API endpoints`
4. `infra: add production Docker orchestration`
5. `refactor: extract shared frontend research types`
6. `test: add smoke checks for API and graph pipeline`

This makes the project easier to explain in interviews because each commit has a clear engineering purpose.

## Recommended Repository Structure Improvements

Near-term frontend target:

```text
Frontend/src/
|-- app/
|   |-- AppShell.tsx
|   |-- WorkspaceStage.tsx
|   `-- hooks/
|       |-- useAuthSession.ts
|       |-- useResearchSearch.ts
|       |-- useSearchTransition.ts
|       `-- useWorkspacePanels.ts
|-- features/
|   |-- auth/
|   |-- chat/
|   |-- graph/
|   |-- landing/
|   |-- papers/
|   `-- workspace/
|-- api/
|-- lib/
`-- types/
```

Near-term backend target:

```text
Backend/src/
|-- api/
|   |-- dependencies/
|   |-- routes/
|   `-- schemas/
|-- services/
|   |-- research_service.py
|   |-- graph_service.py
|   |-- paper_service.py
|   `-- rate_limit_service.py
|-- repositories/
|   |-- paper_repository.py
|   `-- workspace_repository.py
|-- integrations/
|-- pipeline/
`-- agents/
```

The goal is to keep route files thin, move business behavior into services, and make frontend feature state live near the UI that owns it.
