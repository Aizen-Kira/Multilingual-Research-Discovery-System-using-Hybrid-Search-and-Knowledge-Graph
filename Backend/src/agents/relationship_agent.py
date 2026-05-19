"""
Phase 8 - Relationship Discovery Agent
Source A: Citation network (ground truth, zero LLM cost)
Source B: LLM semantic analysis (non-citation NEW<->NEW + NEW<->EXISTING, cap 20)
Source C: Cosine similarity (always-on fallback)
"""
import asyncio
from typing import Any, AsyncGenerator, Dict, List, Set, Tuple

from src.agents.base_agent import BaseAgent
from src.config.settings import settings
from src.core.embeddings import embedding_generator
from src.database.supabase_client import supabase_client


class RelationshipAgent(BaseAgent):
    phase = 8
    name = "Relationship Discovery"

    def __init__(self, llm_agent=None):
        super().__init__()
        self._llm_agent = llm_agent

    async def run(self, ctx: Dict[str, Any]) -> AsyncGenerator[Dict, None]:
        all_papers: List[Dict] = ctx.get("all_stored_papers", [])
        citation_ids: List[str] = ctx.get("citation_ids", [])
        new_papers: List[Dict] = ctx.get("analyzed_new_papers", [])

        persisted = [paper for paper in all_papers if paper.get("persisted") and paper.get("id")]
        if len(persisted) < 2:
            ctx["relationships"] = []
            yield self._event(status="done", relationships=0)
            return

        relationships: List[Dict] = []
        stored_pairs: Set[Tuple] = set()

        doi_map: Dict[str, Dict] = {}
        arxiv_map: Dict[str, Dict] = {}
        for paper in persisted:
            doi = paper.get("doi") or ""
            arxiv_id = (paper.get("paper_id") or "").replace("arxiv:", "")
            if doi:
                doi_map[doi.lower()] = paper
            if arxiv_id:
                arxiv_map[arxiv_id] = paper

        for paper in persisted:
            paper_id = paper["id"]
            for citation_id in paper.get("citation_ids") or []:
                normalized = citation_id.lower().replace("doi:", "")
                matched = doi_map.get(normalized) or arxiv_map.get(citation_id)
                if matched and matched["id"] != paper_id:
                    pair = (min(paper_id, matched["id"]), max(paper_id, matched["id"]))
                    if pair not in stored_pairs:
                        stored_pairs.add(pair)
                        rel = {
                            "paper1_id": paper_id,
                            "paper2_id": matched["id"],
                            "relationship_type": "cites",
                            "relationship_strength": 1.0,
                            "relationship_context": "Direct citation (ground truth)",
                            "connection_reasoning": "Paper explicitly cites the other",
                            "analysis_method": "citation_network",
                            "confidence_score": 1.0,
                            "is_cross_linguistic": paper.get("language") != matched.get("language"),
                            "language_pair": f"{paper.get('language', 'en')}-{matched.get('language', 'en')}",
                        }
                        rel_id = await supabase_client.store_relationship(rel)
                        if rel_id:
                            rel["id"] = rel_id
                            relationships.append(rel)

        new_ids = {paper["id"] for paper in new_papers if paper.get("id")}
        llm_pairs = [
            (persisted[i], persisted[j])
            for i in range(len(persisted))
            for j in range(i + 1, len(persisted))
            if (persisted[i]["id"] in new_ids or persisted[j]["id"] in new_ids)
            and (min(persisted[i]["id"], persisted[j]["id"]), max(persisted[i]["id"], persisted[j]["id"])) not in stored_pairs
        ][:20]

        if self._llm_agent and llm_pairs:
            semaphore = asyncio.Semaphore(2)

            async def analyze_pair(paper1: Dict, paper2: Dict):
                async with semaphore:
                    await asyncio.sleep(1.0)
                    return await self._llm_agent.analyze_relationship(paper1, paper2)

            llm_results = await asyncio.gather(*[analyze_pair(paper1, paper2) for paper1, paper2 in llm_pairs], return_exceptions=True)
            for (paper1, paper2), result in zip(llm_pairs, llm_results):
                if isinstance(result, Exception) or not result:
                    continue
                pair = (min(paper1["id"], paper2["id"]), max(paper1["id"], paper2["id"]))
                if pair not in stored_pairs:
                    stored_pairs.add(pair)
                    rel = {
                        "paper1_id": paper1["id"],
                        "paper2_id": paper2["id"],
                        **result,
                        "is_cross_linguistic": paper1.get("language") != paper2.get("language"),
                        "language_pair": f"{paper1.get('language', 'en')}-{paper2.get('language', 'en')}",
                    }
                    rel_id = await supabase_client.store_relationship(rel)
                    if rel_id:
                        rel["id"] = rel_id
                        relationships.append(rel)

        for index, paper1 in enumerate(persisted):
            emb1 = paper1.get("embedding")
            if not emb1:
                continue
            similarities = []
            for j, paper2 in enumerate(persisted):
                if index == j:
                    continue
                emb2 = paper2.get("embedding")
                if not emb2:
                    continue
                pair = (min(paper1["id"], paper2["id"]), max(paper1["id"], paper2["id"]))
                if pair in stored_pairs:
                    continue
                similarity = embedding_generator.cosine_similarity(emb1, emb2)
                if similarity >= settings.RELATIONSHIP_SIMILARITY_THRESHOLD:
                    similarities.append((similarity, paper2, pair))
            similarities.sort(reverse=True)
            for similarity, paper2, pair in similarities[:settings.RELATIONSHIP_MAX_PER_PAPER]:
                stored_pairs.add(pair)
                rel_type = (
                    "builds_upon" if similarity >= 0.85
                    else "extends" if similarity >= 0.75
                    else "complements" if similarity >= 0.65
                    else "related"
                )
                rel = {
                    "paper1_id": paper1["id"],
                    "paper2_id": paper2["id"],
                    "relationship_type": rel_type,
                    "relationship_strength": float(similarity),
                    "relationship_context": f"Semantic similarity: {similarity:.3f}",
                    "connection_reasoning": "Cosine similarity of embeddings",
                    "analysis_method": "cosine_similarity",
                    "confidence_score": float(similarity),
                    "semantic_similarity": float(similarity),
                    "is_cross_linguistic": paper1.get("language") != paper2.get("language"),
                    "language_pair": f"{paper1.get('language', 'en')}-{paper2.get('language', 'en')}",
                }
                rel_id = await supabase_client.store_relationship(rel)
                if rel_id:
                    rel["id"] = rel_id
                    relationships.append(rel)

        ctx["relationships"] = relationships
        self.logger.info(f"Discovered {len(relationships)} relationships")
        yield self._event(status="done", relationships=len(relationships))
