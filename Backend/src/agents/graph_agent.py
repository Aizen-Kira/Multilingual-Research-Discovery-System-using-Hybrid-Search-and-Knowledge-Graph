"""Phase 10 — Knowledge Graph Build Agent"""
from typing import Any, AsyncGenerator, Dict, List
from src.agents.base_agent import BaseAgent
from src.core.graph_builder import graph_builder


class GraphAgent(BaseAgent):
    phase = 10
    name = "Knowledge Graph Build"

    async def run(self, ctx: Dict[str, Any]) -> AsyncGenerator[Dict, None]:
        papers: List[Dict] = ctx.get("all_stored_papers", [])
        relationships: List[Dict] = ctx.get("relationships", [])
        graph = graph_builder.build_graph(papers, relationships)
        ctx["graph"] = graph
        yield self._event(
            status="done",
            nodes=len(graph.get("nodes", [])),
            edges=len(graph.get("edges", [])),
        )
