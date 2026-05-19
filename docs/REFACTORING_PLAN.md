# Refactoring Plan

This plan focuses on maintainability while keeping the project demo-stable.

## Largest and Most Problematic Files

Frontend:

| File | Risk |
| --- | --- |
| `Frontend/src/App.tsx` | Owns search flow, app shell, modal state, notifications, transitions, and data mapping. Hard to test. |
| `Frontend/src/components/GraphView.tsx` | Mixes graph layout, filtering, clustering, rendering, selection, and React Flow edge generation. |
| `Frontend/src/components/LandingPage.tsx` | Combines presentation, animation, and search initiation logic. |
| `Frontend/src/components/CollaborationPage.tsx` | Handles data loading, default seeding, form state, comments, and shared papers in one component. |
| `Frontend/src/components/Sidebar.tsx` | Handles paper details, translation, saving, sharing, and list normalization. |

Backend:

| File | Risk |
| --- | --- |
| `Backend/src/agents/llm_agent.py` | Provider configuration, prompt construction, parsing, fallback, and training data collection are coupled. |
| `Backend/src/pipeline/orchestrator.py` | Pipeline control flow, cache behavior, deduplication, and final response assembly are coupled. |
| `Backend/src/database/supabase_client.py` | Database initialization, CRUD, relationships, statistics, and circuit breaker behavior live together. |
| `Backend/src/agents/validation_agent.py` | Quality filtering, relevance scoring, deduplication, and source-specific rules are coupled. |
| `Backend/src/api/routes/research.py` | Route currently knows how to instantiate and iterate the orchestrator. |

## Frontend Modularization Plan

Target structure:

```text
Frontend/src/
|-- app/
|   |-- AppShell.tsx
|   |-- WorkspaceStage.tsx
|   `-- hooks/
|       |-- useResearchSearch.ts
|       |-- useSearchTransition.ts
|       `-- useWorkspacePanels.ts
|-- features/
|   |-- graph/
|   |   |-- GraphView.tsx
|   |   |-- hooks/
|   |   |   |-- useGraphLayout.ts
|   |   |   |-- useGraphFilters.ts
|   |   |   `-- useGraphSelection.ts
|   |   `-- types.ts
|   |-- papers/
|   |-- chat/
|   |-- auth/
|   `-- workspace/
|-- api/
|-- lib/
`-- types/
```

Priority order:

1. Extract `useResearchSearch` from `App.tsx`.
2. Extract `useWorkspacePanels` from modal boolean state.
3. Move landing transition timers into `useSearchTransition`.
4. Split `GraphView.tsx` into graph layout, filters, selection, and presentation.
5. Replace remaining `any` with explicit layout and API types.
6. Add runtime response validation with Zod or Valibot.

Example hook boundary:

```ts
export type WorkspacePanel = 'saved' | 'collaboration' | 'settings' | 'help' | null;

export function useWorkspacePanels() {
  const [activePanel, setActivePanel] = useState<WorkspacePanel>(null);

  return {
    activePanel,
    openSavedPapers: () => setActivePanel('saved'),
    openCollaboration: () => setActivePanel('collaboration'),
    openSettings: () => setActivePanel('settings'),
    openHelp: () => setActivePanel('help'),
    closePanel: () => setActivePanel(null),
  };
}
```

## Backend Modularization Plan

Target structure:

```text
Backend/src/
|-- api/
|   |-- dependencies/
|   |-- routes/
|   `-- schemas/
|-- services/
|   |-- research_service.py
|   |-- chat_service.py
|   |-- graph_service.py
|   |-- paper_service.py
|   `-- rate_limit_service.py
|-- repositories/
|   |-- paper_repository.py
|   |-- relationship_repository.py
|   `-- workspace_repository.py
|-- integrations/
|-- pipeline/
`-- agents/
```

Priority order:

1. Move route orchestration from `api/routes/research.py` into `services/research_service.py`.
2. Split LLM provider implementations into `services/llm_providers/`.
3. Move final graph assembly from `PipelineOrchestrator` into `services/graph_service.py`.
4. Split Supabase access into repositories by domain.
5. Add Pydantic request/response schemas in `api/schemas/`.
6. Replace broad `except Exception` blocks where operational behavior can be made specific.

Example service boundary:

```py
class ResearchService:
    def __init__(self, orchestrator_factory):
        self._orchestrator_factory = orchestrator_factory

    async def run_query(self, request: ResearchRequest) -> dict:
        final_result: dict = {}
        orchestrator = self._orchestrator_factory()

        async for event in orchestrator.run(
            query=request.query,
            sources=request.sources,
            max_papers=request.max_papers,
            sources_explicit=bool(request.sources),
        ):
            if event.get("phase") == "complete":
                final_result = event

        return final_result
```

## TypeScript Quality

Completed:

- Shared API and graph types exist in `Frontend/src/types/research.ts`.
- `Frontend/src/api/client.ts` uses typed API payloads instead of unstructured responses.

Next changes:

- Replace `catch (error: any)` with `catch (error: unknown)` plus a `getErrorMessage` helper.
- Replace graph simulation `any` with typed layout nodes and links.
- Enable `@typescript-eslint/no-explicit-any` as a warning.
- Add typed API error models.

Suggested helper:

```ts
export const getErrorMessage = (error: unknown, fallback = 'Unexpected error') =>
  error instanceof Error ? error.message : fallback;
```

## Coupling Reduction

- Routes should call services, not instantiate agents directly.
- Services should return typed response objects, not raw dictionaries from multiple layers.
- Repositories should own Supabase query shape and table names.
- Frontend components should receive prepared view models instead of mutating backend data.
- Translation should move to a backend service or official provider instead of browser scraping.

## Testing Targets

- Backend security dependency tests for missing, malformed, short, and valid keys.
- Backend route smoke tests for research, chat, papers, health, and admin boundaries.
- Graph service tests for empty results, duplicate papers, and low-edge graphs.
- Frontend tests for API error parsing and graph data mapping.
- Playwright smoke test for search to graph to paper panel to copilot.
