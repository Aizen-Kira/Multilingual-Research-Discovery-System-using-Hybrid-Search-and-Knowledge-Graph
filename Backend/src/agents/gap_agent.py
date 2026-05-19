"""Phase 9 - Research Gap Detection Agent"""
from typing import Any, AsyncGenerator, Dict, List

from src.agents.base_agent import BaseAgent


class GapAgent(BaseAgent):
    phase = 9
    name = "Research Gap Detection"

    def __init__(self, llm_agent=None):
        super().__init__()
        self._llm_agent = llm_agent

    async def run(self, ctx: Dict[str, Any]) -> AsyncGenerator[Dict, None]:
        papers: List[Dict] = ctx.get("all_stored_papers", [])
        query: str = ctx.get("query", "")
        gaps: List[str] = []

        if self._llm_agent and papers:
            try:
                gaps = await self._detect_gaps_via_llm(papers, query)
            except Exception as e:
                self.logger.warning(f"Gap detection failed: {e}")

        ctx["research_gaps"] = gaps
        yield self._event(status="done", gaps=gaps)

    async def _detect_gaps_via_llm(self, papers: List[Dict], query: str) -> List[str]:
        summaries = []
        for paper in papers[:10]:
            title = paper.get("title", "")[:80]
            domain = paper.get("research_domain", "")
            finding = (paper.get("key_findings") or [""])[0][:120]
            limitation = (paper.get("limitations") or [""])[0][:120]
            summaries.append(
                f"- [{domain}] {title}\n"
                f"  Key finding: {finding}\n"
                f"  Limitation: {limitation}"
            )

        summary_block = "\n".join(summaries) or "No papers available."

        prompt = f"""You are a research analyst. Given the query "{query}" and the following paper summaries, identify 5 concrete research gaps - areas not yet studied, under-explored methods, or missing cross-domain connections.

Papers:
{summary_block}

Return ONLY a JSON array of 5 strings, each describing one research gap. No markdown, no extra text.
Example: ["Gap 1 description", "Gap 2 description", ...]"""

        raw, _ = await self._llm_agent._call_llm(prompt)
        if not raw:
            return []

        import json
        import re

        match = re.search(r"\[.*?\]", raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        return []
