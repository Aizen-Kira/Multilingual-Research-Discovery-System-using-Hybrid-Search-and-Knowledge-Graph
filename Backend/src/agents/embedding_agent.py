"""Phase 6 — Embedding Generation + Vector Search Agent"""
import asyncio
from typing import Any, AsyncGenerator, Dict, List
from src.agents.base_agent import BaseAgent
from src.core.embeddings import embedding_generator
from src.database.supabase_client import supabase_client
from src.config.settings import settings


class EmbeddingAgent(BaseAgent):
    phase = 6
    name = "Embeddings & Vector Search"

    async def run(self, ctx: Dict[str, Any]) -> AsyncGenerator[Dict, None]:
        # ✅ FIX: Read from 'analyzed_papers' — matches LLMAgent output key
        new_papers: List[Dict] = ctx.get("analyzed_papers", [])

        # A. Generate embeddings for new papers (batch)
        if new_papers:
            texts = [
                f"{p.get('title', '')} {(p.get('abstract') or '')[:400]} {(p.get('context_summary') or '')[:200]}"
                for p in new_papers
            ]
            loop = asyncio.get_event_loop()
            embeddings = await loop.run_in_executor(
                None, lambda: embedding_generator.generate_batch_embeddings(texts)
            )
            for paper, emb in zip(new_papers, embeddings):
                paper["embedding"] = emb
                paper["embedding_model"] = settings.EMBEDDING_MODEL
            self.logger.info(f"Generated {len(embeddings)} embeddings in batch")

        # B. pgvector HNSW similarity search for extra related papers from DB
        query_emb = ctx.get("query_embedding")
        if query_emb is None and new_papers:
            query_emb = new_papers[0].get("embedding")

        similar_from_db: List[Dict] = []
        if query_emb:
            try:
                similar_from_db = await supabase_client.vector_search(
                    query_embedding=query_emb,
                    limit=10,
                    threshold=0.5,
                )
            except Exception as e:
                self.logger.warning(f"Vector search failed: {e}")

        ctx["query_embedding"] = query_emb
        ctx["similar_from_db"] = similar_from_db
        # ✅ FIX: Write back to 'analyzed_papers' — StorageAgent reads this key
        ctx["analyzed_papers"] = new_papers

        self.logger.info(f"Vector search returned {len(similar_from_db)} DB matches")
        yield self._event(
            status="done",
            embeddings_generated=len(new_papers),
            db_similar=len(similar_from_db),
        )
